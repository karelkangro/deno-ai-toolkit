// AI Server Toolkit - Complete functional toolkit for AI-powered Deno servers
import { runAgent, createSearchTool } from "./src/agents/base.ts";

// Re-export all types
export * from "./src/types.ts";

// Vector store functionality
export {
  createLanceDB,
  initializeTable,
  addDocument,
  addDocuments,
  searchSimilar,
  searchByEmbedding,
  getDocument,
  updateDocument,
  deleteDocument,
  getStats,
  clear,
  type LanceDBState,
} from "./src/vector-store/lancedb.ts";

// Embedding functionality
export {
  createOpenAIEmbeddings,
  embedText,
  embedTexts,
  calculateSimilarity,
  type OpenAIEmbeddingState,
} from "./src/embeddings/openai.ts";

// LLM functionality
export {
  createClaudeLLM,
  generateResponse,
  streamResponse,
  type ClaudeLLMState,
} from "./src/llm/claude.ts";

// Agent functionality
export {
  createAgent,
  runAgent,
  addTool,
  removeTool,
  clearMemory,
  getMemory,
  updateSystemPrompt,
  createSearchTool,
  createCalculatorTool,
  createWebSearchTool,
  type AgentState,
} from "./src/agents/base.ts";

// Specialized agents for different domains
export {
  createSpecializedAgent,
  runSpecializedAnalysis,
  createArchitectureAgentConfig,
  type SpecializedAgentConfig,
  type ProjectFile,
  type ProjectContext,
  type AgentAnalysisResult,
  type AnalysisIssue,
} from "./src/agents/specialized.ts";

// Utility functions
export {
  createRateLimiter,
  canMakeRequest,
  recordRequest,
  withRateLimit,
  getWaitTime,
  estimateTokens,
  type RateLimitState,
} from "./src/utils/rate-limiter.ts";

// High-level factory functions for easy setup
export async function createAISystem(config: {
  vectorStore: {
    provider: 'lancedb';
    path: string;
    dimensions?: number;
  };
  embeddings: {
    provider: 'openai';
    apiKey: string;
    model?: string;
    dimensions?: number;
  };
  llm: {
    provider: 'claude';
    apiKey: string;
    model?: string;
  };
}) {
  const { createOpenAIEmbeddings } = await import("./src/embeddings/openai.ts");
  const { createLanceDB, initializeTable, searchSimilar, addDocument, addDocuments } = await import("./src/vector-store/lancedb.ts");
  const { createClaudeLLM, generateResponse } = await import("./src/llm/claude.ts");
  const { createAgent } = await import("./src/agents/base.ts");

  const embeddings = createOpenAIEmbeddings(config.embeddings);

  const vectorStore = await createLanceDB(
    {
      provider: config.vectorStore.provider,
      path: config.vectorStore.path,
      dimensions: config.vectorStore.dimensions,
    },
    config.embeddings
  );

  await initializeTable(vectorStore);

  const llm = createClaudeLLM(config.llm);

  return {
    embeddings,
    vectorStore,
    llm,
    // Convenience methods
    async search(query: string, options?: any) {
      return await searchSimilar(vectorStore, query, options);
    },
    async addDocument(doc: any) {
      return await addDocument(vectorStore, doc);
    },
    async addDocuments(docs: any[]) {
      return await addDocuments(vectorStore, docs);
    },
    async generateResponse(messages: any[], tools?: any[]) {
      return await generateResponse(llm, messages, tools);
    },
    createAgent(config: any) {
      return createAgent({
        ...config,
        llm: config.llm || {
          provider: 'claude',
          apiKey: config.llm?.apiKey || llm.apiKey,
          model: config.llm?.model || llm.model,
        },
      });
    },
  };
}

// Simplified factory for common use cases
export async function createVectorSearchSystem(config: {
  lancedbPath: string;
  openaiApiKey: string;
  claudeApiKey?: string;
}) {
  return await createAISystem({
    vectorStore: {
      provider: 'lancedb',
      path: config.lancedbPath,
    },
    embeddings: {
      provider: 'openai',
      apiKey: config.openaiApiKey,
    },
    llm: {
      provider: 'claude',
      apiKey: config.claudeApiKey || '',
    },
  });
}

export async function createRAGSystem(config: {
  lancedbPath: string;
  openaiApiKey: string;
  claudeApiKey: string;
  systemPrompt?: string;
}) {
  const system = await createAISystem({
    vectorStore: {
      provider: 'lancedb',
      path: config.lancedbPath,
    },
    embeddings: {
      provider: 'openai',
      apiKey: config.openaiApiKey,
    },
    llm: {
      provider: 'claude',
      apiKey: config.claudeApiKey,
    },
  });

  const agent = system.createAgent({
    name: 'rag-assistant',
    description: 'Retrieval-augmented generation assistant',
    systemPrompt: config.systemPrompt || `You are a helpful assistant that can search through documents to answer questions.
Use the search tool to find relevant information before answering questions.`,
    tools: [
      createSearchTool(async (query: string) => {
        return await system.search(query, { limit: 5 });
      }),
    ],
  });

  return {
    ...system,
    agent,
    async ask(question: string, context?: any) {
      return await runAgent(agent, question, context);
    },
  };
}
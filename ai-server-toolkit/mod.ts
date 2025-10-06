// AI Server Toolkit - Complete functional toolkit for AI-powered Deno servers
import { createSearchTool, runAgent } from "./src/agents/base.ts";

// Re-export all types
export * from "./src/types.ts";

// Vector store functionality
export {
  addDocument,
  addDocuments,
  addWorkspaceDocument,
  addWorkspaceDocuments,
  clear,
  clearWorkspace,
  createLanceDB,
  // Workspace-specific functions
  createWorkspaceTable,
  deleteDocument,
  deleteWorkspaceDocument,
  deleteWorkspaceTable,
  getDocument,
  getStats,
  getWorkspaceDocument,
  getWorkspaceStats,
  initializeTable,
  type LanceDBState,
  listWorkspaceTables,
  searchByEmbedding,
  searchSimilar,
  searchWorkspace,
  searchWorkspaceByEmbedding,
  updateDocument,
  updateWorkspaceDocument,
} from "./src/vector-store/lancedb.ts";

// Embedding functionality
export {
  calculateSimilarity,
  createOpenAIEmbeddings,
  embedText,
  embedTexts,
  type OpenAIEmbeddingState,
} from "./src/embeddings/openai.ts";

// LLM functionality
export {
  type ClaudeLLMState,
  createClaudeLLM,
  generateResponse,
  streamResponse,
} from "./src/llm/claude.ts";

// Agent functionality
export {
  addTool,
  type AgentState,
  clearMemory,
  createAgent,
  createCalculatorTool,
  createSearchTool,
  createWebSearchTool,
  getMemory,
  removeTool,
  runAgent,
  updateSystemPrompt,
} from "./src/agents/base.ts";

// Specialized agents for different domains
export {
  type AgentAnalysisResult,
  type AnalysisIssue,
  createArchitectureAgentConfig,
  createSpecializedAgent,
  type ProjectContext,
  type ProjectFile,
  runSpecializedAnalysis,
  type SpecializedAgentConfig,
} from "./src/agents/specialized.ts";

// Utility functions
export {
  canMakeRequest,
  createRateLimiter,
  estimateTokens,
  getWaitTime,
  type RateLimitState,
  recordRequest,
  withRateLimit,
} from "./src/utils/rate-limiter.ts";

// High-level factory functions for easy setup
export async function createAISystem(config: {
  vectorStore: {
    provider: "lancedb";
    path: string;
    dimensions?: number;
  };
  embeddings: {
    provider: "openai";
    apiKey: string;
    model?: string;
    dimensions?: number;
  };
  llm: {
    provider: "claude";
    apiKey: string;
    model?: string;
  };
}): Promise<{
  embeddings: ReturnType<
    typeof import("./src/embeddings/openai.ts").createOpenAIEmbeddings
  >;
  vectorStore: Awaited<
    ReturnType<typeof import("./src/vector-store/lancedb.ts").createLanceDB>
  >;
  llm: ReturnType<typeof import("./src/llm/claude.ts").createClaudeLLM>;
  search: (query: string, options?: any) => Promise<any>;
  addDocument: (doc: any) => Promise<any>;
  addDocuments: (docs: any[]) => Promise<any>;
  generateResponse: (messages: any[], tools?: any[]) => Promise<any>;
  createAgent: (config: any) => any;
}> {
  const { createOpenAIEmbeddings } = await import("./src/embeddings/openai.ts");
  const {
    createLanceDB,
    initializeTable,
    searchSimilar,
    addDocument,
    addDocuments,
  } = await import("./src/vector-store/lancedb.ts");
  const { createClaudeLLM, generateResponse } = await import(
    "./src/llm/claude.ts"
  );
  const { createAgent } = await import("./src/agents/base.ts");

  const embeddings = createOpenAIEmbeddings(config.embeddings);

  const vectorStore = await createLanceDB(
    {
      provider: config.vectorStore.provider,
      path: config.vectorStore.path,
      dimensions: config.vectorStore.dimensions,
    },
    config.embeddings,
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
          provider: "claude",
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
}): Promise<{
  embeddings: any;
  vectorStore: any;
  llm: any;
  search: (query: string, options?: any) => Promise<any>;
  addDocument: (doc: any) => Promise<any>;
  addDocuments: (docs: any[]) => Promise<any>;
  generateResponse: (messages: any[], tools?: any[]) => Promise<any>;
  createAgent: (config: any) => any;
}> {
  return await createAISystem({
    vectorStore: {
      provider: "lancedb",
      path: config.lancedbPath,
    },
    embeddings: {
      provider: "openai",
      apiKey: config.openaiApiKey,
    },
    llm: {
      provider: "claude",
      apiKey: config.claudeApiKey || "",
    },
  });
}

export async function createRAGSystem(config: {
  lancedbPath: string;
  openaiApiKey: string;
  claudeApiKey: string;
  systemPrompt?: string;
}): Promise<{
  embeddings: any;
  vectorStore: any;
  llm: any;
  search: (query: string, options?: any) => Promise<any>;
  addDocument: (doc: any) => Promise<any>;
  addDocuments: (docs: any[]) => Promise<any>;
  generateResponse: (messages: any[], tools?: any[]) => Promise<any>;
  createAgent: (config: any) => any;
  agent: any;
  ask: (question: string, context?: any) => Promise<any>;
}> {
  const system = await createAISystem({
    vectorStore: {
      provider: "lancedb",
      path: config.lancedbPath,
    },
    embeddings: {
      provider: "openai",
      apiKey: config.openaiApiKey,
    },
    llm: {
      provider: "claude",
      apiKey: config.claudeApiKey,
    },
  });

  const agent = system.createAgent({
    name: "rag-assistant",
    description: "Retrieval-augmented generation assistant",
    systemPrompt: config.systemPrompt ||
      `You are a helpful assistant that can search through documents to answer questions.
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

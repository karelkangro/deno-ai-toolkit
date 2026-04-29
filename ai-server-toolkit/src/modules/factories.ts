/**
 * High-level factory functions module exports
 *
 * @since 1.11.0
 */

import type {
  AgentConfig,
  EmbeddingModel,
  LLMMessage,
  LLMModel,
  SearchOptions,
  SearchResult,
  VectorDocument,
  VectorStore,
} from "../types.ts";
import type { AgentState } from "../agents/base.ts";
import type { AgentResult } from "../types.ts";
import { createSearchTool } from "../agents/base.ts";

/**
 * Creates a complete AI system with vector store, embeddings, and LLM capabilities.
 *
 * This is the main factory function for setting up an AI-powered server with all necessary components.
 * It initializes LanceDB for vector storage, OpenAI for embeddings, and Claude for LLM capabilities.
 *
 * @param config Configuration object with vector store, embeddings, and LLM settings
 * @returns Promise resolving to AI system with embeddings, vectorStore, llm, and convenience methods
 */
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
  embeddings: EmbeddingModel;
  vectorStore: VectorStore;
  llm: LLMModel;
  search: (query: string, options?: SearchOptions) => Promise<SearchResult[]>;
  addDocument: (doc: VectorDocument) => Promise<void>;
  addDocuments: (docs: VectorDocument[]) => Promise<void>;
  generateResponse: (
    messages: LLMMessage[],
    tools?: import("../types.ts").ToolDefinition[],
  ) => Promise<import("../types.ts").LLMResponse>;
  createAgent: (config: AgentConfig) => AgentState;
}> {
  const { createOpenAIEmbeddings } = await import("../embeddings/openai.ts");
  const {
    createLanceDB,
    initializeTable,
    searchSimilar,
    addDocument,
    addDocuments,
  } = await import("../vector-store/lancedb.ts");
  const { createClaudeLLM, generateResponse } = await import(
    "../llm/claude.ts"
  );
  const { createAgent } = await import("../agents/base.ts");

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
    // Convenience methods using adapters or direct calls
    async search(query: string, options?: SearchOptions) {
      return await searchSimilar(vectorStore, query, options);
    },
    async addDocument(doc: VectorDocument) {
      return await addDocument(vectorStore, doc);
    },
    async addDocuments(docs: VectorDocument[]) {
      return await addDocuments(vectorStore, docs);
    },
    async generateResponse(
      messages: LLMMessage[],
      tools?: import("../types.ts").ToolDefinition[],
    ) {
      return await generateResponse(llm, messages, tools);
    },
    createAgent(agentConfig: AgentConfig) {
      return createAgent({
        ...agentConfig,
        llm: agentConfig.llm || llm,
      });
    },
  };
}

/**
 * Creates a simplified vector search system for semantic search use cases.
 */
export async function createVectorSearchSystem(config: {
  lancedbPath: string;
  openaiApiKey: string;
  claudeApiKey?: string;
}): Promise<{
  embeddings: EmbeddingModel;
  vectorStore: VectorStore;
  llm: LLMModel;
  search: (query: string, options?: SearchOptions) => Promise<SearchResult[]>;
  addDocument: (doc: VectorDocument) => Promise<void>;
  addDocuments: (docs: VectorDocument[]) => Promise<void>;
  generateResponse: (
    messages: LLMMessage[],
    tools?: import("../types.ts").ToolDefinition[],
  ) => Promise<import("../types.ts").LLMResponse>;
  createAgent: (config: AgentConfig) => AgentState;
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

/**
 * Creates a complete Retrieval-Augmented Generation (RAG) system with AI agent.
 */
export async function createRAGSystem(config: {
  lancedbPath: string;
  openaiApiKey: string;
  claudeApiKey: string;
  systemPrompt?: string;
}): Promise<{
  embeddings: EmbeddingModel;
  vectorStore: VectorStore;
  llm: LLMModel;
  search: (query: string, options?: SearchOptions) => Promise<SearchResult[]>;
  addDocument: (doc: VectorDocument) => Promise<void>;
  addDocuments: (docs: VectorDocument[]) => Promise<void>;
  generateResponse: (
    messages: LLMMessage[],
    tools?: import("../types.ts").ToolDefinition[],
  ) => Promise<import("../types.ts").LLMResponse>;
  createAgent: (config: AgentConfig) => AgentState;
  agent: AgentState;
  ask: (question: string, context?: Record<string, unknown>) => Promise<AgentResult>;
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
      }) as import("../types.ts").ToolDefinition,
    ],

    llm: system.llm, // Pass the LLMModel instance directly
  });

  return {
    ...system,
    agent,
    async ask(question: string, context?: Record<string, unknown>) {
      const { runAgent } = await import("../agents/base.ts");
      return await runAgent(agent, question, context);
    },
  };
}

// AI Server Toolkit - Complete functional toolkit for AI-powered Deno servers
import { createSearchTool, runAgent } from "./src/agents/base.ts";

// Re-export all types
export * from "./src/types.ts";

// Workspace management types and functions (NEW in v1.4.0)
export * from "./src/workspace/types.ts";
export {
  addDocument as addWorkspaceDocumentMeta,
  closeWorkspaceKV,
  createWorkspace,
  createWorkspaceKV,
  deleteDocument as deleteWorkspaceDocumentMeta,
  deleteWorkspace,
  generateId as generateWorkspaceId,
  getDocument as getWorkspaceDocumentMeta,
  getWorkspace,
  getWorkspaceStats,
  listDocuments as listWorkspaceDocuments,
  listWorkspaces,
  updateDocument as updateWorkspaceDocumentMeta,
  updateWorkspace,
} from "./src/workspace/kv-store.ts";
export {
  createWorkspaceCoordinated,
  deleteDocumentCoordinated,
  deleteWorkspaceCoordinated,
  listWorkspacesCoordinated,
  updateWorkspaceCoordinated,
} from "./src/workspace/coordinator.ts";

// Rules management types and functions (NEW)
export * from "./src/rules/mod.ts";

// File storage types and functions (NEW in v1.4.0)
export * from "./src/storage/types.ts";
export {
  createS3Storage,
  deleteFile,
  downloadFile,
  fileExists,
  generateStorageKey,
  getFileMetadata,
  getPresignedUrl,
  uploadFile,
} from "./src/storage/s3.ts";

// Document processing types and functions (NEW in v1.7.0)
export * from "./src/document/types.ts";
export {
  buildSectionHierarchy,
  chunkByParagraphs,
  chunkBySections,
  chunkBySentences,
  chunkDocumentPages,
  detectLegalKeywords,
  detectSectionNumbers,
  detectStandardReferences,
  enrichChunksWithLegalContext,
  extractCitationFromMetadata,
  extractDocumentMetadata,
  extractDocumentText,
  extractPDFContent,
  extractPDFContentWithPdfjs,
  extractTextOnly,
  extractTextOnlyWithPdfjs,
  formatCitation,
  formatCitationCompact,
  formatCitationMarkdown,
  processLegalDocument,
} from "./src/document/mod.ts";

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

// Vector store schemas - single source of truth for metadata structures
export {
  type BaseDocumentMetadata,
  type BaseVectorMetadata,
  buildRuleFilters,
  createBaseDocumentMetadata,
  createRuleRecord,
  extractMetadataFromResult,
  type FileVectorMetadata,
  getFieldName,
  ruleToVectorMetadata,
  type RuleVectorMetadata,
  transformMetadataForStorage,
} from "./src/vector-store/schemas.ts";

// Schema registry for multi-table workspace management
export {
  createWorkspaceTableRegistry,
  type TableConfig,
  type WorkspaceTableRegistry,
} from "./src/vector-store/schema-registry.ts";

// Vector database connection management
export {
  createDefaultConnectionManager,
  createVectorDBConnectionManager,
  type VectorDBConnectionConfig,
  type VectorDBConnectionManager,
} from "./src/vector-store/connection-manager.ts";

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

/**
 * Creates a complete AI system with vector store, embeddings, and LLM capabilities.
 *
 * This is the main factory function for setting up an AI-powered server with all necessary components.
 * It initializes LanceDB for vector storage, OpenAI for embeddings, and Claude for LLM capabilities.
 *
 * @param config Configuration object with vector store, embeddings, and LLM settings
 * @param config.vectorStore Vector database configuration (LanceDB)
 * @param config.vectorStore.provider Must be "lancedb"
 * @param config.vectorStore.path Path to LanceDB database (local path or db:// URL for cloud)
 * @param config.vectorStore.dimensions Optional embedding dimensions (default: 1536)
 * @param config.embeddings Embedding provider configuration (OpenAI)
 * @param config.embeddings.provider Must be "openai"
 * @param config.embeddings.apiKey OpenAI API key
 * @param config.embeddings.model Optional model name (default: text-embedding-3-small)
 * @param config.embeddings.dimensions Optional embedding dimensions (default: 1536)
 * @param config.llm LLM provider configuration (Claude)
 * @param config.llm.provider Must be "claude"
 * @param config.llm.apiKey Anthropic API key for Claude
 * @param config.llm.model Optional Claude model (default: claude-3-5-sonnet-20241022)
 * @returns Promise resolving to AI system with embeddings, vectorStore, llm, and convenience methods
 *
 * @example
 * ```ts
 * const aiSystem = await createAISystem({
 *   vectorStore: { provider: "lancedb", path: "./vector-db" },
 *   embeddings: { provider: "openai", apiKey: "sk-..." },
 *   llm: { provider: "claude", apiKey: "sk-ant-..." }
 * });
 *
 * // Add documents
 * await aiSystem.addDocument({ id: "1", content: "Hello world" });
 *
 * // Search
 * const results = await aiSystem.search("greeting");
 * ```
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

/**
 * Creates a simplified vector search system for semantic search use cases.
 *
 * This is a convenience function that wraps `createAISystem` with simpler configuration.
 * Perfect for projects that only need vector search and embeddings.
 *
 * @param config Simplified configuration object
 * @param config.lancedbPath Path to LanceDB database (local path or db:// URL)
 * @param config.openaiApiKey OpenAI API key for embeddings
 * @param config.claudeApiKey Optional Claude API key for LLM features
 * @returns Promise resolving to vector search system with convenience methods
 *
 * @example
 * ```ts
 * const vectorSystem = await createVectorSearchSystem({
 *   lancedbPath: "./vectors",
 *   openaiApiKey: Deno.env.get("OPENAI_API_KEY")!
 * });
 *
 * await vectorSystem.addDocuments([
 *   { id: "1", content: "Deno is a modern runtime" },
 *   { id: "2", content: "Vector databases enable semantic search" }
 * ]);
 *
 * const results = await vectorSystem.search("JavaScript runtime", { limit: 5 });
 * ```
 */
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

/**
 * Creates a complete Retrieval-Augmented Generation (RAG) system with AI agent.
 *
 * This high-level function sets up everything needed for RAG: vector storage, embeddings,
 * LLM, and an AI agent with search capabilities. The agent automatically searches your
 * document store to answer questions with relevant context.
 *
 * @param config RAG system configuration
 * @param config.lancedbPath Path to LanceDB database for document storage
 * @param config.openaiApiKey OpenAI API key for generating embeddings
 * @param config.claudeApiKey Claude API key for LLM responses
 * @param config.systemPrompt Optional custom system prompt for the RAG agent
 * @returns Promise resolving to RAG system with agent and ask() method
 *
 * @example
 * ```ts
 * const ragSystem = await createRAGSystem({
 *   lancedbPath: "./knowledge-base",
 *   openaiApiKey: Deno.env.get("OPENAI_API_KEY")!,
 *   claudeApiKey: Deno.env.get("CLAUDE_API_KEY")!
 * });
 *
 * // Index documents
 * await ragSystem.addDocuments([
 *   { id: "1", content: "Deno is a secure runtime for JavaScript and TypeScript" },
 *   { id: "2", content: "Vector databases enable semantic search over embeddings" }
 * ]);
 *
 * // Ask questions - agent searches automatically
 * const answer = await ragSystem.ask("What is Deno?");
 * console.log(answer.content);
 * ```
 */
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

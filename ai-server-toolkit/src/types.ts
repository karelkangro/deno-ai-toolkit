// Core types for the AI Server Toolkit

// Ports & Adapters Interfaces - Moved to top for visibility
export interface VectorStore {
  addDocument(doc: VectorDocument, tableName?: string): Promise<void>;
  addDocuments(docs: VectorDocument[], tableName?: string): Promise<void>;
  search(query: string, options?: SearchOptions, tableName?: string): Promise<SearchResult[]>;
  searchByEmbedding(
    embedding: number[],
    options?: SearchOptions,
    tableName?: string,
  ): Promise<SearchResult[]>;
  /**
   * Hybrid search combining vector (semantic) + full-text (BM25) results,
   * fused via Reciprocal Rank Fusion. Solves vector-search blind spots for
   * proper nouns, codes, dates, and rare terms.
   *
   * Requires an FTS index on the `content` column. Call {@link ensureFtsIndex}
   * once per table before invoking this method.
   */
  searchHybrid(
    query: string,
    options?: HybridSearchOptions,
    tableName?: string,
  ): Promise<HybridSearchResult[]>;
  /**
   * Create an FTS (BM25) index on the `content` column if it does not exist.
   * Idempotent. Required before calling {@link searchHybrid}.
   */
  ensureFtsIndex(tableName?: string): Promise<void>;
  getDocument(id: string, tableName?: string): Promise<VectorDocument | null>;
  deleteDocument(id: string, tableName?: string): Promise<void>;
  updateDocument(doc: VectorDocument, tableName?: string): Promise<void>;
  createTable(tableName: string, schemaDefinitionDocument?: VectorDocument): Promise<void>;
  deleteTable(tableName: string): Promise<void>;
  getStats(tableName?: string): Promise<VectorStoreStats>;
  listTables(): Promise<string[]>;
  clear(tableName?: string): Promise<void>;
}

export interface LLMModel {
  generateResponse(
    messages: LLMMessage[],
    tools?: ToolDefinition[],
    options?: GenerateResponseOptions,
  ): Promise<LLMResponse>;
  streamResponse(
    messages: LLMMessage[],
    onChunk?: (chunk: string) => void,
    tools?: ToolDefinition[],
  ): Promise<LLMResponse>;
}

export interface EmbeddingModel {
  embedText(text: string): Promise<number[]>;
  embedTexts(texts: string[]): Promise<number[][]>;
}

// Domain Types

export interface VectorDocument {
  id: string;
  content: string;
  metadata?: Record<string, unknown>;
  embedding?: number[];
}

export interface SearchResult {
  id: string;
  content: string;
  metadata?: Record<string, unknown>;
  score: number;
  // General index signature for compatibility with Record<string, unknown>
  [key: string]: unknown;
}

export interface SearchOptions {
  limit?: number;
  threshold?: number;
  filter?: Record<string, unknown> | string; // Can be object or SQL WHERE string
  includeEmbeddings?: boolean;
}

export interface HybridSearchOptions extends SearchOptions {
  /**
   * RRF constant. Higher values flatten the contribution of top ranks.
   * Defaults to 60 (Cormack et al., the de facto standard).
   */
  rrfK?: number;
  /**
   * Multiplier applied to {@link SearchOptions.limit} when fetching candidate
   * pools from each retriever before RRF fusion. Higher = better fusion quality
   * at the cost of latency. Defaults to 4.
   */
  candidateMultiplier?: number;
}

export interface HybridSearchResult extends SearchResult {
  /** Cosine similarity from vector search (undefined if not in vector pool). */
  vectorScore?: number;
  /** BM25 score from full-text search (undefined if not in FTS pool). */
  ftsScore?: number;
  /** 1-based rank in vector pool (undefined if not present). */
  vectorRank?: number;
  /** 1-based rank in FTS pool (undefined if not present). */
  ftsRank?: number;
  /** Reciprocal Rank Fusion composite score; this is also `score`. */
  rrfScore: number;
}

export interface VectorStoreConfig {
  provider: "lancedb" | "pinecone" | "chroma";
  path?: string;
  apiKey?: string;
  environment?: string;
  dimensions?: number;
  region?: string;
  tableName?: string;
}

export interface EmbeddingConfig {
  provider: "openai" | "local";
  apiKey?: string;
  model?: string;
  dimensions?: number;
  maxTokens?: number;
}

export interface LLMMessage {
  role: "system" | "user" | "assistant";
  content: string;
  metadata?: Record<string, unknown>;
}

export interface CacheControl {
  type: "ephemeral" | "ephemeral-1h";
}

export interface SystemMessageBlock {
  type: "text";
  text: string;
  cache_control?: CacheControl;
}

export interface LLMConfig {
  provider: "claude" | "openai" | "local";
  apiKey: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
}

export interface LLMResponse {
  content: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    cacheCreationInputTokens?: number;
    cacheReadInputTokens?: number;
  };
  metadata?: Record<string, unknown>;
}

export interface ToolDefinition<
  TParams = Record<string, unknown>,
  TResult = unknown,
> {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  handler: (params: TParams) => Promise<TResult> | TResult;
}

export interface AgentConfig {
  name: string;
  description: string;
  systemPrompt: string;
  tools?: ToolDefinition[];
  llm: LLMConfig | LLMModel;
  memory?: boolean;
}

export interface AgentResult {
  success: boolean;
  content: string;
  toolCalls?: Array<{
    tool: string;
    params: Record<string, unknown>;
    result: unknown;
  }>;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  error?: string;
}

export interface RateLimitConfig {
  requestsPerMinute: number;
  requestsPerHour?: number;
  requestsPerDay?: number;
}

export interface VectorStoreStats {
  totalDocuments: number;
  totalSize: number;
  lastUpdated: Date;
}

export interface GenerateResponseOptions {
  system?: SystemMessageBlock[];
  cacheControl?: {
    type: "ephemeral" | "ephemeral-1h";
  };
}

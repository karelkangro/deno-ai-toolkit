// Core types for the AI Server Toolkit
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
}

export interface SearchOptions {
  limit?: number;
  threshold?: number;
  filter?: Record<string, any>;
  includeEmbeddings?: boolean;
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
  llm: LLMConfig;
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

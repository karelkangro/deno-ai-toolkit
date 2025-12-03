// AI Server Toolkit - Complete functional toolkit for AI-powered Deno servers
import { type AgentState, createSearchTool, runAgent } from "./src/agents/base.ts";
import type {
  AgentConfig,
  AgentResult,
  EmbeddingModel,
  LLMMessage,
  LLMModel,
  SearchOptions,
  SearchResult,
  VectorDocument,
  VectorStore,
} from "./src/types.ts";

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
  createAndEmbedDocument,
  createWorkspaceCoordinated,
  deleteDocumentCoordinated,
  deleteWorkspaceCoordinated,
  embedDocumentAndUpdateStatus,
  listWorkspacesCoordinated,
  reembedIfContentChanged,
  updateWorkspaceCoordinated,
} from "./src/workspace/coordinator.ts";

// Rules management types and functions (NEW)
export * from "./src/rules/types.ts";
export { evaluateCondition, evaluateRule, filterApplicableRules } from "./src/rules/evaluator.ts";
export { addRule, deleteRule, updateRule } from "./src/rules/kv-store.ts";
export {
  getRule as getBusinessRule,
  listRules as listBusinessRules,
} from "./src/rules/kv-store.ts";

// Import types and functions needed for wrapper functions
import type { WorkspaceKVState } from "./src/workspace/types.ts";
import type {
  BusinessRule,
  Rule,
  RuleMetadataSchema,
  RuleScope,
  RuleTarget,
} from "./src/rules/types.ts";
import {
  addRule,
  getRule as getBusinessRuleFromKV,
  listRules as listBusinessRulesFromKV,
} from "./src/rules/kv-store.ts";
import { detectSimpleConflicts } from "./src/rules/validator.ts";

// Wrapper functions to convert between BusinessRule and Rule types
export async function getRule(
  kvState: WorkspaceKVState,
  _workspaceId: string,
  ruleId: string,
): Promise<Rule | null> {
  const businessRule = await getBusinessRuleFromKV(kvState, ruleId);
  if (!businessRule) return null;

  return {
    id: businessRule.id,
    name: businessRule.name,
    category: (businessRule.metadata?.category as string) || "",
    severity: (businessRule.metadata?.severity as "critical" | "high" | "medium" | "low") ||
      "medium",
    enabled: businessRule.active,
    content: businessRule.description || "",
    keywords: (businessRule.metadata?.keywords as string[]) || [],
    schemaId: (businessRule.metadata?.schemaId as string) || "",
    version: 1,
    data: (businessRule.metadata?.data as Record<string, unknown>) || {},
    createdAt: businessRule.createdAt,
    updatedAt: businessRule.updatedAt,
  } as Rule;
}

export async function listRules(
  kvState: WorkspaceKVState,
  workspaceId: string,
  filters?: RuleFilters,
): Promise<Rule[]> {
  const businessRules = await listBusinessRulesFromKV(kvState, workspaceId);
  let rules = businessRules.map((br) => ({
    id: br.id,
    name: br.name,
    category: (br.metadata?.category as string) || "",
    severity: (br.metadata?.severity as "critical" | "high" | "medium" | "low") || "medium",
    enabled: br.active,
    content: br.description || "",
    keywords: (br.metadata?.keywords as string[]) || [],
    schemaId: (br.metadata?.schemaId as string) || "",
    version: 1,
    data: (br.metadata?.data as Record<string, unknown>) || {},
    createdAt: br.createdAt,
    updatedAt: br.updatedAt,
    workspaceId: br.workspaceId,
    metadata: br.metadata,
  }));

  // Apply filters if provided
  if (filters) {
    if (filters.category) {
      rules = rules.filter((r) => r.category === filters.category);
    }
    if (filters.severity) {
      rules = rules.filter((r) => r.severity === filters.severity);
    }
    if (filters.enabled !== undefined) {
      rules = rules.filter((r) => r.enabled === filters.enabled);
    }
  }

  return rules;
}

// Wrapper for compatibility - converts CreateRuleRequest to BusinessRule format
export type CreateRuleRequest = Omit<Rule, "id" | "createdAt" | "updatedAt"> & {
  workspaceId: string;
  schemaId: string;
  metadata?: Record<string, unknown>;
};

export async function createRule(
  kvState: WorkspaceKVState,
  request: CreateRuleRequest,
): Promise<Rule> {
  // Convert CreateRuleRequest to BusinessRule format for addRule
  const businessRule: Omit<BusinessRule, "id" | "createdAt" | "updatedAt"> = {
    name: request.name,
    description: request.content,
    workspaceId: request.workspaceId,
    target: "WORKSPACE" as RuleTarget,
    scope: "RESTRICTION" as RuleScope,
    conditions: [],
    priority: 0,
    active: request.enabled ?? true,
    metadata: {
      category: request.category,
      severity: request.severity,
      schemaId: request.schemaId,
      keywords: request.keywords,
      data: request.data,
      ...request.metadata,
    },
  };

  const addedRule = await addRule(kvState, businessRule);

  // Convert BusinessRule back to Rule format
  const rule: Rule = {
    id: addedRule.id,
    name: addedRule.name,
    category: (addedRule.metadata?.category as string) || "",
    severity: (addedRule.metadata?.severity as "critical" | "high" | "medium" | "low") || "medium",
    enabled: addedRule.active,
    content: addedRule.description || "",
    keywords: (addedRule.metadata?.keywords as string[]) || [],
    schemaId: (addedRule.metadata?.schemaId as string) || "",
    version: 1,
    data: (addedRule.metadata?.data as Record<string, unknown>) || {},
    createdAt: addedRule.createdAt,
    updatedAt: addedRule.updatedAt,
  };

  // Add optional fields if they exist
  if (addedRule.workspaceId) {
    (rule as Rule & { workspaceId?: string }).workspaceId = addedRule.workspaceId;
  }
  if (addedRule.metadata) {
    (rule as Rule & { metadata?: Record<string, unknown> }).metadata = addedRule.metadata;
  }

  return rule;
}

// Export rule validation and vector store functions
export { detectSimpleConflicts, validateRuleAgainstSchema } from "./src/rules/validator.ts";
export {
  deleteRuleFromVectorStore,
  embedRule,
  embedRules,
  getRelevantRules,
  initializeRulesVectorTable,
  searchRulesVector,
} from "./src/rules/vector-store.ts";

// Schema management functions - TODO: Implement properly
export type CreateRuleSchemaRequest = {
  workspaceId: string;
  schemaName: string;
  schemaVersion?: string;
  description?: string;
  fields: Array<{
    name: string;
    type: "string" | "number" | "boolean" | "array" | "object" | "enum";
    required: boolean;
    description?: string;
    defaultValue?: unknown;
    enumValues?: string[];
    validation?: Record<string, unknown> | {
      min?: number;
      max?: number;
      pattern?: string;
    };
  }>;
};

export type UpdateRuleRequest = Partial<Omit<Rule, "id" | "createdAt">> & {
  id: string;
  workspaceId: string;
};

export type RuleFilters = {
  workspaceId?: string;
  category?: string;
  severity?: string;
  enabled?: boolean;
};

export type RuleStats = {
  total: number;
  byCategory: Record<string, number>;
  bySeverity: Record<string, number>;
};

// Stub implementations - TODO: Implement properly
export async function createRuleSchema(
  kvState: WorkspaceKVState,
  request: CreateRuleSchemaRequest,
): Promise<RuleMetadataSchema> {
  // Temporary implementation - creates schema in KV
  const schemaId = crypto.randomUUID();
  const now = new Date().toISOString();
  const schema: RuleMetadataSchema = {
    id: schemaId,
    name: request.schemaName,
    description: request.description,
    fields: request.fields.map((f) => ({
      name: f.name,
      type: f.type === "object" ? "string" : f.type, // RuleField doesn't support "object"
      required: f.required,
      description: f.description,
      enumValues: f.enumValues,
      validation:
        typeof f.validation === "object" && f.validation !== null && !Array.isArray(f.validation)
          ? (f.validation as { min?: number; max?: number; pattern?: string })
          : undefined,
    })),
    createdAt: now,
    updatedAt: now,
  };

  if (request.workspaceId) {
    await kvState.kv.set(
      ["rule-schemas", request.workspaceId, schemaId],
      schema,
    );
  }

  return schema;
}

export async function getRuleSchema(
  kvState: WorkspaceKVState,
  workspaceId: string,
  schemaId: string,
): Promise<RuleMetadataSchema | null> {
  const result = await kvState.kv.get<RuleMetadataSchema>([
    "rule-schemas",
    workspaceId,
    schemaId,
  ]);
  return result.value;
}

export async function listRuleSchemas(
  kvState: WorkspaceKVState,
  workspaceId: string,
): Promise<RuleMetadataSchema[]> {
  const schemas: RuleMetadataSchema[] = [];
  const entries = kvState.kv.list<RuleMetadataSchema>({
    prefix: ["rule-schemas", workspaceId],
  });

  for await (const entry of entries) {
    schemas.push(entry.value);
  }

  return schemas;
}

export async function deleteRuleSchema(
  _kvState: WorkspaceKVState,
  _workspaceId: string,
  _schemaId: string,
): Promise<boolean> {
  throw new Error("deleteRuleSchema not yet implemented in toolkit");
}

export async function getRuleStats(
  _kvState: WorkspaceKVState,
  _workspaceId: string,
): Promise<RuleStats> {
  throw new Error("getRuleStats not yet implemented in toolkit");
}

export async function listRuleConflicts(
  kvState: WorkspaceKVState,
  workspaceId: string,
): Promise<Array<{ rule1: Rule; rule2: Rule; reason: string }>> {
  const rules = await listRules(kvState, workspaceId);
  // Use detectSimpleConflicts as a fallback
  const conflicts = detectSimpleConflicts(rules);
  return conflicts.map((c) => ({
    rule1: c.rule1 as Rule,
    rule2: c.rule2 as Rule,
    reason: c.reason,
  }));
}

// Product management types and functions (NEW)
export {
  type Product,
  type ProductCategory,
  type ProductConfiguration,
  type ProductEvaluationContext,
  type ProductEvaluationResult,
  type ProductMetadata,
  type ProductRestriction,
} from "./src/products/mod.ts";
export {
  addCategory,
  addConfiguration,
  addProduct,
  addRestriction,
  checkProductRestrictions,
  deleteCategory,
  deleteConfiguration,
  deleteProduct,
  deleteRestriction,
  evaluateProductMetadata,
  evaluateProductRules,
  getCategory,
  getConfiguration,
  getProduct,
  getRestriction,
  listCategories,
  listConfigurations,
  listProducts,
  listRestrictions,
  updateCategory,
  updateConfiguration,
  updateProduct,
} from "./src/products/mod.ts";

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
} from "./src/embeddings/openai.ts";

// LLM functionality
export { createClaudeLLM, generateResponse, streamResponse } from "./src/llm/claude.ts";

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
export {
  contentTypeToMimeType,
  extractContentFromMetadata,
  storeContentInMetadata,
} from "./src/utils/document.ts";

// Logger functionality
export { createSubLogger, logger } from "./src/utils/logger.ts";

// High-level factory functions for easy setup

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
    tools?: import("./src/types.ts").ToolDefinition[],
  ) => Promise<import("./src/types.ts").LLMResponse>;
  createAgent: (config: AgentConfig) => AgentState;
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
      tools?: import("./src/types.ts").ToolDefinition[],
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
    tools?: import("./src/types.ts").ToolDefinition[],
  ) => Promise<import("./src/types.ts").LLMResponse>;
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
    tools?: import("./src/types.ts").ToolDefinition[],
  ) => Promise<import("./src/types.ts").LLMResponse>;
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
      }) as import("./src/types.ts").ToolDefinition,
    ],

    llm: system.llm, // Pass the LLMModel instance directly
  });

  return {
    ...system,
    agent,
    async ask(question: string, context?: Record<string, unknown>) {
      return await runAgent(agent, question, context);
    },
  };
}

/**
 * Vector store module exports
 *
 * @since 1.11.0
 */

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
} from "../vector-store/lancedb.ts";

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
} from "../vector-store/schemas.ts";

// Schema registry for multi-table workspace management
export {
  createWorkspaceTableRegistry,
  type TableConfig,
  type WorkspaceTableRegistry,
} from "../vector-store/schema-registry.ts";

// Vector database connection management
export {
  createDefaultConnectionManager,
  createVectorDBConnectionManager,
  type VectorDBConnectionConfig,
  type VectorDBConnectionManager,
} from "../vector-store/connection-manager.ts";


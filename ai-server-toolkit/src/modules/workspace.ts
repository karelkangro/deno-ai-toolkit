/**
 * Workspace management module exports
 *
 * @since 1.4.0
 */

export * from "../workspace/types.ts";
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
} from "../workspace/kv-store.ts";
export {
  createAndEmbedDocument,
  createWorkspaceCoordinated,
  deleteDocumentCoordinated,
  deleteWorkspaceCoordinated,
  embedDocumentAndUpdateStatus,
  listWorkspacesCoordinated,
  reembedIfContentChanged,
  updateWorkspaceCoordinated,
} from "../workspace/coordinator.ts";

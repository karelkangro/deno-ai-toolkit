// Workspace management types for multi-tenant AI systems
// These types define workspace metadata, documents, and storage configuration

/**
 * Core workspace metadata stored in KV store
 */
export interface Workspace {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  documentCount: number;
  embeddedCount: number;
  metadata?: Record<string, unknown>;
}

/**
 * Document metadata stored in KV store (file content stored separately)
 */
export interface WorkspaceDocument {
  id: string;
  workspaceId: string;
  name: string;
  originalName: string;
  storageKey: string; // Key/path in file storage (S3, etc.)
  fileSize: number;
  mimeType: string;
  status: DocumentStatus;
  uploadedAt: string;
  embeddedAt?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Document processing status
 */
export type DocumentStatus = "uploaded" | "processing" | "embedded" | "error";

/**
 * Request to create a new workspace
 */
export interface CreateWorkspaceRequest {
  name: string;
  description: string;
  metadata?: Record<string, unknown>;
}

/**
 * Request to update workspace metadata
 */
export interface UpdateWorkspaceRequest {
  name?: string;
  description?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Workspace statistics
 */
export interface WorkspaceStats {
  totalDocuments: number;
  uploadedDocuments: number;
  embeddedDocuments: number;
  processingDocuments: number;
  errorDocuments: number;
  totalSize: number;
}

/**
 * Configuration for workspace storage
 */
export interface WorkspaceStoreConfig {
  provider: "deno-kv";
  path?: string; // Optional path for local KV, omit for Deno Deploy cloud KV
}

/**
 * Workspace KV state object (functional programming pattern)
 */
export interface WorkspaceKVState {
  kv: Deno.Kv;
  config: WorkspaceStoreConfig;
}

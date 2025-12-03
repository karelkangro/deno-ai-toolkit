// Workspace Coordinator - Orchestrates KV storage, Vector DB, and File Storage
// Provides high-level workspace operations that coordinate across all storage layers

import type { LanceDBState } from "../vector-store/lancedb.ts";
import { createWorkspaceTable, deleteWorkspaceTable } from "../vector-store/lancedb.ts";
import type { FileStorageState } from "../storage/types.ts";
import { deleteFile } from "../storage/s3.ts";
import type {
  CreateWorkspaceRequest,
  UpdateWorkspaceRequest,
  Workspace,
  WorkspaceDocument,
  WorkspaceKVState,
} from "./types.ts";
import { createSubLogger } from "../utils/logger.ts";

const logger = createSubLogger("workspace-coordinator");

import {
  createWorkspace as kvCreateWorkspace,
  deleteDocument as kvDeleteDocument,
  deleteWorkspace as kvDeleteWorkspace,
  getWorkspace,
  listDocuments,
  listWorkspaces,
  updateWorkspace as kvUpdateWorkspace,
} from "./kv-store.ts";

/**
 * Coordinated workspace creation
 *
 * Creates workspace in KV, then creates vector DB table.
 * If vector DB creation fails, workspace remains in KV with status flag.
 *
 * @param kvState Workspace KV state
 * @param vectorState LanceDB state
 * @param request Workspace creation request
 * @returns Promise resolving to created workspace
 */
export async function createWorkspaceCoordinated(
  kvState: WorkspaceKVState,
  vectorState: LanceDBState,
  request: CreateWorkspaceRequest,
): Promise<Workspace> {
  // Create workspace in KV first
  const workspace = await kvCreateWorkspace(kvState, {
    ...request,
    metadata: {
      ...request.metadata,
      vectorDbStatus: "pending",
    },
  });

  // Create vector DB table
  try {
    await createWorkspaceTable(vectorState, workspace.id);
    logger.info("Created vector table for workspace", { workspaceId: workspace.id });

    // Update status
    await kvUpdateWorkspace(kvState, workspace.id, {
      metadata: {
        ...workspace.metadata,
        vectorDbStatus: "ready",
      },
    });
  } catch (error) {
    logger.error("Vector DB creation failed", error, { workspaceId: workspace.id });
    // Workspace exists but vector DB pending - can retry later
    await kvUpdateWorkspace(kvState, workspace.id, {
      metadata: {
        ...workspace.metadata,
        vectorDbStatus: "failed",
        vectorDbError: error instanceof Error ? error.message : "Unknown error",
      },
    });
  }

  return workspace;
}

/**
 * Coordinated workspace deletion
 *
 * Deletes in order: Vector DB → File Storage → KV metadata
 * This prevents orphaned expensive resources if metadata deletion fails.
 *
 * @param kvState Workspace KV state
 * @param vectorState LanceDB state
 * @param storageState File storage state (optional)
 * @param workspaceId Workspace ID to delete
 * @returns Promise resolving to true if deleted
 */
export async function deleteWorkspaceCoordinated(
  kvState: WorkspaceKVState,
  vectorState: LanceDBState,
  storageState: FileStorageState | null,
  workspaceId: string,
): Promise<boolean> {
  const workspace = await getWorkspace(kvState, workspaceId);
  if (!workspace) return false;

  // Delete vector DB table first (expensive resource)
  // Non-fatal: if table deletion fails, log warning but continue with KV deletion
  let lancedbDeleted = false;
  try {
    await deleteWorkspaceTable(vectorState, workspaceId);
    logger.info("Deleted vector table", { workspaceId });
    lancedbDeleted = true;
  } catch (error) {
    logger.warn("Vector DB deletion failed (non-fatal, continuing with KV deletion)", {
      workspaceId,
      error: error instanceof Error ? error.message : String(error),
    });
    // Continue with KV deletion even if LanceDB deletion fails
  }

  // Batch delete files from storage (if storage configured)
  // Parallel deletion instead of sequential for better performance
  if (storageState) {
    try {
      const documents = await listDocuments(kvState, workspaceId);
      logger.debug("Batch deleting files from storage", {
        workspaceId,
        fileCount: documents.length,
      });

      // Create parallel deletion promises
      const fileDeletions = documents.map(async (doc) => {
        try {
          await deleteFile(storageState!, doc.storageKey);
          logger.debug("Deleted file", { documentId: doc.id, storageKey: doc.storageKey });
        } catch (error) {
          logger.error("File deletion failed", error, {
            documentId: doc.id,
            storageKey: doc.storageKey,
          });
          // Continue with other files - don't throw
        }
      });

      // Execute all file deletions in parallel
      await Promise.all(fileDeletions);
      logger.info("Batch deleted files from storage", {
        workspaceId,
        fileCount: documents.length,
      });
    } catch (error) {
      logger.error("Failed to batch delete files from storage", error, { workspaceId });
      // Continue with KV deletion even if file deletion fails
    }
  }

  // Delete KV metadata last (if this fails, we can retry)
  const deleted = await kvDeleteWorkspace(kvState, workspaceId);

  if (!deleted) {
    throw new Error(`Failed to delete workspace metadata: ${workspaceId}`);
  }

  // Return true if KV deletion succeeded, even if LanceDB deletion failed
  if (!lancedbDeleted) {
    logger.warn("Workspace KV deleted successfully, but LanceDB table deletion failed", {
      workspaceId,
    });
  }

  return true;
}

/**
 * List all workspaces with enhanced info
 */
export async function listWorkspacesCoordinated(
  kvState: WorkspaceKVState,
  options?: { limit?: number },
): Promise<Workspace[]> {
  return await listWorkspaces(kvState, options);
}

/**
 * Update workspace with coordination
 */
export async function updateWorkspaceCoordinated(
  kvState: WorkspaceKVState,
  workspaceId: string,
  updates: UpdateWorkspaceRequest,
): Promise<Workspace | null> {
  return await kvUpdateWorkspace(kvState, workspaceId, updates);
}

/**
 * Coordinated document deletion
 *
 * Deletes document from: File Storage → Vector DB → KV metadata
 *
 * @param kvState Workspace KV state
 * @param vectorState LanceDB state
 * @param storageState File storage state (optional)
 * @param workspaceId Workspace ID
 * @param documentId Document ID
 * @returns Promise resolving to true if deleted
 */
export async function deleteDocumentCoordinated(
  kvState: WorkspaceKVState,
  vectorState: LanceDBState,
  storageState: FileStorageState | null,
  workspaceId: string,
  documentId: string,
): Promise<boolean> {
  // Get document metadata
  const { getDocument } = await import("./kv-store.ts");

  const doc = await getDocument(kvState, workspaceId, documentId);

  if (!doc) {
    return false;
  }

  // Delete from file storage
  if (storageState) {
    try {
      await deleteFile(storageState, doc.storageKey);
      logger.debug("Deleted file", { documentId: doc.id, storageKey: doc.storageKey });
    } catch (error) {
      logger.error("File deletion failed", error, {
        documentId: doc.id,
        storageKey: doc.storageKey,
      });
      // Continue anyway
    }
  }

  // Delete from vector DB
  try {
    const { deleteWorkspaceDocument } = await import("../vector-store/lancedb.ts");
    await deleteWorkspaceDocument(vectorState, workspaceId, documentId);
    logger.debug("Deleted vector embedding", { documentId });
  } catch (error) {
    logger.error("Vector deletion failed", error, { documentId: doc.id });
    // Continue anyway
  }

  // Delete from KV metadata
  return await kvDeleteDocument(kvState, workspaceId, documentId);
}

/**
 * Embedding workflow helpers
 * Coordinated operations for document embedding with status updates
 */

import type { VectorDocument } from "../types.ts";
import { addWorkspaceDocument } from "../vector-store/lancedb.ts";
import type { DocumentStatus } from "./types.ts";
import { getDocument, updateDocument } from "./kv-store.ts";
import { extractContentFromMetadata } from "../utils/document.ts";

/**
 * Embed a document and update its status in KV
 *
 * Reads content from WorkspaceDocument.metadata.content, embeds it in vector store,
 * then updates document status to "embedded" in KV.
 *
 * @param kvState Workspace KV state
 * @param vectorState LanceDB state
 * @param workspaceId Workspace ID
 * @param documentId Document ID
 * @param options Optional embedding options
 * @returns Promise resolving to updated WorkspaceDocument
 *
 * @example
 * ```ts
 * const updated = await embedDocumentAndUpdateStatus(
 *   kvState,
 *   vectorState,
 *   "workspace_123",
 *   "doc_456"
 * );
 * ```
 */
export async function embedDocumentAndUpdateStatus(
  kvState: WorkspaceKVState,
  vectorState: LanceDBState,
  workspaceId: string,
  documentId: string,
  options?: {
    embeddingModel?: string;
  },
): Promise<WorkspaceDocument | null> {
  const doc = await getDocument(kvState, workspaceId, documentId);
  if (!doc) {
    return null;
  }

  // Extract content from metadata
  const content = extractContentFromMetadata(doc);
  if (!content) {
    logger.warn("Document has no content to embed", { documentId });
    return doc;
  }

  // Create vector document
  const vectorDoc: VectorDocument = {
    id: doc.id,
    content,
    metadata: {
      workspaceId: doc.workspaceId,
      ...doc.metadata,
    },
  };

  // Add to vector store
  await addWorkspaceDocument(vectorState, workspaceId, vectorDoc);

  // Update status in KV
  const updated = await updateDocument(kvState, workspaceId, documentId, {
    status: "embedded" as DocumentStatus,
    embeddedAt: new Date().toISOString(),
    metadata: {
      ...doc.metadata,
      embedded: true,
      embeddingModel: options?.embeddingModel || "text-embedding-3-small",
      updatedAt: new Date().toISOString(),
    },
  });

  logger.info("Document embedded and status updated", { documentId, workspaceId });
  return updated;
}

/**
 * Create document and embed it immediately
 *
 * Creates WorkspaceDocument in KV, then embeds it in vector store.
 * If embedding fails, document remains in KV with "uploaded" status.
 *
 * @param kvState Workspace KV state
 * @param vectorState LanceDB state
 * @param document Document metadata to create
 * @param options Optional options for embedding
 * @returns Promise resolving to created and embedded WorkspaceDocument
 *
 * @example
 * ```ts
 * const doc = await createAndEmbedDocument(
 *   kvState,
 *   vectorState,
 *   {
 *     workspaceId: "workspace_123",
 *     name: "Document Title",
 *     storageKey: "s3://bucket/key",
 *     fileSize: 1024,
 *     mimeType: "text/plain",
 *     status: "uploaded" as DocumentStatus,
 *     uploadedAt: new Date().toISOString(),
 *     metadata: { content: "document content here" }
 *   },
 *   { embedImmediately: true }
 * );
 * ```
 */
export async function createAndEmbedDocument(
  kvState: WorkspaceKVState,
  vectorState: LanceDBState,
  document: Omit<WorkspaceDocument, "id">,
  options?: {
    embedImmediately?: boolean;
    embeddingModel?: string;
  },
): Promise<WorkspaceDocument> {
  const { addDocument } = await import("./kv-store.ts");

  // Create document in KV
  const created = await addDocument(kvState, document);

  // Embed immediately if requested
  if (options?.embedImmediately !== false) {
    try {
      await embedDocumentAndUpdateStatus(
        kvState,
        vectorState,
        created.workspaceId,
        created.id,
        { embeddingModel: options?.embeddingModel },
      );
    } catch (error) {
      logger.error("Failed to embed document immediately", error, {
        documentId: created.id,
      });
      // Document remains in KV with "uploaded" status - can retry later
    }
  }

  return created;
}

/**
 * Re-embed document if content has changed
 *
 * Checks if content in metadata has changed, and if so, re-embeds the document.
 * Updates vector store and document status.
 *
 * @param kvState Workspace KV state
 * @param vectorState LanceDB state
 * @param workspaceId Workspace ID
 * @param documentId Document ID
 * @param newContent New content to check against
 * @param options Optional options
 * @returns Promise resolving to true if re-embedded, false if not needed
 *
 * @example
 * ```ts
 * const reembedded = await reembedIfContentChanged(
 *   kvState,
 *   vectorState,
 *   "workspace_123",
 *   "doc_456",
 *   "new content here"
 * );
 * ```
 */
export async function reembedIfContentChanged(
  kvState: WorkspaceKVState,
  vectorState: LanceDBState,
  workspaceId: string,
  documentId: string,
  newContent: string,
  options?: {
    embeddingModel?: string;
  },
): Promise<boolean> {
  const doc = await getDocument(kvState, workspaceId, documentId);
  if (!doc) {
    return false;
  }

  const currentContent = extractContentFromMetadata(doc);
  if (currentContent === newContent) {
    logger.debug("Content unchanged, skipping re-embedding", { documentId });
    return false;
  }

  // Update content in metadata first
  const { storeContentInMetadata } = await import("../utils/document.ts");
  await updateDocument(kvState, workspaceId, documentId, {
    metadata: storeContentInMetadata(doc.metadata, newContent),
    status: "uploaded" as DocumentStatus, // Reset to uploaded before re-embedding
  });

  // Re-embed
  await embedDocumentAndUpdateStatus(
    kvState,
    vectorState,
    workspaceId,
    documentId,
    { embeddingModel: options?.embeddingModel },
  );

  logger.info("Document re-embedded due to content change", { documentId });
  return true;
}

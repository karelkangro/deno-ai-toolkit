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
  WorkspaceKVState,
} from "./types.ts";
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
    console.log(`✅ Created vector table for workspace: ${workspace.id}`);

    // Update status
    await kvUpdateWorkspace(kvState, workspace.id, {
      metadata: {
        ...workspace.metadata,
        vectorDbStatus: "ready",
      },
    });
  } catch (error) {
    console.error(`⚠️ Vector DB creation failed for ${workspace.id}:`, error);
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
  try {
    await deleteWorkspaceTable(vectorState, workspaceId);
    console.log(`✅ Deleted vector table: ${workspaceId}`);
  } catch (error) {
    console.error(`⚠️ Vector DB deletion failed for ${workspaceId}:`, error);
    throw new Error(
      `Failed to delete vector database for workspace ${workspaceId}`,
    );
  }

  // Delete files from storage (if storage configured)
  if (storageState) {
    const documents = await listDocuments(kvState, workspaceId);

    for (const doc of documents) {
      try {
        await deleteFile(storageState, doc.storageKey);
        console.log(`✅ Deleted file: ${doc.storageKey}`);
      } catch (error) {
        console.error(`⚠️ File deletion failed for ${doc.id}:`, error);
        // Continue with other files
      }
    }
  }

  // Delete KV metadata last (if this fails, we can retry)
  const deleted = await kvDeleteWorkspace(kvState, workspaceId);

  if (!deleted) {
    throw new Error(`Failed to delete workspace metadata: ${workspaceId}`);
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
      console.log(`✅ Deleted file: ${doc.storageKey}`);
    } catch (error) {
      console.error(`⚠️ File deletion failed for ${doc.id}:`, error);
      // Continue anyway
    }
  }

  // Delete from vector DB
  try {
    const { deleteWorkspaceDocument } = await import("../vector-store/lancedb.ts");
    await deleteWorkspaceDocument(vectorState, workspaceId, documentId);
    console.log(`✅ Deleted vector embedding: ${documentId}`);
  } catch (error) {
    console.error(`⚠️ Vector deletion failed for ${doc.id}:`, error);
    // Continue anyway
  }

  // Delete from KV metadata
  return await kvDeleteDocument(kvState, workspaceId, documentId);
}

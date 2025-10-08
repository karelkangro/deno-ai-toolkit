// Deno KV-based workspace storage implementation
// Provides CRUD operations for workspace metadata and document registry
// Follows functional programming patterns consistent with the toolkit

import type {
  CreateWorkspaceRequest,
  UpdateWorkspaceRequest,
  Workspace,
  WorkspaceDocument,
  WorkspaceKVState,
  WorkspaceStats,
  WorkspaceStoreConfig,
} from "./types.ts";

/**
 * Generate a short, readable workspace/document ID (8 characters)
 */
export function generateId(): string {
  const uuid = crypto.randomUUID();
  return uuid.replace(/-/g, "").substring(0, 8).toLowerCase();
}

/**
 * Create and initialize Deno KV connection for workspace storage
 *
 * @param config Workspace store configuration
 * @returns Promise resolving to WorkspaceKVState with KV connection
 *
 * @example
 * ```ts
 * // Local KV (development)
 * const kvStore = await createWorkspaceKV({ provider: "deno-kv", path: "./data/kv.db" });
 *
 * // Cloud KV (Deno Deploy)
 * const kvStore = await createWorkspaceKV({ provider: "deno-kv" });
 * ```
 */
export async function createWorkspaceKV(
  config: WorkspaceStoreConfig,
): Promise<WorkspaceKVState> {
  // Open KV with path (local) or without path (Deno Deploy managed KV)
  const kv = config.path ? await Deno.openKv(config.path) : await Deno.openKv();
  console.log(
    `✅ Workspace KV initialized: ${config.path || "Deno Deploy managed KV"}`,
  );
  return { kv, config };
}

/**
 * Close KV connection (cleanup)
 */
export function closeWorkspaceKV(state: WorkspaceKVState): void {
  state.kv.close();
}

// ============================================================================
// WORKSPACE CRUD OPERATIONS
// ============================================================================

/**
 * Create a new workspace
 *
 * Atomically creates workspace metadata in KV store. Does NOT create vector DB table
 * (that should be coordinated separately via createWorkspaceTable from vector-store)
 *
 * @param state Workspace KV state
 * @param request Workspace creation request
 * @returns Promise resolving to created Workspace
 *
 * @example
 * ```ts
 * const workspace = await createWorkspace(kvStore, {
 *   name: "Structural Engineering",
 *   description: "Building codes and regulations"
 * });
 * ```
 */
export async function createWorkspace(
  state: WorkspaceKVState,
  request: CreateWorkspaceRequest,
): Promise<Workspace> {
  const now = new Date().toISOString();
  const workspace: Workspace = {
    id: generateId(),
    name: request.name,
    description: request.description,
    createdAt: now,
    updatedAt: now,
    documentCount: 0,
    embeddedCount: 0,
    metadata: request.metadata,
  };

  // Atomic operation to ensure no ID collision
  const result = await state.kv.atomic()
    .check({ key: ["workspaces", workspace.id], versionstamp: null })
    .set(["workspaces", workspace.id], workspace)
    .commit();

  if (!result.ok) {
    throw new Error(`Workspace ID collision: ${workspace.id}`);
  }

  console.log(`✅ Created workspace: ${workspace.id} (${workspace.name})`);
  return workspace;
}

/**
 * Get workspace by ID
 */
export async function getWorkspace(
  state: WorkspaceKVState,
  workspaceId: string,
): Promise<Workspace | null> {
  const result = await state.kv.get<Workspace>(["workspaces", workspaceId]);
  return result.value;
}

/**
 * List all workspaces
 *
 * @param state Workspace KV state
 * @param options Optional filtering/pagination options
 * @returns Promise resolving to array of workspaces
 */
export async function listWorkspaces(
  state: WorkspaceKVState,
  options?: { limit?: number },
): Promise<Workspace[]> {
  const workspaces: Workspace[] = [];
  const entries = state.kv.list<Workspace>({ prefix: ["workspaces"] });

  let count = 0;
  for await (const entry of entries) {
    workspaces.push(entry.value);
    count++;
    if (options?.limit && count >= options.limit) break;
  }

  return workspaces;
}

/**
 * Update workspace metadata
 *
 * @param state Workspace KV state
 * @param workspaceId Workspace ID to update
 * @param updates Fields to update
 * @returns Promise resolving to updated Workspace or null if not found
 */
export async function updateWorkspace(
  state: WorkspaceKVState,
  workspaceId: string,
  updates: UpdateWorkspaceRequest,
): Promise<Workspace | null> {
  const existing = await getWorkspace(state, workspaceId);
  if (!existing) return null;

  const updated: Workspace = {
    ...existing,
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  await state.kv.set(["workspaces", workspaceId], updated);
  console.log(`✅ Updated workspace: ${workspaceId}`);
  return updated;
}

/**
 * Delete workspace and all associated data
 *
 * WARNING: This deletes workspace metadata and document registry from KV.
 * Vector DB table and file storage should be cleaned up BEFORE calling this.
 *
 * @param state Workspace KV state
 * @param workspaceId Workspace ID to delete
 * @returns Promise resolving to true if deleted, false if not found
 */
export async function deleteWorkspace(
  state: WorkspaceKVState,
  workspaceId: string,
): Promise<boolean> {
  const workspace = await getWorkspace(state, workspaceId);
  if (!workspace) return false;

  // Collect all keys to delete
  const documentKeys: Deno.KvKey[] = [];
  const docEntries = state.kv.list({ prefix: ["documents", workspaceId] });
  for await (const entry of docEntries) {
    documentKeys.push(entry.key);
  }

  // Atomic deletion of workspace and all documents
  let atomic = state.kv.atomic();
  atomic = atomic.delete(["workspaces", workspaceId]);
  for (const key of documentKeys) {
    atomic = atomic.delete(key);
  }

  const result = await atomic.commit();
  if (!result.ok) {
    throw new Error(`Failed to delete workspace: ${workspaceId}`);
  }

  console.log(`✅ Deleted workspace: ${workspaceId} (${documentKeys.length} documents)`);
  return true;
}

// ============================================================================
// DOCUMENT REGISTRY OPERATIONS (metadata only, files stored separately)
// ============================================================================

/**
 * Register a document in workspace
 *
 * Stores document metadata in KV. Actual file content should be stored in file storage (S3, etc.)
 *
 * @param state Workspace KV state
 * @param document Document metadata to register
 * @returns Promise resolving to registered document
 */
export async function addDocument(
  state: WorkspaceKVState,
  document: Omit<WorkspaceDocument, "id">,
): Promise<WorkspaceDocument> {
  const doc: WorkspaceDocument = {
    id: generateId(),
    ...document,
  };

  await state.kv.set(["documents", doc.workspaceId, doc.id], doc);

  // Update workspace document count
  const workspace = await getWorkspace(state, doc.workspaceId);
  if (workspace) {
    await state.kv.set(["workspaces", doc.workspaceId], {
      ...workspace,
      documentCount: workspace.documentCount + 1,
      updatedAt: new Date().toISOString(),
    });
  }

  console.log(`✅ Added document: ${doc.id} to workspace ${doc.workspaceId}`);
  return doc;
}

/**
 * Get document by ID
 */
export async function getDocument(
  state: WorkspaceKVState,
  workspaceId: string,
  documentId: string,
): Promise<WorkspaceDocument | null> {
  const result = await state.kv.get<WorkspaceDocument>([
    "documents",
    workspaceId,
    documentId,
  ]);
  return result.value;
}

/**
 * List documents in workspace
 */
export async function listDocuments(
  state: WorkspaceKVState,
  workspaceId: string,
  options?: { limit?: number },
): Promise<WorkspaceDocument[]> {
  const documents: WorkspaceDocument[] = [];
  const entries = state.kv.list<WorkspaceDocument>({
    prefix: ["documents", workspaceId],
  });

  let count = 0;
  for await (const entry of entries) {
    documents.push(entry.value);
    count++;
    if (options?.limit && count >= options.limit) break;
  }

  return documents;
}

/**
 * Update document metadata (e.g., mark as embedded)
 */
export async function updateDocument(
  state: WorkspaceKVState,
  workspaceId: string,
  documentId: string,
  updates: Partial<WorkspaceDocument>,
): Promise<WorkspaceDocument | null> {
  const existing = await getDocument(state, workspaceId, documentId);
  if (!existing) return null;

  const updated: WorkspaceDocument = {
    ...existing,
    ...updates,
  };

  await state.kv.set(["documents", workspaceId, documentId], updated);

  // Update workspace embedded count if status changed
  if (
    updates.status === DocumentStatus.EMBEDDED &&
    existing.status !== DocumentStatus.EMBEDDED
  ) {
    const workspace = await getWorkspace(state, workspaceId);
    if (workspace) {
      await state.kv.set(["workspaces", workspaceId], {
        ...workspace,
        embeddedCount: workspace.embeddedCount + 1,
        updatedAt: new Date().toISOString(),
      });
    }
  }

  console.log(`✅ Updated document: ${documentId}`);
  return updated;
}

/**
 * Delete document from registry
 *
 * WARNING: This only deletes metadata. File storage should be cleaned up separately.
 */
export async function deleteDocument(
  state: WorkspaceKVState,
  workspaceId: string,
  documentId: string,
): Promise<boolean> {
  const doc = await getDocument(state, workspaceId, documentId);
  if (!doc) return false;

  await state.kv.delete(["documents", workspaceId, documentId]);

  // Update workspace document count
  const workspace = await getWorkspace(state, workspaceId);
  if (workspace) {
    await state.kv.set(["workspaces", workspaceId], {
      ...workspace,
      documentCount: Math.max(0, workspace.documentCount - 1),
      embeddedCount: doc.status === DocumentStatus.EMBEDDED
        ? Math.max(0, workspace.embeddedCount - 1)
        : workspace.embeddedCount,
      updatedAt: new Date().toISOString(),
    });
  }

  console.log(`✅ Deleted document: ${documentId}`);
  return true;
}

// Constants for document status
const DocumentStatus = {
  UPLOADED: "uploaded" as const,
  PROCESSING: "processing" as const,
  EMBEDDED: "embedded" as const,
  ERROR: "error" as const,
};

/**
 * Get workspace statistics
 */
export async function getWorkspaceStats(
  state: WorkspaceKVState,
  workspaceId: string,
): Promise<WorkspaceStats | null> {
  const documents = await listDocuments(state, workspaceId);
  if (documents.length === 0) {
    const workspace = await getWorkspace(state, workspaceId);
    if (!workspace) return null;
  }

  const stats: WorkspaceStats = {
    totalDocuments: documents.length,
    uploadedDocuments: documents.filter((d) => d.status === DocumentStatus.UPLOADED).length,
    embeddedDocuments: documents.filter((d) => d.status === DocumentStatus.EMBEDDED).length,
    processingDocuments: documents.filter((d) => d.status === DocumentStatus.PROCESSING).length,
    errorDocuments: documents.filter((d) => d.status === DocumentStatus.ERROR)
      .length,
    totalSize: documents.reduce((sum, d) => sum + d.fileSize, 0),
  };

  return stats;
}

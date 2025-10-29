// Functional LanceDB vector store implementation
import { connect, type Connection, type Table } from "vectordb";
import { createOpenAIEmbeddings, embedText, embedTexts } from "../embeddings/openai.ts";

import type {
  EmbeddingConfig,
  SearchOptions,
  SearchResult,
  VectorDocument,
  VectorStoreConfig,
  VectorStoreStats,
} from "../types.ts";

// Constants
const DEFAULT_TABLE_NAME = "documents";
const DEFAULT_DIMENSIONS = 1536;
const DEFAULT_REGION = "us-east-1";
const DEFAULT_SEARCH_LIMIT = 10;
const INIT_DOC_ID = "init";

export interface LanceDBState {
  connection: Connection;
  tableName: string;
  embeddings: ReturnType<typeof createOpenAIEmbeddings>;
  dimensions: number;
  isCloud: boolean;
}

// Helper: Check if path is cloud
function isCloudPath(path: string): boolean {
  return path.startsWith("db://");
}

// Helper: Create connection based on config
async function createConnection(
  config: VectorStoreConfig,
): Promise<Connection> {
  if (!config.path) {
    throw new Error("LanceDB path is required");
  }

  const isCloud = isCloudPath(config.path);

  if (isCloud) {
    if (!config.apiKey) {
      throw new Error("API key required for LanceDB Cloud");
    }
    return await connect({
      uri: config.path,
      apiKey: config.apiKey,
      region: config.region || DEFAULT_REGION,
    });
  }

  return await connect(config.path);
}

// Helper: Get table with dynamic name support
async function getTable(
  state: LanceDBState,
  tableName?: string,
): Promise<Table> {
  return await state.connection.openTable(tableName || state.tableName);
}

// Helper: Transform metadata for cloud/local storage
function transformMetadata(
  metadata: Record<string, unknown>,
  isCloud: boolean,
): Record<string, unknown> {
  if (!isCloud) {
    return { metadata };
  }

  // Cloud: flatten metadata as individual columns with meta_ prefix
  const metaFields: Record<string, string> = {};
  Object.entries(metadata).forEach(([key, value]) => {
    metaFields[`meta_${key}`] = typeof value === "string" ? value : JSON.stringify(value);
  });
  return metaFields;
}

// LanceDB result interface
interface LanceDBSearchResult {
  id: string;
  content: string;
  vector: number[];
  metadata?: Record<string, unknown>;
  _distance: number;
  [key: string]: unknown; // For cloud meta_* fields
}

// Helper: Create record with proper structure
function createRecord(
  id: string,
  content: string,
  vector: number[],
  metadata: Record<string, unknown>,
  isCloud: boolean,
): Record<string, unknown> {
  return {
    id,
    content,
    vector,
    ...transformMetadata(metadata, isCloud),
  };
}

// Helper: Process search results
function processSearchResults(
  results: unknown[],
  options: SearchOptions,
  isCloud: boolean,
): SearchResult[] {
  return (results as LanceDBSearchResult[])
    .filter((result) => !options.threshold || (1 - result._distance) >= options.threshold)
    .map((result) => {
      // Extract metadata based on storage type
      let metadata: Record<string, unknown> = {};

      if (isCloud) {
        // Extract meta_* fields for cloud
        for (const [key, value] of Object.entries(result)) {
          if (key.startsWith("meta_") && value !== null) {
            const metaKey = key.replace("meta_", "");
            try {
              metadata[metaKey] = typeof value === "string" && value.startsWith("{")
                ? JSON.parse(value)
                : value;
            } catch {
              metadata[metaKey] = value;
            }
          }
        }
      } else {
        metadata = result.metadata || {};
      }

      return {
        id: result.id,
        content: result.content,
        metadata,
        score: 1 - result._distance,
      };
    });
}

// Helper: Get embeddings for batch documents
async function getEmbeddingsForDocuments(
  state: LanceDBState,
  documents: VectorDocument[],
): Promise<Map<number, number[]>> {
  const textsToEmbed: string[] = [];
  const textIndices: number[] = [];

  documents.forEach((doc, index) => {
    if (!doc.embedding) {
      textsToEmbed.push(doc.content);
      textIndices.push(index);
    }
  });

  const embeddingMap = new Map<number, number[]>();

  if (textsToEmbed.length > 0) {
    const newEmbeddings = await embedTexts(state.embeddings, textsToEmbed);
    textIndices.forEach((docIndex, embIndex) => {
      embeddingMap.set(docIndex, newEmbeddings[embIndex]);
    });
  }

  return embeddingMap;
}

// Helper: Apply search filters
function applySearchFilters<T>(
  searchQuery: T,
  filter: Record<string, unknown> | string | undefined,
  isCloud: boolean,
): T {
  if (!filter) return searchQuery;

  let query = searchQuery as { where: (condition: string) => unknown };

  // If filter is a string (from buildRuleFilters), use it directly
  if (typeof filter === "string") {
    query = query.where(filter) as typeof query;
    return query as T;
  }

  // If filter is an object, build filter conditions
  Object.entries(filter).forEach(([key, value]) => {
    const filterPath = isCloud ? `meta_${key}` : `metadata.${key}`;
    query = query.where(`${filterPath} = '${value}'`) as typeof query;
  });

  return query as T;
}

// Main API

/**
 * Creates and initializes a LanceDB vector store connection.
 *
 * Supports both local LanceDB instances and LanceDB Cloud. For cloud instances,
 * use a path starting with "db://" and provide an API key.
 *
 * @param config Vector store configuration
 * @param embeddingConfig OpenAI embedding configuration
 * @returns Promise resolving to initialized LanceDB state
 *
 * @example
 * ```ts
 * // Local LanceDB
 * const store = await createLanceDB(
 *   { provider: "lancedb", path: "./vector-db" },
 *   { provider: "openai", apiKey: "sk-..." }
 * );
 *
 * // LanceDB Cloud
 * const cloudStore = await createLanceDB(
 *   {
 *     provider: "lancedb",
 *     path: "db://my-database-id",
 *     apiKey: "ldb_...",
 *     region: "us-east-1"
 *   },
 *   { provider: "openai", apiKey: "sk-..." }
 * );
 * ```
 */
export async function createLanceDB(
  config: VectorStoreConfig,
  embeddingConfig: EmbeddingConfig,
): Promise<LanceDBState> {
  const connection = await createConnection(config);
  const embeddings = createOpenAIEmbeddings(embeddingConfig);

  return {
    connection,
    tableName: config.tableName || DEFAULT_TABLE_NAME,
    embeddings,
    dimensions: config.dimensions || DEFAULT_DIMENSIONS,
    isCloud: isCloudPath(config.path!),
  };
}

/**
 * Initializes a table in the vector store.
 *
 * Creates the table if it doesn't exist. If the table already exists, this is a no-op.
 *
 * @param state LanceDB state from createLanceDB
 * @param tableName Optional table name (defaults to state.tableName)
 *
 * @example
 * ```ts
 * await initializeTable(store);
 * await initializeTable(store, "custom_table");
 * ```
 */
export async function initializeTable(
  state: LanceDBState,
  tableName?: string,
): Promise<void> {
  const targetTable = tableName || state.tableName;

  try {
    await state.connection.openTable(targetTable);
  } catch {
    // Table doesn't exist, create it
    const sampleData = [{
      id: INIT_DOC_ID,
      content: "initialization document",
      vector: new Array(state.dimensions).fill(0),
      ...transformMetadata({}, state.isCloud),
    }];

    const table = await state.connection.createTable(targetTable, sampleData);
    await table.delete(`id = '${INIT_DOC_ID}'`);
  }
}

/**
 * Adds a single document to the vector store.
 *
 * If the document doesn't have an embedding, one will be generated automatically
 * using the configured embedding provider.
 *
 * @param state LanceDB state from createLanceDB
 * @param document Document to add with id, content, optional metadata and embedding
 * @param tableName Optional table name (defaults to state.tableName)
 *
 * @example
 * ```ts
 * await addDocument(store, {
 *   id: "doc1",
 *   content: "Deno is a modern runtime",
 *   metadata: { category: "tech" }
 * });
 * ```
 */
export async function addDocument(
  state: LanceDBState,
  document: VectorDocument,
  tableName?: string,
): Promise<void> {
  const table = await getTable(state, tableName);

  const embedding = document.embedding ||
    await embedText(state.embeddings, document.content);
  const record = createRecord(
    document.id,
    document.content,
    embedding,
    document.metadata || {},
    state.isCloud,
  );

  await table.add([record]);
}

/**
 * Adds multiple documents to the vector store in batch.
 *
 * More efficient than calling addDocument multiple times. Embeddings are generated
 * for all documents without embeddings in a single batch operation.
 *
 * @param state LanceDB state from createLanceDB
 * @param documents Array of documents to add
 * @param tableName Optional table name (defaults to state.tableName)
 *
 * @example
 * ```ts
 * await addDocuments(store, [
 *   { id: "1", content: "First document" },
 *   { id: "2", content: "Second document" },
 *   { id: "3", content: "Third document" }
 * ]);
 * ```
 */
export async function addDocuments(
  state: LanceDBState,
  documents: VectorDocument[],
  tableName?: string,
): Promise<void> {
  if (documents.length === 0) return;

  const table = await getTable(state, tableName);
  const embeddingMap = await getEmbeddingsForDocuments(state, documents);

  const records = documents.map((doc, index) => {
    const embedding = doc.embedding || embeddingMap.get(index)!;
    return createRecord(
      doc.id,
      doc.content,
      embedding,
      doc.metadata || {},
      state.isCloud,
    );
  });

  await table.add(records);
}

/**
 * Searches for documents similar to a text query using semantic search.
 *
 * Converts the query to an embedding and finds the most similar documents
 * in the vector store based on cosine similarity.
 *
 * @param state LanceDB state from createLanceDB
 * @param query Text query to search for
 * @param options Search options (limit, threshold, filter)
 * @param tableName Optional table name (defaults to state.tableName)
 * @returns Array of search results with score, content, and metadata
 *
 * @example
 * ```ts
 * const results = await searchSimilar(store, "JavaScript runtime", {
 *   limit: 5,
 *   threshold: 0.7,
 *   filter: { category: "tech" }
 * });
 *
 * results.forEach(result => {
 *   console.log(`Score: ${result.score}, Content: ${result.content}`);
 * });
 * ```
 */
export async function searchSimilar(
  state: LanceDBState,
  query: string,
  options: SearchOptions = {},
  tableName?: string,
): Promise<SearchResult[]> {
  const table = await getTable(state, tableName);
  const queryEmbedding = await embedText(state.embeddings, query);

  return await searchByEmbedding(state, queryEmbedding, options, tableName);
}

/**
 * Searches for documents using a pre-computed embedding vector.
 *
 * Use this when you already have an embedding vector and want to find
 * similar documents without re-computing the query embedding.
 *
 * @param state LanceDB state from createLanceDB
 * @param embedding Pre-computed embedding vector
 * @param options Search options (limit, threshold, filter)
 * @param tableName Optional table name (defaults to state.tableName)
 * @returns Array of search results with score, content, and metadata
 */
export async function searchByEmbedding(
  state: LanceDBState,
  embedding: number[],
  options: SearchOptions = {},
  tableName?: string,
): Promise<SearchResult[]> {
  const table = await getTable(state, tableName);

  let searchQuery = table
    .search(embedding)
    .limit(options.limit || DEFAULT_SEARCH_LIMIT);

  searchQuery = applySearchFilters(searchQuery, options.filter, state.isCloud);

  // New API returns an iterator
  const resultsIterator = await searchQuery.toArray();
  return processSearchResults(resultsIterator, options, state.isCloud);
}

/**
 * Retrieves a single document by ID from the vector store.
 *
 * @param state LanceDB state from createLanceDB
 * @param id Document ID to retrieve
 * @param tableName Optional table name (defaults to state.tableName)
 * @returns Document with content, metadata, and embedding, or null if not found
 */
export async function getDocument(
  state: LanceDBState,
  id: string,
  tableName?: string,
): Promise<VectorDocument | null> {
  const table = await getTable(state, tableName);

  const results = await table.search(new Array(state.dimensions).fill(0))
    .where(`id = '${id}'`)
    .limit(1)
    .toArray();

  if (!results || results.length === 0) {
    return null;
  }

  const result = results[0] as LanceDBSearchResult;
  const metadata = state.isCloud ? extractCloudMetadata(result) : (result.metadata || {});

  return {
    id: result.id,
    content: result.content,
    metadata,
    embedding: result.vector,
  };
}

/**
 * Extracts metadata from cloud storage format (meta_* fields).
 * @internal
 */
function extractCloudMetadata(
  result: LanceDBSearchResult,
): Record<string, unknown> {
  const metadata: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(result)) {
    if (key.startsWith("meta_") && value !== null) {
      const metaKey = key.replace("meta_", "");
      try {
        metadata[metaKey] = typeof value === "string" && value.startsWith("{")
          ? JSON.parse(value)
          : value;
      } catch {
        metadata[metaKey] = value;
      }
    }
  }
  return metadata;
}

/**
 * Updates an existing document in the vector store.
 *
 * Implemented as delete + add operation.
 *
 * @param state LanceDB state from createLanceDB
 * @param document Updated document with same ID
 * @param tableName Optional table name (defaults to state.tableName)
 */
export async function updateDocument(
  state: LanceDBState,
  document: VectorDocument,
  tableName?: string,
): Promise<void> {
  await deleteDocument(state, document.id, tableName);
  await addDocument(state, document, tableName);
}

/**
 * Deletes a document from the vector store by ID.
 *
 * @param state LanceDB state from createLanceDB
 * @param id Document ID to delete
 * @param tableName Optional table name (defaults to state.tableName)
 */
export async function deleteDocument(
  state: LanceDBState,
  id: string,
  tableName?: string,
): Promise<void> {
  const table = await getTable(state, tableName);
  await table.delete(`id = '${id}'`);
}

/**
 * Gets statistics about the vector store.
 *
 * @param state LanceDB state from createLanceDB
 * @param tableName Optional table name (defaults to state.tableName)
 * @returns Statistics including document count and estimated size
 */
export async function getStats(
  state: LanceDBState,
  tableName?: string,
): Promise<VectorStoreStats> {
  const table = await getTable(state, tableName);
  const count = await table.countRows();

  return {
    totalDocuments: count,
    totalSize: count * state.dimensions * 4,
    lastUpdated: new Date(),
  };
}

/**
 * Clears all documents from the vector store.
 *
 * WARNING: This permanently deletes all documents in the table.
 *
 * @param state LanceDB state from createLanceDB
 * @param tableName Optional table name (defaults to state.tableName)
 */
export async function clear(
  state: LanceDBState,
  tableName?: string,
): Promise<void> {
  const table = await getTable(state, tableName);
  await table.delete("true");
}

// Workspace-specific functions

/**
 * Creates an isolated workspace table for multi-tenant applications.
 *
 * Each workspace has its own dedicated table (workspace_{workspaceId}) providing
 * complete data isolation between different users or tenants.
 *
 * @param state LanceDB state from createLanceDB
 * @param workspaceId Unique workspace identifier
 *
 * @example
 * ```ts
 * await createWorkspaceTable(store, "user_123");
 * await createWorkspaceTable(store, "company_abc");
 * ```
 */
export async function createWorkspaceTable(
  state: LanceDBState,
  workspaceId: string,
): Promise<void> {
  const tableName = `workspace_${workspaceId}`;
  await initializeTable(state, tableName);
}

/**
 * Deletes a workspace table and all its data.
 *
 * This permanently removes the workspace and all documents within it.
 * Use with caution in production environments.
 *
 * @param state LanceDB state from createLanceDB
 * @param workspaceId Workspace identifier to delete
 *
 * @example
 * ```ts
 * await deleteWorkspaceTable(store, "user_123");
 * ```
 */
export async function deleteWorkspaceTable(
  state: LanceDBState,
  workspaceId: string,
): Promise<void> {
  const tableName = `workspace_${workspaceId}`;
  console.log(`🗑️  deleteWorkspaceTable: Attempting to drop table ${tableName}`);
  console.log(`   - LanceDB Cloud: ${state.isCloud}`);

  try {
    // List tables before deletion
    const tablesBefore = await state.connection.tableNames();
    console.log(`   - Tables before deletion:`, tablesBefore);
    console.log(`   - Table ${tableName} exists: ${tablesBefore.includes(tableName)}`);

    await state.connection.dropTable(tableName);

    // List tables after deletion
    const tablesAfter = await state.connection.tableNames();
    console.log(`✅ deleteWorkspaceTable: Successfully dropped table ${tableName}`);
    console.log(`   - Tables after deletion:`, tablesAfter);
    console.log(`   - Table ${tableName} still exists: ${tablesAfter.includes(tableName)}`);
  } catch (error) {
    console.error(`❌ deleteWorkspaceTable: Failed to drop workspace table ${tableName}:`, error);
    console.error(`   Error type:`, error?.constructor?.name);
    console.error(`   Error message:`, error instanceof Error ? error.message : String(error));
    throw error;
  }
}

/**
 * Lists all workspace table names.
 *
 * @param state LanceDB state from createLanceDB
 * @returns Array of workspace table names (workspace_*)
 */
export async function listWorkspaceTables(
  state: LanceDBState,
): Promise<string[]> {
  const allTables = await state.connection.tableNames();
  return allTables.filter((name) => name.startsWith("workspace_"));
}

/**
 * Adds a document to a specific workspace.
 *
 * The document is stored in the workspace's isolated table, ensuring
 * complete separation from other workspaces.
 *
 * @param state LanceDB state from createLanceDB
 * @param workspaceId Workspace identifier
 * @param document Document to add
 *
 * @example
 * ```ts
 * await addWorkspaceDocument(store, "user_123", {
 *   id: "doc1",
 *   content: "User-specific document",
 *   metadata: { type: "note" }
 * });
 * ```
 */
export async function addWorkspaceDocument(
  state: LanceDBState,
  workspaceId: string,
  document: VectorDocument,
): Promise<void> {
  const tableName = `workspace_${workspaceId}`;
  await addDocument(state, document, tableName);
}

/**
 * Adds multiple documents to a specific workspace in batch.
 *
 * @param state LanceDB state from createLanceDB
 * @param workspaceId Workspace identifier
 * @param documents Array of documents to add
 */
export async function addWorkspaceDocuments(
  state: LanceDBState,
  workspaceId: string,
  documents: VectorDocument[],
): Promise<void> {
  const tableName = `workspace_${workspaceId}`;
  await addDocuments(state, documents, tableName);
}

/**
 * Searches for similar documents within a specific workspace.
 *
 * The search is confined to the workspace's table, ensuring results
 * only come from that workspace's documents.
 *
 * @param state LanceDB state from createLanceDB
 * @param workspaceId Workspace identifier
 * @param query Text query to search for
 * @param options Search options (limit, threshold, filter)
 * @returns Array of search results from the workspace
 *
 * @example
 * ```ts
 * const results = await searchWorkspace(
 *   store,
 *   "user_123",
 *   "architecture guidelines",
 *   { limit: 5, threshold: 0.7 }
 * );
 * ```
 */
export async function searchWorkspace(
  state: LanceDBState,
  workspaceId: string,
  query: string,
  options: SearchOptions = {},
): Promise<SearchResult[]> {
  const tableName = `workspace_${workspaceId}`;
  return await searchSimilar(state, query, options, tableName);
}

/**
 * Searches workspace using a pre-computed embedding vector.
 *
 * @param state LanceDB state from createLanceDB
 * @param workspaceId Workspace identifier
 * @param embedding Pre-computed embedding vector
 * @param options Search options (limit, threshold, filter)
 * @returns Array of search results from the workspace
 */
export async function searchWorkspaceByEmbedding(
  state: LanceDBState,
  workspaceId: string,
  embedding: number[],
  options: SearchOptions = {},
): Promise<SearchResult[]> {
  const tableName = `workspace_${workspaceId}`;
  return await searchByEmbedding(state, embedding, options, tableName);
}

/**
 * Retrieves a document by ID from a specific workspace.
 *
 * @param state LanceDB state from createLanceDB
 * @param workspaceId Workspace identifier
 * @param id Document ID to retrieve
 * @returns Document or null if not found
 */
export async function getWorkspaceDocument(
  state: LanceDBState,
  workspaceId: string,
  id: string,
): Promise<VectorDocument | null> {
  const tableName = `workspace_${workspaceId}`;
  return await getDocument(state, id, tableName);
}

/**
 * Updates a document in a specific workspace.
 *
 * @param state LanceDB state from createLanceDB
 * @param workspaceId Workspace identifier
 * @param document Updated document with same ID
 */
export async function updateWorkspaceDocument(
  state: LanceDBState,
  workspaceId: string,
  document: VectorDocument,
): Promise<void> {
  const tableName = `workspace_${workspaceId}`;
  await updateDocument(state, document, tableName);
}

/**
 * Deletes a document from a specific workspace.
 *
 * @param state LanceDB state from createLanceDB
 * @param workspaceId Workspace identifier
 * @param id Document ID to delete
 */
export async function deleteWorkspaceDocument(
  state: LanceDBState,
  workspaceId: string,
  id: string,
): Promise<void> {
  const tableName = `workspace_${workspaceId}`;
  await deleteDocument(state, id, tableName);
}

/**
 * Gets statistics for a specific workspace.
 *
 * @param state LanceDB state from createLanceDB
 * @param workspaceId Workspace identifier
 * @returns Statistics including document count and size
 */
export async function getWorkspaceStats(
  state: LanceDBState,
  workspaceId: string,
): Promise<VectorStoreStats> {
  const tableName = `workspace_${workspaceId}`;
  return await getStats(state, tableName);
}

/**
 * Clears all documents from a specific workspace.
 *
 * WARNING: This permanently deletes all documents in the workspace.
 *
 * @param state LanceDB state from createLanceDB
 * @param workspaceId Workspace identifier
 */
export async function clearWorkspace(
  state: LanceDBState,
  workspaceId: string,
): Promise<void> {
  const tableName = `workspace_${workspaceId}`;
  await clear(state, tableName);
}

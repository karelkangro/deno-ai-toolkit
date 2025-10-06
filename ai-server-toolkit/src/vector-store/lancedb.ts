// Functional LanceDB vector store implementation
import { connect, Connection, Table } from "vectordb";
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
  filter: Record<string, unknown> | undefined,
  isCloud: boolean,
): T {
  if (!filter) return searchQuery;

  let query = searchQuery as { where: (condition: string) => unknown };
  Object.entries(filter).forEach(([key, value]) => {
    const filterPath = isCloud ? `meta_${key}` : `metadata.${key}`;
    query = query.where(`${filterPath} = '${value}'`) as typeof query;
  });

  return query as T;
}

// Main API

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

  const results = await searchQuery.execute();
  return processSearchResults(results, options, state.isCloud);
}

export async function getDocument(
  state: LanceDBState,
  id: string,
  tableName?: string,
): Promise<VectorDocument | null> {
  const table = await getTable(state, tableName);

  const results = await table.search(new Array(state.dimensions).fill(0))
    .where(`id = '${id}'`)
    .limit(1)
    .execute();

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

function extractCloudMetadata(result: LanceDBSearchResult): Record<string, unknown> {
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

export async function updateDocument(
  state: LanceDBState,
  document: VectorDocument,
  tableName?: string,
): Promise<void> {
  await deleteDocument(state, document.id, tableName);
  await addDocument(state, document, tableName);
}

export async function deleteDocument(
  state: LanceDBState,
  id: string,
  tableName?: string,
): Promise<void> {
  const table = await getTable(state, tableName);
  await table.delete(`id = '${id}'`);
}

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

export async function clear(
  state: LanceDBState,
  tableName?: string,
): Promise<void> {
  const table = await getTable(state, tableName);
  await table.delete("true");
}

// Workspace-specific functions

export async function createWorkspaceTable(
  state: LanceDBState,
  workspaceId: string,
): Promise<void> {
  const tableName = `workspace_${workspaceId}`;
  await initializeTable(state, tableName);
}

export async function deleteWorkspaceTable(
  state: LanceDBState,
  workspaceId: string,
): Promise<void> {
  const tableName = `workspace_${workspaceId}`;
  try {
    await state.connection.dropTable(tableName);
  } catch (error) {
    console.error(`Failed to drop workspace table ${tableName}:`, error);
    throw error;
  }
}

export async function listWorkspaceTables(
  state: LanceDBState,
): Promise<string[]> {
  const allTables = await state.connection.tableNames();
  return allTables.filter((name) => name.startsWith("workspace_"));
}

export async function addWorkspaceDocument(
  state: LanceDBState,
  workspaceId: string,
  document: VectorDocument,
): Promise<void> {
  const tableName = `workspace_${workspaceId}`;
  await addDocument(state, document, tableName);
}

export async function addWorkspaceDocuments(
  state: LanceDBState,
  workspaceId: string,
  documents: VectorDocument[],
): Promise<void> {
  const tableName = `workspace_${workspaceId}`;
  await addDocuments(state, documents, tableName);
}

export async function searchWorkspace(
  state: LanceDBState,
  workspaceId: string,
  query: string,
  options: SearchOptions = {},
): Promise<SearchResult[]> {
  const tableName = `workspace_${workspaceId}`;
  return await searchSimilar(state, query, options, tableName);
}

export async function searchWorkspaceByEmbedding(
  state: LanceDBState,
  workspaceId: string,
  embedding: number[],
  options: SearchOptions = {},
): Promise<SearchResult[]> {
  const tableName = `workspace_${workspaceId}`;
  return await searchByEmbedding(state, embedding, options, tableName);
}

export async function getWorkspaceDocument(
  state: LanceDBState,
  workspaceId: string,
  id: string,
): Promise<VectorDocument | null> {
  const tableName = `workspace_${workspaceId}`;
  return await getDocument(state, id, tableName);
}

export async function updateWorkspaceDocument(
  state: LanceDBState,
  workspaceId: string,
  document: VectorDocument,
): Promise<void> {
  const tableName = `workspace_${workspaceId}`;
  await updateDocument(state, document, tableName);
}

export async function deleteWorkspaceDocument(
  state: LanceDBState,
  workspaceId: string,
  id: string,
): Promise<void> {
  const tableName = `workspace_${workspaceId}`;
  await deleteDocument(state, id, tableName);
}

export async function getWorkspaceStats(
  state: LanceDBState,
  workspaceId: string,
): Promise<VectorStoreStats> {
  const tableName = `workspace_${workspaceId}`;
  return await getStats(state, tableName);
}

export async function clearWorkspace(
  state: LanceDBState,
  workspaceId: string,
): Promise<void> {
  const tableName = `workspace_${workspaceId}`;
  await clear(state, tableName);
}

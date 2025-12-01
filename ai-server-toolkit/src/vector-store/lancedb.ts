// Functional LanceDB vector store implementation
import { connect, type Connection, type Table } from "vectordb";
import { createOpenAIEmbeddings } from "../embeddings/openai.ts";

import type {
  EmbeddingConfig,
  EmbeddingModel,
  SearchOptions,
  SearchResult,
  VectorDocument,
  VectorStore,
  VectorStoreConfig,
  VectorStoreStats,
} from "../types.ts";
import { createSubLogger } from "../utils/logger.ts";

const logger = createSubLogger("lancedb");

// Export LanceDBState as alias for VectorStore for backward compatibility
export type LanceDBState = VectorStore;

// Constants
const DEFAULT_TABLE_NAME = "documents";
const DEFAULT_DIMENSIONS = 1536;
const DEFAULT_REGION = "us-east-1";
const DEFAULT_SEARCH_LIMIT = 10;
const INIT_DOC_ID = "init";

interface LanceDBInternalState {
  connection: Connection;
  tableName: string;
  embeddings: EmbeddingModel;
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

// LanceDB result interface
interface LanceDBSearchResult {
  id: string;
  content: string;
  vector: number[];
  metadata?: Record<string, unknown>;
  _distance: number;
  [key: string]: unknown; // For cloud meta_* fields
}

/**
 * Creates and initializes a LanceDB vector store connection.
 *
 * Supports both local LanceDB instances and LanceDB Cloud. For cloud instances,
 * use a path starting with "db://" and provide an API key.
 *
 * @param config Vector store configuration
 * @param embeddingConfig OpenAI embedding configuration
 * @returns Promise resolving to initialized VectorStore
 */
export async function createLanceDB(
  config: VectorStoreConfig,
  embeddingConfig: EmbeddingConfig,
): Promise<VectorStore> {
  const connection = await createConnection(config);
  // Assuming createOpenAIEmbeddings returns EmbeddingModel now
  const embeddings = createOpenAIEmbeddings(embeddingConfig);

  const state: LanceDBInternalState = {
    connection,
    tableName: config.tableName || DEFAULT_TABLE_NAME,
    embeddings,
    dimensions: config.dimensions || DEFAULT_DIMENSIONS,
    isCloud: isCloudPath(config.path!),
  };

  // Internal Helpers

  async function getTable(tableName?: string): Promise<Table> {
    return await state.connection.openTable(tableName || state.tableName);
  }

  function transformMetadata(
    metadata: Record<string, unknown>,
  ): Record<string, unknown> {
    if (!state.isCloud) {
      return { metadata };
    }
    // Cloud: flatten metadata as individual columns with meta_ prefix
    const metaFields: Record<string, string> = {};
    Object.entries(metadata).forEach(([key, value]) => {
      metaFields[`meta_${key}`] = typeof value === "string" ? value : JSON.stringify(value);
    });
    return metaFields;
  }

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

  function createRecord(
    id: string,
    content: string,
    vector: number[],
    metadata: Record<string, unknown>,
  ): Record<string, unknown> {
    return {
      id,
      content,
      vector,
      ...transformMetadata(metadata),
    };
  }

  function processSearchResults(
    results: unknown[],
    options: SearchOptions,
  ): SearchResult[] {
    return (results as LanceDBSearchResult[])
      .filter((result) => !options.threshold || (1 - result._distance) >= options.threshold)
      .map((result) => {
        let metadata: Record<string, unknown> = {};

        if (state.isCloud) {
          metadata = extractCloudMetadata(result);
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

  async function getEmbeddingsForDocuments(
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
      const newEmbeddings = await state.embeddings.embedTexts(textsToEmbed);
      textIndices.forEach((docIndex, embIndex) => {
        embeddingMap.set(docIndex, newEmbeddings[embIndex]);
      });
    }

    return embeddingMap;
  }

  function applySearchFilters<T>(
    searchQuery: T,
    filter: Record<string, unknown> | string | undefined,
  ): T {
    if (!filter) return searchQuery;

    let query = searchQuery as { where: (condition: string) => unknown };

    if (typeof filter === "string") {
      query = query.where(filter) as typeof query;
      return query as T;
    }

    Object.entries(filter).forEach(([key, value]) => {
      const filterPath = state.isCloud ? `meta_${key}` : `metadata.${key}`;
      if (Array.isArray(value)) {
        const values = value.map((v) => `'${v}'`).join(", ");
        query = query.where(`${filterPath} IN (${values})`) as typeof query;
      } else {
        query = query.where(`${filterPath} = '${value}'`) as typeof query;
      }
    });

    return query as T;
  }

  // Implementation Methods

  const createTable = async (
    tableName: string,
    sampleData?: VectorDocument,
  ): Promise<void> => {
    const targetTable = tableName || state.tableName;

    try {
      await state.connection.openTable(targetTable);
      logger.debug("Table already exists", { tableName: targetTable });
    } catch (error) {
      const isNotFound = error instanceof Error && (
        error.message.includes("404") ||
        error.message.includes("Not Found") ||
        (error as { status?: number; response?: { status?: number } }).status === 404 ||
        (error as { status?: number; response?: { status?: number } }).response?.status === 404
      );

      if (!isNotFound) {
        throw error;
      }

      logger.debug("Table not found, creating new table", { tableName: targetTable });

      const initialRecord = sampleData
        ? createRecord(
          sampleData.id,
          sampleData.content,
          sampleData.embedding || new Array(state.dimensions).fill(0),
          sampleData.metadata || {},
        )
        : {
          id: INIT_DOC_ID,
          content: "initialization document",
          vector: new Array(state.dimensions).fill(0),
          ...transformMetadata({}),
        };

      await state.connection.createTable(targetTable, [initialRecord]);

      // Only delete if we used the default init doc
      if (!sampleData) {
        const table = await state.connection.openTable(targetTable);
        await table.delete(`id = '${INIT_DOC_ID}'`);
      }

      logger.info("Table created successfully", { tableName: targetTable });
    }
  };

  const deleteTable = async (tableName: string): Promise<void> => {
    logger.debug("Attempting to drop table", { tableName, isCloud: state.isCloud });
    try {
      await state.connection.dropTable(tableName);
      logger.info("Successfully dropped table", { tableName });
    } catch (error) {
      logger.error("Failed to drop table", error, { tableName });
      throw error;
    }
  };

  const addDocument = async (
    document: VectorDocument,
    tableName?: string,
  ): Promise<void> => {
    const table = await getTable(tableName);
    const embedding = document.embedding ||
      await state.embeddings.embedText(document.content);
    const record = createRecord(
      document.id,
      document.content,
      embedding,
      document.metadata || {},
    );
    await table.add([record]);
  };

  const addDocuments = async (
    documents: VectorDocument[],
    tableName?: string,
  ): Promise<void> => {
    if (documents.length === 0) return;
    const table = await getTable(tableName);
    const embeddingMap = await getEmbeddingsForDocuments(documents);

    const records = documents.map((doc, index) => {
      const embedding = doc.embedding || embeddingMap.get(index)!;
      return createRecord(
        doc.id,
        doc.content,
        embedding,
        doc.metadata || {},
      );
    });

    await table.add(records);
  };

  const searchByEmbedding = async (
    embedding: number[],
    options: SearchOptions = {},
    tableName?: string,
  ): Promise<SearchResult[]> => {
    const table = await getTable(tableName);

    let searchQuery = table
      .search(embedding)
      .limit(options.limit || DEFAULT_SEARCH_LIMIT);

    searchQuery = applySearchFilters(searchQuery, options.filter);

    const resultsIterator = await searchQuery.toArray();
    return processSearchResults(resultsIterator, options);
  };

  const search = async (
    query: string,
    options: SearchOptions = {},
    tableName?: string,
  ): Promise<SearchResult[]> => {
    logger.debug("Searching table", { tableName: tableName || "default" });
    const queryEmbedding = await state.embeddings.embedText(query);
    return await searchByEmbedding(queryEmbedding, options, tableName);
  };

  const getDocument = async (
    id: string,
    tableName?: string,
  ): Promise<VectorDocument | null> => {
    const table = await getTable(tableName);
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
  };

  const deleteDocument = async (
    id: string,
    tableName?: string,
  ): Promise<void> => {
    const table = await getTable(tableName);
    await table.delete(`id = '${id}'`);
  };

  const updateDocument = async (
    document: VectorDocument,
    tableName?: string,
  ): Promise<void> => {
    await deleteDocument(document.id, tableName);
    await addDocument(document, tableName);
  };

  const getStats = async (tableName?: string): Promise<VectorStoreStats> => {
    const table = await getTable(tableName);
    const count = await table.countRows();
    return {
      totalDocuments: count,
      totalSize: count * state.dimensions * 4,
      lastUpdated: new Date(),
    };
  };

  const listTables = async (): Promise<string[]> => {
    return await state.connection.tableNames();
  };

  const clear = async (tableName?: string): Promise<void> => {
    const table = await getTable(tableName);
    await table.delete("true");
  };

  return {
    addDocument,
    addDocuments,
    search,
    searchByEmbedding,
    getDocument,
    deleteDocument,
    updateDocument,
    createTable,
    deleteTable,
    getStats,
    listTables,
    clear,
  };
}

// Adapter functions for backward compatibility & convenience
// These now accept VectorStore instead of LanceDBState

export async function initializeTable(
  store: VectorStore,
  tableName?: string,
): Promise<void> {
  // Default tableName logic is inside store.createTable if undefined passed,
  // but createTable requires tableName argument in interface?
  // Actually interface says createTable(tableName: string).
  // If tableName is optional here, we might need to know the default.
  // But here we can't know the default table name of the store easily unless we expose it.
  // For now, we assume the caller provides it or we pass undefined (if interface allows).
  // My interface definition: createTable(tableName: string). It requires a name.
  if (!tableName) {
    // If no table name provided, we might skip or use "documents".
    // But better to let consumers update their usage.
    // However, for backward compat, we should try to support it.
    await store.createTable("documents");
  } else {
    await store.createTable(tableName);
  }
}

export async function addDocument(
  store: VectorStore,
  document: VectorDocument,
  tableName?: string,
): Promise<void> {
  await store.addDocument(document, tableName);
}

export async function addDocuments(
  store: VectorStore,
  documents: VectorDocument[],
  tableName?: string,
): Promise<void> {
  await store.addDocuments(documents, tableName);
}

export async function searchSimilar(
  store: VectorStore,
  query: string,
  options: SearchOptions = {},
  tableName?: string,
): Promise<SearchResult[]> {
  return await store.search(query, options, tableName);
}

export async function searchByEmbedding(
  store: VectorStore,
  embedding: number[],
  options: SearchOptions = {},
  tableName?: string,
): Promise<SearchResult[]> {
  return await store.searchByEmbedding(embedding, options, tableName);
}

export async function getDocument(
  store: VectorStore,
  id: string,
  tableName?: string,
): Promise<VectorDocument | null> {
  return await store.getDocument(id, tableName);
}

export async function updateDocument(
  store: VectorStore,
  document: VectorDocument,
  tableName?: string,
): Promise<void> {
  await store.updateDocument(document, tableName);
}

export async function deleteDocument(
  store: VectorStore,
  id: string,
  tableName?: string,
): Promise<void> {
  await store.deleteDocument(id, tableName);
}

export async function getStats(
  store: VectorStore,
  tableName?: string,
): Promise<VectorStoreStats> {
  return await store.getStats(tableName);
}

export async function clear(
  store: VectorStore,
  tableName?: string,
): Promise<void> {
  await store.clear(tableName);
}

// Workspace helpers

export async function createWorkspaceTable(
  store: VectorStore,
  workspaceId: string,
): Promise<void> {
  await store.createTable(`workspace_${workspaceId}`);
}

export async function deleteWorkspaceTable(
  store: VectorStore,
  workspaceId: string,
): Promise<void> {
  await store.deleteTable(`workspace_${workspaceId}`);
}

export async function listWorkspaceTables(
  store: VectorStore,
): Promise<string[]> {
  const tables = await store.listTables();
  return tables.filter((name) => name.startsWith("workspace_"));
}

export async function addWorkspaceDocument(
  store: VectorStore,
  workspaceId: string,
  document: VectorDocument,
): Promise<void> {
  await store.addDocument(document, `workspace_${workspaceId}`);
}

export async function addWorkspaceDocuments(
  store: VectorStore,
  workspaceId: string,
  documents: VectorDocument[],
): Promise<void> {
  await store.addDocuments(documents, `workspace_${workspaceId}`);
}

export async function searchWorkspace(
  store: VectorStore,
  workspaceId: string,
  query: string,
  options: SearchOptions = {},
): Promise<SearchResult[]> {
  return await store.search(query, options, `workspace_${workspaceId}`);
}

export async function searchWorkspaceByEmbedding(
  store: VectorStore,
  workspaceId: string,
  embedding: number[],
  options: SearchOptions = {},
): Promise<SearchResult[]> {
  return await store.searchByEmbedding(embedding, options, `workspace_${workspaceId}`);
}

export async function getWorkspaceDocument(
  store: VectorStore,
  workspaceId: string,
  id: string,
): Promise<VectorDocument | null> {
  return await store.getDocument(id, `workspace_${workspaceId}`);
}

export async function updateWorkspaceDocument(
  store: VectorStore,
  workspaceId: string,
  document: VectorDocument,
): Promise<void> {
  await store.updateDocument(document, `workspace_${workspaceId}`);
}

export async function deleteWorkspaceDocument(
  store: VectorStore,
  workspaceId: string,
  id: string,
): Promise<void> {
  await store.deleteDocument(id, `workspace_${workspaceId}`);
}

export async function getWorkspaceStats(
  store: VectorStore,
  workspaceId: string,
): Promise<VectorStoreStats> {
  return await store.getStats(`workspace_${workspaceId}`);
}

export async function clearWorkspace(
  store: VectorStore,
  workspaceId: string,
): Promise<void> {
  await store.clear(`workspace_${workspaceId}`);
}

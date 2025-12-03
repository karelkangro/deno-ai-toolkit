import type { LanceDBState } from "./lancedb.ts";
import type { VectorDocument, VectorStore } from "../types.ts";
import type { Connection } from "vectordb";

// Internal LanceDB state with additional properties
interface LanceDBInternalState extends VectorStore {
  dimensions: number;
  isCloud: boolean;
  connection: Connection;
}
import type { BaseDocumentMetadata } from "./schemas.ts";
import { listWorkspaceTables } from "./lancedb.ts";
import { createSubLogger } from "../utils/logger.ts";

const logger = createSubLogger("schema-registry");

/**
 * Configuration for a workspace table with typed metadata schema
 * Defines how a table should be named and what metadata structure it uses
 */
export interface TableConfig<TMetadata extends BaseDocumentMetadata> {
  /** Table name or function to generate table name from workspace ID */
  tableName: string | ((workspaceId: string) => string);
  /** Function to create sample metadata for table initialization */
  createSampleMetadata: (workspaceId: string) => TMetadata;
  /** Optional description of the table's purpose */
  description?: string;
  /** Optional schema version for migration tracking */
  schemaVersion?: string;
}

/**
 * Registry for managing multiple workspace tables with different metadata schemas
 * Enables multi-tenant applications with type-safe table management
 */
export interface WorkspaceTableRegistry {
  /** Register a new table type with its configuration */
  registerTable: <TMetadata extends BaseDocumentMetadata>(
    tableKey: string,
    config: TableConfig<TMetadata>,
  ) => void;
  /** Get configuration for a registered table type */
  getTableConfig: (tableKey: string) => TableConfig<BaseDocumentMetadata> | undefined;
  /** Get list of all registered table types */
  getRegisteredTables: () => string[];
  /** Ensure a table exists, creating it if necessary */
  ensureTable: (
    vectorStore: LanceDBState,
    workspaceId: string,
    tableKey: string,
  ) => Promise<void>;
  /** Recreate a table (drops and recreates with new schema) */
  recreateTable: (
    vectorStore: LanceDBState,
    workspaceId: string,
    tableKey: string,
  ) => Promise<void>;
}

const initializeTable = async (
  tables: Map<string, TableConfig<BaseDocumentMetadata>>,
  vectorStore: LanceDBState,
  workspaceId: string,
  tableKey: string,
): Promise<void> => {
  const config = tables.get(tableKey);
  if (!config) {
    throw new Error(`Table configuration '${tableKey}' not found in registry`);
  }

  const tableName = typeof config.tableName === "function"
    ? config.tableName(workspaceId)
    : config.tableName;

  const sampleMetadata = config.createSampleMetadata(workspaceId);

  // Try to access internal state for dimensions and isCloud
  // If not available, use defaults (1536 dimensions, assume local)
  const internalState = vectorStore as unknown as LanceDBInternalState;
  const dimensions = internalState?.dimensions || 1536;
  const isCloud = internalState?.isCloud || false;

  // Create a schema definition document used to initialize the table structure
  // LanceDB requires a sample record to infer the table schema (columns/types)
  // This document is temporary and will be deleted after table creation
  const schemaDefinitionDocument: VectorDocument = {
    id: "_init_",
    content: "initialization",
    embedding: new Array(dimensions).fill(0),
    metadata: isCloud
      ? Object.fromEntries(
        Object.entries(sampleMetadata).map(([k, v]) => [`meta_${k}`, v]),
      )
      : sampleMetadata,
  };

  logger.debug("Creating table with schema definition document", {
    tableName,
    workspaceId,
    tableKey,
    hasMetadata: !!sampleMetadata,
    metadataKeys: Object.keys(sampleMetadata),
    dimensions,
    isCloud,
  });

  // Use VectorStore interface method to create table with schema definition
  // The schemaDefinitionDocument defines the table structure (columns, types)
  try {
    await vectorStore.createTable(tableName, schemaDefinitionDocument);
    logger.info("Table created successfully with schema definition", { tableName });
  } catch (error) {
    logger.error("Failed to create table with schema definition document", {
      tableName,
      workspaceId,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    throw error;
  }

  // Delete the schema definition document after table creation
  // It was only used to define the table structure, not to store actual data
  try {
    await vectorStore.deleteDocument("_init_", tableName);
    logger.debug("Deleted schema definition document", { tableName });
  } catch (error) {
    // Ignore if deletion fails (table might have already cleaned it up)
    logger.debug("Could not delete schema definition document (may already be cleaned up)", {
      tableName,
      error: error instanceof Error ? error.message : String(error),
    });
  }
};

/**
 * Create a new workspace table registry
 * Allows registering multiple table types with different metadata schemas
 *
 * @example
 * ```typescript
 * const registry = createWorkspaceTableRegistry();
 *
 * // Register a documents table
 * registry.registerTable<DocumentMetadata>("documents", {
 *   tableName: (workspaceId) => `workspace_${workspaceId}_docs`,
 *   createSampleMetadata: (workspaceId) => ({
 *     ...createBaseDocumentMetadata("_init", "_init", 0, 1, workspaceId),
 *     category: "",
 *   }),
 * });
 *
 * // Ensure table exists
 * await registry.ensureTable(vectorStore, "workspace-123", "documents");
 * ```
 */
export const createWorkspaceTableRegistry = (): WorkspaceTableRegistry => {
  const tables = new Map<string, TableConfig<BaseDocumentMetadata>>();

  return {
    registerTable: <TMetadata extends BaseDocumentMetadata>(
      tableKey: string,
      config: TableConfig<TMetadata>,
    ) => {
      tables.set(tableKey, config as TableConfig<BaseDocumentMetadata>);
    },

    getTableConfig: (tableKey: string) => {
      return tables.get(tableKey);
    },

    getRegisteredTables: () => {
      return Array.from(tables.keys());
    },

    ensureTable: async (
      vectorStore: LanceDBState,
      workspaceId: string,
      tableKey: string,
    ) => {
      const config = tables.get(tableKey);
      if (!config) {
        throw new Error(`Table configuration '${tableKey}' not found in registry`);
      }

      const tableName = typeof config.tableName === "function"
        ? config.tableName(workspaceId)
        : config.tableName;

      // Try to check if table exists, but if listing fails, attempt to create anyway
      let tableExists = false;
      try {
        const existingTables = await listWorkspaceTables(vectorStore);
        logger.debug("Existing tables", { existingTables });
        tableExists = existingTables.includes(tableName);
      } catch (error) {
        // If listing tables fails (e.g., connection issues), log and try to create anyway
        logger.warn("Could not list existing tables, will attempt to create table", {
          tableName,
          workspaceId,
          error: error instanceof Error ? error.message : String(error),
        });
      }

      if (!tableExists) {
        await initializeTable(tables, vectorStore, workspaceId, tableKey);
      }
    },

    recreateTable: async (
      vectorStore: LanceDBState,
      workspaceId: string,
      tableKey: string,
    ) => {
      const config = tables.get(tableKey);
      if (!config) {
        throw new Error(`Table configuration '${tableKey}' not found in registry`);
      }

      const tableName = typeof config.tableName === "function"
        ? config.tableName(workspaceId)
        : config.tableName;

      // Cast to internal state to access LanceDB-specific properties
      const internalState = vectorStore as unknown as LanceDBInternalState;
      try {
        await internalState.connection.dropTable(tableName);
      } catch (error) {
        // Table might not exist, continue
        logger.debug("Table might not exist (expected)", {
          tableName,
          error: error instanceof Error ? error.message : String(error),
        });
      }

      await initializeTable(tables, vectorStore, workspaceId, tableKey);
    },
  };
};

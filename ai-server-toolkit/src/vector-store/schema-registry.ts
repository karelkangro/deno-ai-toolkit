import type { LanceDBState } from "./lancedb.ts";
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

  const sampleDoc = {
    id: "_init_",
    content: "initialization",
    vector: new Array(vectorStore.dimensions).fill(0),
    ...(vectorStore.isCloud
      ? Object.fromEntries(
        Object.entries(sampleMetadata).map(([k, v]) => [`meta_${k}`, v]),
      )
      : { metadata: sampleMetadata }),
  };

  const table = await vectorStore.connection.createTable(tableName, [sampleDoc]);
  await table.delete(`id = '_init_'`);
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

      const existingTables = await listWorkspaceTables(vectorStore);

      if (!existingTables.includes(tableName)) {
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

      try {
        await vectorStore.connection.dropTable(tableName);
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

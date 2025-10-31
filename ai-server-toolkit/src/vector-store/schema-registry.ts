import type { LanceDBState } from "./lancedb.ts";
import type { BaseDocumentMetadata } from "./schemas.ts";
import { listWorkspaceTables } from "./lancedb.ts";

export interface TableConfig<TMetadata extends BaseDocumentMetadata> {
  tableName: string | ((workspaceId: string) => string);
  createSampleMetadata: (workspaceId: string) => TMetadata;
  description?: string;
  schemaVersion?: string;
}

export interface WorkspaceTableRegistry {
  registerTable: <TMetadata extends BaseDocumentMetadata>(
    tableKey: string,
    config: TableConfig<TMetadata>,
  ) => void;
  getTableConfig: (tableKey: string) => TableConfig<BaseDocumentMetadata> | undefined;
  getRegisteredTables: () => string[];
  ensureTable: (
    vectorStore: LanceDBState,
    workspaceId: string,
    tableKey: string,
  ) => Promise<void>;
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
      }

      await initializeTable(tables, vectorStore, workspaceId, tableKey);
    },
  };
};

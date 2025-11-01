// Vector Database Connection Manager
// Provides singleton connection management for vector databases
// Supports multiple providers (currently LanceDB, extensible)

import { createLanceDB, type LanceDBState } from "./lancedb.ts";
import type { EmbeddingConfig, VectorStoreConfig } from "../types.ts";

/**
 * Connection manager interface for vector database connections
 * Manages singleton connection instance and provides connection getter
 */
export interface VectorDBConnectionManager {
  /**
   * Get or create the vector database connection
   * Returns singleton instance, creating it on first call
   */
  getConnection(): Promise<LanceDBState>;

  /**
   * Check if connection has been initialized
   */
  isConnected(): boolean;

  /**
   * Reset the connection (useful for testing or reconnection)
   */
  reset(): void;
}

/**
 * Configuration for vector database connection manager
 * Currently supports LanceDB, but designed to be extensible
 */
export interface VectorDBConnectionConfig {
  vectorStore: VectorStoreConfig;
  embedding: EmbeddingConfig;
}

/**
 * Create a vector database connection manager
 *
 * Manages singleton connection instance using closure pattern
 * Functional approach - no classes
 *
 * @param config Connection configuration with vector store and embedding settings
 * @returns Connection manager with getConnection() method
 *
 * @example
 * ```ts
 * const manager = createVectorDBConnectionManager({
 *   vectorStore: {
 *     provider: "lancedb",
 *     path: Deno.env.get("VECTOR_DB_URL")!,
 *     apiKey: Deno.env.get("VECTOR_DB_API_KEY")!,
 *     region: Deno.env.get("VECTOR_DB_REGION") || "us-east-1",
 *   },
 *   embedding: {
 *     provider: "openai",
 *     apiKey: Deno.env.get("OPENAI_API_KEY")!,
 *   },
 * });
 *
 * const connection = await manager.getConnection();
 * ```
 */
export function createVectorDBConnectionManager(
  config: VectorDBConnectionConfig,
): VectorDBConnectionManager {
  let connection: LanceDBState | null = null;
  let isInitializing = false;
  let initPromise: Promise<LanceDBState> | null = null;

  const initializeConnection = async (): Promise<LanceDBState> => {
    if (connection) {
      return connection;
    }

    if (isInitializing && initPromise) {
      return await initPromise;
    }

    isInitializing = true;
    initPromise = (async () => {
      try {
        // Currently only supports LanceDB
        // Future: add provider abstraction layer here
        if (config.vectorStore.provider !== "lancedb") {
          throw new Error(
            `Unsupported vector store provider: ${config.vectorStore.provider}. Only "lancedb" is currently supported.`,
          );
        }

        connection = await createLanceDB(
          config.vectorStore,
          config.embedding,
        );

        isInitializing = false;
        return connection;
      } catch (error) {
        isInitializing = false;
        initPromise = null;
        throw error;
      }
    })();

    return await initPromise;
  };

  return {
    async getConnection(): Promise<LanceDBState> {
      return await initializeConnection();
    },

    isConnected(): boolean {
      return connection !== null;
    },

    reset(): void {
      connection = null;
      isInitializing = false;
      initPromise = null;
    },
  };
}

/**
 * Create a pre-configured connection manager from environment variables
 * Convenience function for common use case
 *
 * @param vectorStoreConfig Vector store configuration
 * @param embeddingConfig Embedding configuration
 * @returns Pre-configured connection manager
 *
 * @example
 * ```ts
 * const manager = createDefaultConnectionManager(
 *   {
 *     provider: "lancedb",
 *     path: Deno.env.get("VECTOR_DB_URL")!,
 *     apiKey: Deno.env.get("VECTOR_DB_API_KEY")!,
 *   },
 *   {
 *     provider: "openai",
 *     apiKey: Deno.env.get("OPENAI_API_KEY")!,
 *   },
 * );
 * ```
 */
export function createDefaultConnectionManager(
  vectorStoreConfig: VectorStoreConfig,
  embeddingConfig: EmbeddingConfig,
): VectorDBConnectionManager {
  return createVectorDBConnectionManager({
    vectorStore: vectorStoreConfig,
    embedding: embeddingConfig,
  });
}

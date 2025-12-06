/**
 * KV Helper - Provides unified KV connection for local and remote databases
 * Supports both local file-based KV and Deno Deploy remote KV
 *
 * @since 1.11.0
 */

import { createSubLogger } from "./logger.ts";

const logger = createSubLogger("kv-helper");

let kvInstance: Deno.Kv | null = null;
let kvPath: string | undefined = undefined;
let kvUrl: string | undefined = undefined;

/**
 * Options for configuring KV connection
 *
 * @since 1.11.0
 */
export interface KVConnectionOptions {
  /** Optional path for local KV file */
  kvPath?: string;
  /** Optional URL for remote Deno Deploy KV */
  kvUrl?: string;
  /** Optional access token for remote KV authentication */
  accessToken?: string;
}

/**
 * Get KV URL from options or environment variables
 *
 * @param options - Optional connection options
 * @returns KV URL string or undefined
 * @since 1.11.0
 */
const getKVUrl = (options?: KVConnectionOptions): string | undefined => {
  if (kvUrl !== undefined) return kvUrl;
  kvUrl = options?.kvUrl || Deno.env.get("DENO_KV_URL") || undefined;
  if (kvUrl) {
    logger.info("Using remote Deno KV", { url: kvUrl });
  } else {
    logger.debug("Using local Deno KV");
  }
  return kvUrl;
};

/**
 * Get KV path from options or environment variables
 *
 * @param options - Optional connection options
 * @returns KV path string or undefined
 * @since 1.11.0
 */
const getKVPath = (options?: KVConnectionOptions): string | undefined => {
  if (kvPath !== undefined) return kvPath;
  kvPath = options?.kvPath || Deno.env.get("DENO_KV_PATH") || undefined;
  return kvPath;
};

/**
 * Get KV connection - supports both local file and remote Deno Deploy KV
 * Uses singleton pattern to cache connection
 *
 * Automatically handles:
 * - Local file-based KV (via DENO_KV_PATH or kvPath option)
 * - Remote Deno Deploy KV (via DENO_KV_URL or kvUrl option)
 * - Authentication token (via DENO_KV_ACCESS_TOKEN or accessToken option)
 * - Fallback to local KV if remote authentication fails (if DENO_KV_ALLOW_LOCAL_FALLBACK=true)
 *
 * @param options - Optional connection configuration
 * @returns Promise resolving to Deno.Kv instance
 * @throws {Error} If KV connection fails and no fallback is available
 *
 * @example
 * ```ts
 * // Local KV (development)
 * const kv = await getKV({ kvPath: "./data/deno.kv" });
 *
 * // Remote KV (production)
 * const kv = await getKV({
 *   kvUrl: "https://api.deno.com/kv/...",
 *   accessToken: "your-token"
 * });
 *
 * // Using environment variables
 * // DENO_KV_PATH=./data/deno.kv
 * // DENO_KV_URL=https://api.deno.com/kv/...
 * // DENO_KV_ACCESS_TOKEN=your-token
 * const kv = await getKV();
 * ```
 *
 * @since 1.11.0
 */
export async function getKV(options?: KVConnectionOptions): Promise<Deno.Kv> {
  if (kvInstance) {
    return kvInstance;
  }

  const url = getKVUrl(options);
  const path = getKVPath(options);
  const accessToken = options?.accessToken || Deno.env.get("DENO_KV_ACCESS_TOKEN");
  const allowLocalFallback = Deno.env.get("DENO_KV_ALLOW_LOCAL_FALLBACK") === "true";

  // Remote KV (Deno Deploy)
  if (url) {
    try {
      logger.info("Opening remote KV connection", {
        url: url.substring(0, 50) + "...",
        hasAccessToken: !!accessToken,
        tokenLength: accessToken?.length || 0,
        tokenPreview: accessToken
          ? `${accessToken.substring(0, 8)}...${accessToken.substring(accessToken.length - 4)}`
          : "none",
      });

      // Deno.openKv(url) automatically uses DENO_KV_ACCESS_TOKEN env var
      kvInstance = await Deno.openKv(url);

      // Test the connection by trying to list (this will fail if auth is invalid)
      try {
        const testIterator = kvInstance.list({ prefix: [] }, { limit: 1 });
        await testIterator.next();
        logger.info("Initialized remote Deno KV connection (tested)");
      } catch (testError) {
        const testErrorMessage = testError instanceof Error ? testError.message : String(testError);
        if (
          testErrorMessage.includes("invalidToken") ||
          testErrorMessage.includes("bearer token is invalid")
        ) {
          logger.error("KV authentication failed - token is invalid", {
            hasAccessToken: !!accessToken,
            tokenPreview: accessToken ? `${accessToken.substring(0, 8)}...` : "none",
          });
          if (allowLocalFallback) {
            logger.warn("Falling back to local KV (DENO_KV_ALLOW_LOCAL_FALLBACK=true)");
            if (kvInstance) {
              try {
                kvInstance.close();
              } catch (error) {
                logger.error("Error closing KV connection", {
                  error: error instanceof Error ? error.message : String(error),
                });
              }
            }
            kvInstance = null;
            kvInstance = await Deno.openKv(path || undefined);
            logger.info("Initialized local Deno KV connection (fallback)");
            return kvInstance;
          }
          throw new Error(
            `Deno KV authentication failed: Invalid access token. ` +
              `Please check your DENO_KV_ACCESS_TOKEN environment variable. ` +
              `To use local KV as fallback, set DENO_KV_ALLOW_LOCAL_FALLBACK=true`,
          );
        }
        throw testError;
      }

      return kvInstance;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      // If it's an auth error and fallback is allowed, try local KV
      if (
        allowLocalFallback &&
        (errorMessage.includes("invalidToken") || errorMessage.includes("bearer token is invalid"))
      ) {
        logger.warn("Remote KV authentication failed, falling back to local KV", {
          error: errorMessage,
        });
        try {
          kvInstance = await Deno.openKv(path || undefined);
          logger.info("Initialized local Deno KV connection (fallback)");
          return kvInstance;
        } catch (localError) {
          logger.error("Local KV fallback also failed", {
            error: localError instanceof Error ? localError.message : String(localError),
          });
          throw error; // Throw original error
        }
      }
      logger.error("Failed to initialize remote KV", {
        error: errorMessage,
        url: url.substring(0, 50) + "...",
        hasAccessToken: !!accessToken,
        tokenPreview: accessToken ? `${accessToken.substring(0, 8)}...` : "none",
        allowLocalFallback,
      });
      throw error;
    }
  }

  // Local file KV
  if (path) {
    logger.info("Opening local KV", { path });
    kvInstance = await Deno.openKv(path);
    logger.info("Initialized local Deno KV connection", { path });
    return kvInstance;
  }

  // Default: local KV (no path specified)
  kvInstance = await Deno.openKv();
  logger.info("Initialized local Deno KV connection (default)");
  return kvInstance;
}

/**
 * Close KV connection (cleanup)
 *
 * Closes the cached KV connection instance. Useful for cleanup in tests or when
 * switching between different KV instances.
 *
 * @returns Promise that resolves when connection is closed
 *
 * @example
 * ```ts
 * const kv = await getKV();
 * // ... use KV ...
 * await closeKV();
 * ```
 *
 * @since 1.11.0
 */
export const closeKV = async (): Promise<void> => {
  if (kvInstance) {
    await kvInstance.close();
    kvInstance = null;
    logger.info("Closed KV connection");
  }
};

/**
 * Reset KV connection state
 *
 * Clears the cached KV instance and resets configuration. Useful for testing
 * or when you need to force a new connection with different settings.
 *
 * @example
 * ```ts
 * await getKV({ kvPath: "./data1.kv" });
 * resetKV();
 * await getKV({ kvPath: "./data2.kv" }); // Will use new path
 * ```
 *
 * @since 1.11.0
 */
export const resetKV = (): void => {
  kvInstance = null;
  kvUrl = undefined;
  kvPath = undefined;
};

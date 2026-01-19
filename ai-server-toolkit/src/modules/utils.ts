/**
 * Utility functions module exports
 *
 * @since 1.11.0
 */

// Rate limiter utilities
export {
  canMakeRequest,
  createRateLimiter,
  estimateTokens,
  getWaitTime,
  type RateLimitState,
  recordRequest,
  withRateLimit,
} from "../utils/rate-limiter.ts";

// Document utilities
export {
  contentTypeToMimeType,
  extractContentFromMetadata,
  storeContentInMetadata,
} from "../utils/document.ts";

// Logger functionality
export { createSubLogger, logger } from "../utils/logger.ts";

// KV connection helper utilities (NEW in v1.11.0)
/**
 * KV connection helper utilities
 *
 * Provides unified KV connection for local and remote databases.
 * Supports both local file-based KV and Deno Deploy remote KV.
 *
 * @since 1.11.0
 */
export * from "../utils/kv-helper.ts";

// Generic error handling utilities (NEW in v1.11.0)
/**
 * Generic error handling utilities
 *
 * Provides standardized error objects and utilities for consistent error handling.
 *
 * @since 1.11.0
 */
export * from "../utils/errors.ts";

// Generic CRUD service factory (NEW in v1.11.0)
/**
 * Generic CRUD service factory
 *
 * Provides a reusable CRUD service factory for workspace-scoped entities.
 *
 * @since 1.11.0
 */
export * from "../services/crud-service.ts";


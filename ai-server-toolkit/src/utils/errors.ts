/**
 * Generic error handling utilities for application errors
 *
 * Provides standardized error objects and utilities for consistent error handling
 * across applications using the toolkit.
 *
 * @since 1.11.0
 */

/**
 * Standard error codes for application errors
 *
 * @since 1.11.0
 */
export enum ErrorCode {
  /** Validation error - invalid input data */
  VALIDATION_ERROR = "VALIDATION_ERROR",
  /** Resource not found */
  NOT_FOUND = "NOT_FOUND",
  /** Unauthorized access */
  UNAUTHORIZED = "UNAUTHORIZED",
  /** Forbidden access */
  FORBIDDEN = "FORBIDDEN",
  /** Internal server error */
  INTERNAL_ERROR = "INTERNAL_ERROR",
  /** Service unavailable */
  SERVICE_UNAVAILABLE = "SERVICE_UNAVAILABLE",
  /** Rate limit exceeded */
  RATE_LIMIT_EXCEEDED = "RATE_LIMIT_EXCEEDED",
  /** Bad request */
  BAD_REQUEST = "BAD_REQUEST",
}

/**
 * Application error interface
 *
 * All application errors should implement this interface for consistent handling
 *
 * @since 1.11.0
 */
export interface AppError extends Error {
  /** Error code from ErrorCode enum */
  code: ErrorCode;
  /** HTTP status code */
  statusCode: number;
  /** Optional error details */
  details?: Record<string, unknown>;
  /** Whether this is an operational error (expected) vs programming error */
  isOperational: boolean;
}

/**
 * Create a validation error
 *
 * Use this error when user input fails validation rules.
 * Status code: 400
 *
 * @param message - Error message
 * @param details - Optional error details (e.g., field names, validation rules)
 * @returns AppError instance
 *
 * @example
 * ```ts
 * if (!email || !email.includes('@')) {
 *   throw createValidationError('Invalid email format', { field: 'email', value: email });
 * }
 * ```
 *
 * @since 1.11.0
 */
export function createValidationError(
  message: string,
  details?: Record<string, unknown>,
): AppError {
  const error = new Error(message) as AppError;
  error.name = "ValidationError";
  error.code = ErrorCode.VALIDATION_ERROR;
  error.statusCode = 400;
  error.isOperational = true;
  error.details = details;
  return error;
}

/**
 * Create a not found error
 *
 * Use this error when a resource (entity, file, etc.) is not found.
 * Status code: 404
 *
 * @param message - Error message
 * @param details - Optional error details (e.g., resource ID, resource type)
 * @returns AppError instance
 *
 * @example
 * ```ts
 * const user = await getUser(id);
 * if (!user) {
 *   throw createNotFoundError('User not found', { userId: id });
 * }
 * ```
 *
 * @since 1.11.0
 */
export function createNotFoundError(
  message: string,
  details?: Record<string, unknown>,
): AppError {
  const error = new Error(message) as AppError;
  error.name = "NotFoundError";
  error.code = ErrorCode.NOT_FOUND;
  error.statusCode = 404;
  error.isOperational = true;
  error.details = details;
  return error;
}

/**
 * Create a service unavailable error
 *
 * Use this error when an external service or dependency is unavailable.
 * Status code: 503
 *
 * @param message - Error message
 * @param details - Optional error details (e.g., service name, retry after)
 * @returns AppError instance
 *
 * @example
 * ```ts
 * try {
 *   await externalService.call();
 * } catch (error) {
 *   throw createServiceUnavailableError('External service unavailable', { service: 'payment-gateway' });
 * }
 * ```
 *
 * @since 1.11.0
 */
export function createServiceUnavailableError(
  message: string,
  details?: Record<string, unknown>,
): AppError {
  const error = new Error(message) as AppError;
  error.name = "ServiceUnavailableError";
  error.code = ErrorCode.SERVICE_UNAVAILABLE;
  error.statusCode = 503;
  error.isOperational = true;
  error.details = details;
  return error;
}

/**
 * Create a rate limit error
 *
 * Use this error when a rate limit is exceeded.
 * Status code: 429
 *
 * @param message - Error message
 * @param details - Optional error details (e.g., limit, retryAfter seconds)
 * @returns AppError instance
 *
 * @example
 * ```ts
 * if (requestCount > limit) {
 *   throw createRateLimitError('Rate limit exceeded', { limit, retryAfter: 60 });
 * }
 * ```
 *
 * @since 1.11.0
 */
export function createRateLimitError(
  message: string,
  details?: Record<string, unknown>,
): AppError {
  const error = new Error(message) as AppError;
  error.name = "RateLimitError";
  error.code = ErrorCode.RATE_LIMIT_EXCEEDED;
  error.statusCode = 429;
  error.isOperational = true;
  error.details = details;
  return error;
}

/**
 * Type guard to check if an error is an AppError
 *
 * @param error - Error to check
 * @returns True if error is an AppError instance
 *
 * @example
 * ```ts
 * try {
 *   await someOperation();
 * } catch (error) {
 *   if (isAppError(error)) {
 *     console.log(`Error code: ${error.code}, Status: ${error.statusCode}`);
 *   }
 * }
 * ```
 *
 * @since 1.11.0
 */
export const isAppError = (error: unknown): error is AppError => {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    "statusCode" in error &&
    "isOperational" in error
  );
};

/**
 * Create a standardized error response object
 *
 * Converts any error into a consistent response format suitable for API responses.
 *
 * @param error - Error to convert
 * @returns Standardized error response object
 *
 * @example
 * ```ts
 * try {
 *   await operation();
 * } catch (error) {
 *   const response = createErrorResponse(error);
 *   // { error: "Message", code: "VALIDATION_ERROR", details: {...} }
 * }
 * ```
 *
 * @since 1.11.0
 */
export const createErrorResponse = (error: unknown): {
  error: string;
  code?: string;
  details?: Record<string, unknown>;
} => {
  if (isAppError(error)) {
    return {
      error: error.message,
      code: error.code,
      details: error.details,
    };
  }

  if (error instanceof Error) {
    return {
      error: error.message,
    };
  }

  return {
    error: "An unexpected error occurred",
  };
};

/**
 * Get HTTP status code from an error
 *
 * Extracts the appropriate HTTP status code from an error, defaulting to 500
 * for unknown errors.
 *
 * @param error - Error to extract status code from
 * @returns HTTP status code
 *
 * @example
 * ```ts
 * try {
 *   await operation();
 * } catch (error) {
 *   const statusCode = getStatusCode(error);
 *   ctx.response.status = statusCode;
 * }
 * ```
 *
 * @since 1.11.0
 */
export const getStatusCode = (error: unknown): number => {
  if (isAppError(error)) {
    return error.statusCode;
  }

  if (error instanceof Error) {
    if (error.name === "ValidationError") return 400;
    if (error.name === "NotFoundError") return 404;
    if (error.name === "UnauthorizedError") return 401;
    if (error.name === "ForbiddenError") return 403;
  }

  return 500;
};

// Legacy class exports for backward compatibility (deprecated)
// These will be removed in a future version
/**
 * @deprecated Use createValidationError instead
 * @since 1.11.0
 */
export const ValidationError = createValidationError;

/**
 * @deprecated Use createNotFoundError instead
 * @since 1.11.0
 */
export const NotFoundError = createNotFoundError;

/**
 * @deprecated Use createServiceUnavailableError instead
 * @since 1.11.0
 */
export const ServiceUnavailableError = createServiceUnavailableError;

/**
 * @deprecated Use createRateLimitError instead
 * @since 1.11.0
 */
export const RateLimitError = createRateLimitError;

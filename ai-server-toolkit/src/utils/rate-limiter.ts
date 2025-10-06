// Functional rate limiter for API calls
import type { RateLimitConfig } from "../types.ts";

export interface RateLimitState {
  requests: number[];
  config: RateLimitConfig;
}

/**
 * Creates a rate limiter for controlling API request frequency.
 *
 * Tracks request timestamps and enforces per-minute, per-hour, and per-day limits
 * to prevent exceeding API quotas.
 *
 * @param config Rate limit configuration (requests per minute/hour/day)
 * @returns Rate limiter state for use with withRateLimit
 *
 * @example
 * ```ts
 * const rateLimiter = createRateLimiter({
 *   requestsPerMinute: 50,
 *   requestsPerHour: 1000,
 *   requestsPerDay: 10000
 * });
 * ```
 */
export function createRateLimiter(config: RateLimitConfig): RateLimitState {
  return {
    requests: [],
    config,
  };
}

/**
 * Checks if a request can be made without exceeding rate limits.
 *
 * @param state Rate limiter state
 * @returns True if request can proceed, false if rate limited
 *
 * @example
 * ```ts
 * if (canMakeRequest(rateLimiter)) {
 *   await makeApiCall();
 * }
 * ```
 */
export function canMakeRequest(state: RateLimitState): boolean {
  const now = Date.now();
  const oneMinute = 60 * 1000;
  const oneHour = 60 * 60 * 1000;
  const oneDay = 24 * 60 * 60 * 1000;

  // Clean old requests
  state.requests = state.requests.filter((timestamp) => {
    return now - timestamp < oneDay;
  });

  // Check per-minute limit
  const recentRequests = state.requests.filter((timestamp) => {
    return now - timestamp < oneMinute;
  });

  if (recentRequests.length >= state.config.requestsPerMinute) {
    return false;
  }

  // Check hourly limit if specified
  if (state.config.requestsPerHour) {
    const hourlyRequests = state.requests.filter((timestamp) => {
      return now - timestamp < oneHour;
    });

    if (hourlyRequests.length >= state.config.requestsPerHour) {
      return false;
    }
  }

  // Check daily limit if specified
  if (state.config.requestsPerDay) {
    if (state.requests.length >= state.config.requestsPerDay) {
      return false;
    }
  }

  return true;
}

/**
 * Records a request timestamp for rate limit tracking.
 *
 * @param state Rate limiter state
 */
export function recordRequest(state: RateLimitState): void {
  state.requests.push(Date.now());
}

/**
 * Executes a function with automatic rate limiting.
 *
 * Checks rate limits before execution and throws an error if exceeded.
 * Automatically records the request timestamp.
 *
 * @param state Rate limiter state
 * @param fn Async function to execute
 * @returns Promise resolving to function result
 * @throws Error if rate limit is exceeded
 *
 * @example
 * ```ts
 * const result = await withRateLimit(rateLimiter, async () => {
 *   return await embedText(embeddings, "some text");
 * });
 * ```
 */
export async function withRateLimit<T>(
  state: RateLimitState,
  fn: () => Promise<T>,
): Promise<T> {
  if (!canMakeRequest(state)) {
    throw new Error("Rate limit exceeded");
  }

  recordRequest(state);
  return await fn();
}

/**
 * Calculates how long to wait before the next request can be made.
 *
 * @param state Rate limiter state
 * @returns Wait time in milliseconds (0 if request can be made immediately)
 *
 * @example
 * ```ts
 * const waitMs = getWaitTime(rateLimiter);
 * if (waitMs > 0) {
 *   console.log(`Wait ${waitMs}ms before next request`);
 *   await new Promise(resolve => setTimeout(resolve, waitMs));
 * }
 * ```
 */
export function getWaitTime(state: RateLimitState): number {
  if (canMakeRequest(state)) {
    return 0;
  }

  const now = Date.now();
  const oneMinute = 60 * 1000;

  const recentRequests = state.requests.filter((timestamp) => {
    return now - timestamp < oneMinute;
  });

  if (recentRequests.length >= state.config.requestsPerMinute) {
    const oldestRequest = Math.min(...recentRequests);
    return oneMinute - (now - oldestRequest);
  }

  return 0;
}

/**
 * Estimates the number of tokens in a text string.
 *
 * Uses a rough approximation of ~4 characters per token. For accurate
 * token counting, use a proper tokenizer library.
 *
 * @param text Text to estimate tokens for
 * @returns Estimated token count
 *
 * @example
 * ```ts
 * const tokens = estimateTokens("Hello, world!");
 * console.log(tokens); // ~4 tokens
 * ```
 */
export function estimateTokens(text: string): number {
  // Rough estimation: ~4 characters per token
  return Math.ceil(text.length / 4);
}

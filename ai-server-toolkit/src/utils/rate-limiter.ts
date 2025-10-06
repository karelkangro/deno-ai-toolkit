// Functional rate limiter for API calls
import type { RateLimitConfig } from "../types.ts";

export interface RateLimitState {
  requests: number[];
  config: RateLimitConfig;
}

export function createRateLimiter(config: RateLimitConfig): RateLimitState {
  return {
    requests: [],
    config,
  };
}

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

export function recordRequest(state: RateLimitState): void {
  state.requests.push(Date.now());
}

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

export function estimateTokens(text: string): number {
  // Rough estimation: ~4 characters per token
  return Math.ceil(text.length / 4);
}

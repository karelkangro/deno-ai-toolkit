// Functional OpenAI embeddings integration
import { createRateLimiter, type RateLimitState, withRateLimit } from "../utils/rate-limiter.ts";
import type { EmbeddingConfig } from "../types.ts";

// Define locally to avoid import issues, but must match types.ts
export interface EmbeddingModel {
  embedText(text: string): Promise<number[]>;
  embedTexts(texts: string[]): Promise<number[][]>;
}

interface OpenAIState {
  apiKey: string;
  model: string;
  dimensions: number;
  rateLimiter: RateLimitState;
}

interface OpenAIEmbeddingResponse {
  data: Array<{ embedding: number[] }>;
}

/**
 * Creates an OpenAI embeddings provider with rate limiting.
 *
 * Initializes the embedding service with the specified model and configuration.
 * Includes automatic rate limiting to stay within OpenAI API limits.
 *
 * @param config Embedding configuration with API key, model, and dimensions
 * @returns OpenAI embedding model implementing the EmbeddingModel interface
 *
 * @example
 * ```ts
 * const embeddings = createOpenAIEmbeddings({
 *   provider: "openai",
 *   apiKey: "sk-...",
 *   model: "text-embedding-3-small",
 *   dimensions: 1536
 * });
 * ```
 */
export function createOpenAIEmbeddings(
  config: EmbeddingConfig,
): EmbeddingModel {
  if (!config.apiKey) {
    throw new Error("OpenAI API key is required");
  }

  const state: OpenAIState = {
    apiKey: config.apiKey,
    model: config.model || "text-embedding-3-small",
    dimensions: config.dimensions || 1536,
    rateLimiter: createRateLimiter({
      requestsPerMinute: 3000,
      requestsPerHour: 200000,
    }),
  };

  const embedText = async (text: string): Promise<number[]> => {
    return await withRateLimit(state.rateLimiter, async () => {
      const response = await fetch("https://api.openai.com/v1/embeddings", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${state.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: state.model,
          input: text,
          dimensions: state.dimensions,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`OpenAI API error: ${response.status} - ${error}`);
      }

      const data = await response.json();

      if (!data.data || !data.data[0] || !data.data[0].embedding) {
        throw new Error("Invalid response from OpenAI API");
      }

      return data.data[0].embedding;
    });
  };

  const embedTexts = async (texts: string[]): Promise<number[][]> => {
    if (texts.length === 0) {
      return [];
    }

    if (texts.length === 1) {
      return [await embedText(texts[0])];
    }

    return await withRateLimit(state.rateLimiter, async () => {
      const response = await fetch("https://api.openai.com/v1/embeddings", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${state.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: state.model,
          input: texts,
          dimensions: state.dimensions,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`OpenAI API error: ${response.status} - ${error}`);
      }

      const data = await response.json() as OpenAIEmbeddingResponse;

      if (!data.data || !Array.isArray(data.data)) {
        throw new Error("Invalid response from OpenAI API");
      }

      return data.data.map((item) => item.embedding);
    });
  };

  return {
    embedText,
    embedTexts,
  };
}

/**
 * @deprecated Use createOpenAIEmbeddings().embedText() instead
 */
export async function embedText(
  model: EmbeddingModel,
  text: string,
): Promise<number[]> {
  return await model.embedText(text);
}

/**
 * @deprecated Use createOpenAIEmbeddings().embedTexts() instead
 */
export async function embedTexts(
  model: EmbeddingModel,
  texts: string[],
): Promise<number[][]> {
  return await model.embedTexts(texts);
}

export function calculateSimilarity(
  embedding1: number[],
  embedding2: number[],
): number {
  if (embedding1.length !== embedding2.length) {
    throw new Error("Embeddings must have the same dimensions");
  }

  let dotProduct = 0;
  let norm1 = 0;
  let norm2 = 0;

  for (let i = 0; i < embedding1.length; i++) {
    dotProduct += embedding1[i] * embedding2[i];
    norm1 += embedding1[i] * embedding1[i];
    norm2 += embedding2[i] * embedding2[i];
  }

  if (norm1 === 0 || norm2 === 0) {
    return 0;
  }

  return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
}

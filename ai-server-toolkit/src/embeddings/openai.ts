// Functional OpenAI embeddings integration
import { createRateLimiter, type RateLimitState, withRateLimit } from "../utils/rate-limiter.ts";
import type { EmbeddingConfig } from "../types.ts";

export interface OpenAIEmbeddingState {
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
 * @returns OpenAI embedding state for use with embedText and embedTexts
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
): OpenAIEmbeddingState {
  if (!config.apiKey) {
    throw new Error("OpenAI API key is required");
  }

  return {
    apiKey: config.apiKey,
    model: config.model || "text-embedding-3-small",
    dimensions: config.dimensions || 1536,
    rateLimiter: createRateLimiter({
      requestsPerMinute: 3000,
      requestsPerHour: 200000,
    }),
  };
}

/**
 * Converts a text string into a vector embedding.
 *
 * Uses OpenAI's embedding API to generate a numerical vector representation
 * of the input text, suitable for semantic search and similarity comparisons.
 *
 * @param state OpenAI embedding state from createOpenAIEmbeddings
 * @param text Text to convert into embedding
 * @returns Promise resolving to embedding vector (array of numbers)
 *
 * @example
 * ```ts
 * const embedding = await embedText(embeddings, "Hello world");
 * console.log(embedding.length); // 1536
 * ```
 */
export async function embedText(
  state: OpenAIEmbeddingState,
  text: string,
): Promise<number[]> {
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
}

/**
 * Converts multiple text strings into vector embeddings in batch.
 *
 * More efficient than calling embedText multiple times. Uses a single API
 * call to generate embeddings for all texts.
 *
 * @param state OpenAI embedding state from createOpenAIEmbeddings
 * @param texts Array of text strings to convert into embeddings
 * @returns Promise resolving to array of embedding vectors
 *
 * @example
 * ```ts
 * const embeddings = await embedTexts(embeddingState, [
 *   "First document",
 *   "Second document",
 *   "Third document"
 * ]);
 * console.log(embeddings.length); // 3
 * ```
 */
export async function embedTexts(
  state: OpenAIEmbeddingState,
  texts: string[],
): Promise<number[][]> {
  if (texts.length === 0) {
    return [];
  }

  if (texts.length === 1) {
    return [await embedText(state, texts[0])];
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

// Functional Claude LLM integration
import { createRateLimiter, type RateLimitState, withRateLimit } from "../utils/rate-limiter.ts";
import type {
  GenerateResponseOptions,
  LLMConfig,
  LLMMessage,
  LLMModel,
  LLMResponse,
  SystemMessageBlock,
  ToolDefinition,
} from "../types.ts";

/**
 * Get Anthropic API version from environment variable or use default.
 * @param withCaching - Whether to use caching-enabled version
 * @returns API version string
 */
const getAnthropicApiVersion = (withCaching = false): string => {
  const envVar = withCaching
    ? Deno.env.get("ANTHROPIC_API_VERSION_WITH_CACHING")
    : Deno.env.get("ANTHROPIC_API_VERSION");

  return envVar || "2024-06-20";
};

interface ClaudeState {
  apiKey: string;
  model: string;
  maxTokens: number;
  temperature: number;
  rateLimiter: RateLimitState;
}

interface ClaudeRequestBody {
  model: string;
  max_tokens: number;
  temperature: number;
  system?: Array<SystemMessageBlock>;
  messages: Array<{ role: string; content: string | Array<{ type: string; text: string }> }>;
  stream?: boolean;
  tools?: Array<{
    name: string;
    description: string;
    input_schema: {
      type: string;
      properties: Record<string, unknown>;
    };
  }>;
}

interface ClaudeContentItem {
  type: string;
  text?: string;
}

interface ClaudeUsage {
  input_tokens?: number;
  output_tokens?: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
}

interface ClaudeResponse {
  content?: ClaudeContentItem[];
  usage?: ClaudeUsage;
  model?: string;
  stop_reason?: string;
  error?: { message: string };
}

/**
 * Creates a Claude LLM client with rate limiting.
 *
 * Initializes the Claude API client with the specified model and configuration.
 * Includes automatic rate limiting to stay within Anthropic API limits.
 *
 * @param config LLM configuration with API key, model, and parameters
 * @returns Claude LLM model implementing the LLMModel interface
 *
 * @example
 * ```ts
 * const llm = createClaudeLLM({
 *   provider: "claude",
 *   apiKey: "sk-ant-...",
 *   model: "claude-3-5-sonnet-20241022",
 *   maxTokens: 4096,
 *   temperature: 0.7
 * });
 * ```
 */
export function createClaudeLLM(config: LLMConfig): LLMModel {
  if (!config.apiKey) {
    throw new Error("Claude API key is required");
  }

  const state: ClaudeState = {
    apiKey: config.apiKey,
    model: config.model || "claude-3-sonnet-20240229",
    maxTokens: config.maxTokens || 4096,
    temperature: config.temperature || 0.7,
    rateLimiter: createRateLimiter({
      requestsPerMinute: 50,
      requestsPerHour: 1000,
    }),
  };

  const generateResponse = async (
    messages: LLMMessage[],
    tools?: ToolDefinition[],
    options?: GenerateResponseOptions,
  ): Promise<LLMResponse> => {
    return await withRateLimit(state.rateLimiter, async () => {
      // Separate system messages from regular messages
      const systemMessages: SystemMessageBlock[] = [];
      const regularMessages: Array<{ role: string; content: string }> = [];

      // Process messages - system messages go to system array, others to messages
      for (const msg of messages) {
        if (msg.role === "system") {
          systemMessages.push({
            type: "text",
            text: msg.content,
          });
        } else {
          regularMessages.push({
            role: msg.role,
            content: msg.content,
          });
        }
      }

      // Merge with options.system if provided
      const finalSystem = options?.system || systemMessages;

      const requestBody: ClaudeRequestBody = {
        model: state.model,
        max_tokens: state.maxTokens,
        temperature: state.temperature,
        ...(finalSystem.length > 0 ? { system: finalSystem } : {}),
        messages: regularMessages,
        ...(tools && tools.length > 0
          ? {
            tools: tools.map((tool) => ({
              name: tool.name,
              description: tool.description,
              input_schema: {
                type: "object",
                properties: tool.parameters,
              },
            })),
          }
          : {}),
      };

      // Use API version from env or default, with caching support if system messages present
      const apiVersion = getAnthropicApiVersion(finalSystem.length > 0);

      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": state.apiKey,
          "Content-Type": "application/json",
          "anthropic-version": apiVersion,
          ...(tools && tools.length > 0 ? { "anthropic-beta": "tools-2024-04-04" } : {}),
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Claude API error: ${response.status} - ${error}`);
      }

      const data = await response.json() as ClaudeResponse;

      if (data.error) {
        throw new Error(`Claude API error: ${data.error.message}`);
      }

      let content = "";
      if (data.content && Array.isArray(data.content)) {
        content = data.content
          .filter((item) => item.type === "text")
          .map((item) => item.text || "")
          .join("");
      }

      return {
        content,
        usage: data.usage
          ? {
            promptTokens: data.usage.input_tokens || 0,
            completionTokens: data.usage.output_tokens || 0,
            totalTokens: (data.usage.input_tokens || 0) +
              (data.usage.output_tokens || 0),
            cacheCreationInputTokens: data.usage.cache_creation_input_tokens,
            cacheReadInputTokens: data.usage.cache_read_input_tokens,
          }
          : undefined,
        metadata: {
          model: data.model,
          stopReason: data.stop_reason,
        },
      };
    });
  };

  const streamResponse = async (
    messages: LLMMessage[],
    onChunk?: (chunk: string) => void,
    tools?: ToolDefinition[],
  ): Promise<LLMResponse> => {
    return await withRateLimit(state.rateLimiter, async () => {
      const anthropicMessages = messages.map((msg) => ({
        role: msg.role === "system" ? "user" : msg.role,
        content: msg.role === "system" ? `System: ${msg.content}` : msg.content,
      }));

      const requestBody: ClaudeRequestBody = {
        model: state.model,
        max_tokens: state.maxTokens,
        temperature: state.temperature,
        messages: anthropicMessages,
        stream: true,
        ...(tools && tools.length > 0
          ? {
            tools: tools.map((tool) => ({
              name: tool.name,
              description: tool.description,
              input_schema: {
                type: "object",
                properties: tool.parameters,
              },
            })),
          }
          : {}),
      };

      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": state.apiKey,
          "Content-Type": "application/json",
          "anthropic-version": getAnthropicApiVersion(false),
          ...(tools && tools.length > 0 ? { "anthropic-beta": "tools-2024-04-04" } : {}),
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Claude API error: ${response.status} - ${error}`);
      }

      let fullContent = "";
      let usage: {
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
      } | undefined = undefined;

      if (response.body) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value);
            const lines = chunk.split("\n");

            for (const line of lines) {
              if (line.startsWith("data: ")) {
                try {
                  const data = JSON.parse(line.slice(6));

                  if (data.type === "content_block_delta") {
                    const text = data.delta?.text || "";
                    fullContent += text;
                    if (onChunk) {
                      onChunk(text);
                    }
                  }

                  if (data.type === "message_delta" && data.usage) {
                    usage = {
                      promptTokens: 0,
                      completionTokens: data.usage.output_tokens || 0,
                      totalTokens: data.usage.output_tokens || 0,
                    };
                  }
                } catch (_e) {
                  // Ignore JSON parse errors for incomplete chunks
                  // JSON parse errors for incomplete chunks are expected during streaming
                  // Silently ignore to avoid log spam
                }
              }
            }
          }
        } finally {
          reader.releaseLock();
        }
      }

      return {
        content: fullContent,
        usage,
        metadata: {
          model: state.model,
          streaming: true,
        },
      };
    });
  };

  return {
    generateResponse,
    streamResponse,
  };
}

/**
 * @deprecated Use createClaudeLLM().generateResponse() instead
 */
export async function generateResponse(
  model: LLMModel,
  messages: LLMMessage[],
  tools?: ToolDefinition[],
  options?: GenerateResponseOptions,
): Promise<LLMResponse> {
  return await model.generateResponse(messages, tools, options);
}

/**
 * @deprecated Use createClaudeLLM().streamResponse() instead
 */
export async function streamResponse(
  model: LLMModel,
  messages: LLMMessage[],
  onChunk?: (chunk: string) => void,
  tools?: ToolDefinition[],
): Promise<LLMResponse> {
  return await model.streamResponse(messages, onChunk, tools);
}

// Functional Claude LLM integration
import {
  createRateLimiter,
  type RateLimitState,
  withRateLimit,
} from "../utils/rate-limiter.ts";
import type {
  LLMConfig,
  LLMMessage,
  LLMResponse,
  ToolDefinition,
} from "../types.ts";

export interface ClaudeLLMState {
  apiKey: string;
  model: string;
  maxTokens: number;
  temperature: number;
  rateLimiter: RateLimitState;
}

export function createClaudeLLM(config: LLMConfig): ClaudeLLMState {
  if (!config.apiKey) {
    throw new Error("Claude API key is required");
  }

  return {
    apiKey: config.apiKey,
    model: config.model || "claude-3-sonnet-20240229",
    maxTokens: config.maxTokens || 4096,
    temperature: config.temperature || 0.7,
    rateLimiter: createRateLimiter({
      requestsPerMinute: 50,
      requestsPerHour: 1000,
    }),
  };
}

export async function generateResponse(
  state: ClaudeLLMState,
  messages: LLMMessage[],
  tools?: ToolDefinition[],
): Promise<LLMResponse> {
  return await withRateLimit(state.rateLimiter, async () => {
    const anthropicMessages = messages.map((msg) => ({
      role: msg.role === "system" ? "user" : msg.role,
      content: msg.role === "system" ? `System: ${msg.content}` : msg.content,
    }));

    const requestBody: any = {
      model: state.model,
      max_tokens: state.maxTokens,
      temperature: state.temperature,
      messages: anthropicMessages,
    };

    if (tools && tools.length > 0) {
      requestBody.tools = tools.map((tool) => ({
        name: tool.name,
        description: tool.description,
        input_schema: {
          type: "object",
          properties: tool.parameters,
        },
      }));
    }

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": state.apiKey,
        "Content-Type": "application/json",
        "anthropic-version": "2023-06-01",
        ...(tools && tools.length > 0
          ? { "anthropic-beta": "tools-2024-04-04" }
          : {}),
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Claude API error: ${response.status} - ${error}`);
    }

    const data = await response.json();

    if (data.error) {
      throw new Error(`Claude API error: ${data.error.message}`);
    }

    let content = "";
    if (data.content && Array.isArray(data.content)) {
      content = data.content
        .filter((item: any) => item.type === "text")
        .map((item: any) => item.text)
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
        }
        : undefined,
      metadata: {
        model: data.model,
        stopReason: data.stop_reason,
      },
    };
  });
}

export async function streamResponse(
  state: ClaudeLLMState,
  messages: LLMMessage[],
  onChunk?: (chunk: string) => void,
  tools?: ToolDefinition[],
): Promise<LLMResponse> {
  return await withRateLimit(state.rateLimiter, async () => {
    const anthropicMessages = messages.map((msg) => ({
      role: msg.role === "system" ? "user" : msg.role,
      content: msg.role === "system" ? `System: ${msg.content}` : msg.content,
    }));

    const requestBody: any = {
      model: state.model,
      max_tokens: state.maxTokens,
      temperature: state.temperature,
      messages: anthropicMessages,
      stream: true,
    };

    if (tools && tools.length > 0) {
      requestBody.tools = tools.map((tool) => ({
        name: tool.name,
        description: tool.description,
        input_schema: {
          type: "object",
          properties: tool.parameters,
        },
      }));
    }

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": state.apiKey,
        "Content-Type": "application/json",
        "anthropic-version": "2023-06-01",
        ...(tools && tools.length > 0
          ? { "anthropic-beta": "tools-2024-04-04" }
          : {}),
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Claude API error: ${response.status} - ${error}`);
    }

    let fullContent = "";
    let usage = undefined;

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
              } catch (e) {
                // Ignore JSON parse errors for incomplete chunks
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
}

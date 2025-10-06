// Functional agent implementation
import {
  type ClaudeLLMState,
  createClaudeLLM,
  generateResponse,
} from "../llm/claude.ts";
import type {
  AgentConfig,
  AgentResult,
  LLMConfig,
  LLMMessage,
  ToolDefinition,
} from "../types.ts";

export interface AgentState {
  name: string;
  description: string;
  systemPrompt: string;
  tools: ToolDefinition[];
  llm: ClaudeLLMState;
  memory: LLMMessage[];
  memoryEnabled: boolean;
}

export function createAgent(config: AgentConfig): AgentState {
  return {
    name: config.name,
    description: config.description,
    systemPrompt: config.systemPrompt,
    tools: config.tools || [],
    llm: createClaudeLLM(config.llm),
    memory: [],
    memoryEnabled: config.memory || false,
  };
}

export async function runAgent(
  state: AgentState,
  input: string,
  context?: Record<string, any>,
): Promise<AgentResult> {
  try {
    const messages: LLMMessage[] = [
      { role: "system", content: state.systemPrompt },
    ];

    // Add memory if enabled
    if (state.memoryEnabled && state.memory.length > 0) {
      messages.push(...state.memory);
    }

    // Add context if provided
    if (context) {
      const contextStr = Object.entries(context)
        .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
        .join("\n");
      messages.push({
        role: "system",
        content: `Additional context:\n${contextStr}`,
      });
    }

    // Add user input
    messages.push({ role: "user", content: input });

    // Generate response
    const response = await generateResponse(
      state.llm,
      messages,
      state.tools.length > 0 ? state.tools : undefined,
    );

    // Handle tool calls if present
    const toolCalls: Array<{ tool: string; params: any; result: any }> = [];

    // Enhanced tool call detection with JSON parsing
    if (state.tools.length > 0 && response.content.includes('"tool_calls"')) {
      try {
        // Try to parse JSON response with tool calls
        const jsonMatch = response.content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          if (parsed.tool_calls && Array.isArray(parsed.tool_calls)) {
            for (const call of parsed.tool_calls) {
              const tool = state.tools.find((t) => t.name === call.name);
              if (tool) {
                try {
                  const result = await tool.handler(call.parameters || {});
                  toolCalls.push({
                    tool: tool.name,
                    params: call.parameters || {},
                    result,
                  });
                } catch (error) {
                  toolCalls.push({
                    tool: tool.name,
                    params: call.parameters || {},
                    result: {
                      error: error instanceof Error
                        ? error.message
                        : String(error),
                    },
                  });
                }
              }
            }
          }
        }
      } catch (parseError) {
        // Fallback to simple detection
        for (const tool of state.tools) {
          if (response.content.includes(tool.name)) {
            try {
              const result = await tool.handler({});
              toolCalls.push({
                tool: tool.name,
                params: {},
                result,
              });
            } catch (error) {
              toolCalls.push({
                tool: tool.name,
                params: {},
                result: {
                  error: error instanceof Error ? error.message : String(error),
                },
              });
            }
          }
        }
      }
    }

    // Update memory if enabled
    if (state.memoryEnabled) {
      state.memory.push({ role: "user", content: input });
      state.memory.push({ role: "assistant", content: response.content });

      // Keep memory within reasonable limits (last 20 messages)
      if (state.memory.length > 20) {
        state.memory = state.memory.slice(-20);
      }
    }

    return {
      success: true,
      content: response.content,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      usage: response.usage,
    };
  } catch (error) {
    return {
      success: false,
      content: "",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export function addTool(state: AgentState, tool: ToolDefinition): void {
  state.tools.push(tool);
}

export function removeTool(state: AgentState, toolName: string): void {
  state.tools = state.tools.filter((tool) => tool.name !== toolName);
}

export function clearMemory(state: AgentState): void {
  state.memory = [];
}

export function getMemory(state: AgentState): LLMMessage[] {
  return [...state.memory];
}

export function updateSystemPrompt(state: AgentState, prompt: string): void {
  state.systemPrompt = prompt;
}

// Predefined tool factories
export function createSearchTool(
  searchFn: (query: string) => Promise<unknown>,
): ToolDefinition<{ query: string }, unknown> {
  return {
    name: "search",
    description: "Search for information using the provided search function",
    parameters: {
      query: {
        type: "string",
        description: "The search query",
      },
    },
    handler: async (params: { query: string }) => {
      return await searchFn(params.query);
    },
  };
}

export function createCalculatorTool(): ToolDefinition<
  { expression: string },
  { result?: number; error?: string }
> {
  return {
    name: "calculator",
    description: "Perform mathematical calculations",
    parameters: {
      expression: {
        type: "string",
        description: "Mathematical expression to evaluate",
      },
    },
    handler: async (params: { expression: string }) => {
      try {
        // Simple expression evaluation (be careful with eval in production)
        const result = Function(
          `"use strict"; return (${params.expression})`,
        )();
        return { result };
      } catch (error) {
        return { error: "Invalid mathematical expression" };
      }
    },
  };
}

interface WebSearchResult {
  results: Array<{
    title: string;
    snippet: string;
    url: string;
  }>;
}

export function createWebSearchTool(
  apiKey?: string,
): ToolDefinition<{ query: string; limit?: number }, WebSearchResult> {
  return {
    name: "web_search",
    description: "Search the web for current information",
    parameters: {
      query: {
        type: "string",
        description: "The search query",
      },
      limit: {
        type: "number",
        description: "Maximum number of results to return",
        default: 5,
      },
    },
    handler: async (params: { query: string; limit?: number }) => {
      // This would integrate with a real web search API
      return {
        results: [
          {
            title: `Search results for: ${params.query}`,
            snippet: "This is a placeholder result",
            url: "https://example.com",
          },
        ],
      };
    },
  };
}

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

/**
 * Creates an AI agent with tools and memory capabilities.
 *
 * Agents combine LLMs with tool use and optional conversation memory.
 * They can autonomously decide when to use tools based on user input.
 *
 * @param config Agent configuration with name, system prompt, tools, and LLM
 * @returns Agent state for use with runAgent
 *
 * @example
 * ```ts
 * const agent = createAgent({
 *   name: "math-assistant",
 *   description: "Helpful math assistant",
 *   systemPrompt: "You are a math expert. Use tools to help solve problems.",
 *   tools: [createCalculatorTool()],
 *   llm: { provider: "claude", apiKey: "sk-ant-..." },
 *   memory: true
 * });
 * ```
 */
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

/**
 * Executes an agent with the given input and optional context.
 *
 * The agent processes the input using its LLM and tools, maintaining
 * conversation memory if enabled. Automatically handles tool execution.
 *
 * @param state Agent state from createAgent
 * @param input User input text
 * @param context Optional context object with additional information
 * @returns Promise resolving to agent result with content and tool calls
 *
 * @example
 * ```ts
 * const result = await runAgent(agent, "Calculate 15% of 250");
 * console.log(result.content); // "37.5"
 * console.log(result.toolCalls); // [{ tool: "calculator", ... }]
 * ```
 */
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

/**
 * Adds a tool to the agent's available tools.
 *
 * @param state Agent state
 * @param tool Tool definition to add
 */
export function addTool(state: AgentState, tool: ToolDefinition): void {
  state.tools.push(tool);
}

/**
 * Removes a tool from the agent by name.
 *
 * @param state Agent state
 * @param toolName Name of tool to remove
 */
export function removeTool(state: AgentState, toolName: string): void {
  state.tools = state.tools.filter((tool) => tool.name !== toolName);
}

/**
 * Clears the agent's conversation memory.
 *
 * @param state Agent state
 */
export function clearMemory(state: AgentState): void {
  state.memory = [];
}

/**
 * Gets a copy of the agent's conversation memory.
 *
 * @param state Agent state
 * @returns Array of conversation messages
 */
export function getMemory(state: AgentState): LLMMessage[] {
  return [...state.memory];
}

/**
 * Updates the agent's system prompt.
 *
 * @param state Agent state
 * @param prompt New system prompt
 */
export function updateSystemPrompt(state: AgentState, prompt: string): void {
  state.systemPrompt = prompt;
}

// Predefined tool factories

/**
 * Creates a search tool that uses a custom search function.
 *
 * Allows agents to search for information using any search implementation
 * (vector search, web search, database query, etc.).
 *
 * @param searchFn Async function that performs the search
 * @returns Tool definition for use with agents
 *
 * @example
 * ```ts
 * const searchTool = createSearchTool(async (query) => {
 *   return await vectorStore.search(query, { limit: 5 });
 * });
 * ```
 */
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

/**
 * Creates a calculator tool for mathematical operations.
 *
 * Allows agents to perform mathematical calculations using JavaScript expressions.
 * Useful for math-focused agents and general-purpose assistants.
 *
 * @returns Tool definition for calculator functionality
 *
 * @example
 * ```ts
 * const agent = createAgent({
 *   name: "math-bot",
 *   systemPrompt: "You're a math expert",
 *   tools: [createCalculatorTool()],
 *   llm: { provider: "claude", apiKey: "..." }
 * });
 * ```
 */
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

/**
 * Creates a web search tool for accessing current information.
 *
 * Enables agents to search the web for up-to-date information beyond their
 * training data. Currently returns mock results; implement with your preferred
 * search API (Google, Bing, etc.).
 *
 * @param apiKey Optional API key for search service
 * @returns Tool definition for web search functionality
 *
 * @example
 * ```ts
 * const agent = createAgent({
 *   name: "research-bot",
 *   systemPrompt: "You're a research assistant",
 *   tools: [createWebSearchTool("your-api-key")],
 *   llm: { provider: "claude", apiKey: "..." }
 * });
 * ```
 */
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

/**
 * Agent functionality module exports
 *
 * @since 1.11.0
 */

export {
  addTool,
  type AgentState,
  clearMemory,
  createAgent,
  createCalculatorTool,
  createSearchTool,
  createWebSearchTool,
  getMemory,
  removeTool,
  runAgent,
  updateSystemPrompt,
} from "../agents/base.ts";

// Specialized agents for different domains
export {
  type AgentAnalysisResult,
  type AnalysisIssue,
  createArchitectureAgentConfig,
  createSpecializedAgent,
  type ProjectContext,
  type ProjectFile,
  runSpecializedAnalysis,
  type SpecializedAgentConfig,
} from "../agents/specialized.ts";


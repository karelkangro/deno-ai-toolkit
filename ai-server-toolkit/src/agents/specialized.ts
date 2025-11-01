// Specialized agents for different domains - configurable for any project
import { type AgentState, createAgent, runAgent } from "./base.ts";
import type { LLMConfig } from "../types.ts";
import { createSubLogger } from "../utils/logger.ts";

const logger = createSubLogger("agent-specialized");

/**
 * Configuration for creating specialized domain-specific agents.
 *
 * Used to configure agents for specific tasks like architecture analysis,
 * code review, security auditing, etc.
 */
export interface SpecializedAgentConfig {
  domain: string;
  name: string;
  description: string;
  systemPrompt: string;
  llm: LLMConfig;
  tools?: Array<{
    name: string;
    description: string;
    parameters: Record<string, unknown>;
    handler: (params: Record<string, unknown>) => Promise<unknown> | unknown;
  }>;
  responseFormat?: "json" | "text";
  language?: "en" | "et";
}

/**
 * Represents a file in the project for analysis.
 *
 * Contains file name, content, and optional type information.
 */
export interface ProjectFile {
  name: string;
  content: string;
  type?: string;
}

/**
 * Context information for specialized agent analysis.
 *
 * Provides session, user, and project information to guide agent behavior.
 */
export interface ProjectContext {
  sessionId?: string;
  userRole?: string;
  files: ProjectFile[];
  language?: string;
  [key: string]: unknown; // Allow additional context properties
}

/**
 * Represents an issue found during agent analysis.
 *
 * Contains issue details, severity level, and recommendations for fixing.
 */
export interface AnalysisIssue {
  ruleId?: string;
  title: string;
  description: string;
  severity: "low" | "medium" | "high";
  recommendation?: string;
}

/**
 * Result of a specialized agent analysis run.
 *
 * Contains all issues found, recommendations, and execution metadata.
 */
export interface AgentAnalysisResult {
  domain: string;
  issues: AnalysisIssue[];
  recommendations: string[];
  delegationRequests?: string[];
  executionTime?: number;
  tokenUsage?: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
}

/**
 * Creates a specialized agent for domain-specific tasks.
 *
 * Configures an agent optimized for specific domains like architecture
 * review, security audit, code quality, etc.
 *
 * @param config Specialized agent configuration
 * @returns Agent state ready for analysis tasks
 *
 * @example
 * ```ts
 * const architectAgent = createSpecializedAgent({
 *   domain: "architecture",
 *   name: "Architecture Reviewer",
 *   description: "Reviews system architecture",
 *   systemPrompt: "You're an expert architect...",
 *   llm: { provider: "claude", apiKey: "..." }
 * });
 * ```
 */
export function createSpecializedAgent(
  config: SpecializedAgentConfig,
): AgentState {
  logger.debug("Creating specialized agent", {
    agentName: config.name,
    llmModel: config.llm.model,
  });

  return createAgent({
    name: config.name,
    description: config.description,
    systemPrompt: config.systemPrompt,
    tools: config.tools || [],
    llm: config.llm,
    memory: false, // Specialized agents typically don't need memory
  });
}

/**
 * Runs a specialized agent analysis on project files.
 *
 * Executes domain-specific analysis (architecture, security, quality, etc.)
 * on the provided files and returns structured results.
 *
 * @param config Specialized agent configuration
 * @param files Array of project files to analyze
 * @param context Project context with additional information
 * @param customPrompt Optional custom prompt to override default
 * @returns Promise resolving to analysis result with issues and recommendations
 *
 * @example
 * ```ts
 * const result = await runSpecializedAnalysis(
 *   architectConfig,
 *   [{ name: "main.ts", content: "..." }],
 *   { sessionId: "123", userRole: "developer", files: [] }
 * );
 * console.log(result.issues);
 * ```
 */
export async function runSpecializedAnalysis(
  config: SpecializedAgentConfig,
  files: ProjectFile[],
  context: ProjectContext,
  customPrompt?: string,
): Promise<AgentAnalysisResult> {
  const startTime = performance.now();

  logger.info("Starting specialized agent analysis", {
    agentName: config.name,
    fileCount: files.length,
  });

  try {
    const agent = createSpecializedAgent(config);

    // Build input content
    const contentText = files
      .map((f) => `${f.name}: ${f.content}`)
      .join("\n\n");

    // Use custom prompt or build standard analysis prompt
    const analysisPrompt = customPrompt || buildAnalysisPrompt(
      config,
      contentText,
      context,
    );

    logger.debug("Calling agent for analysis", { agentName: config.name });
    const result = await runAgent(agent, analysisPrompt);

    const executionTime = Math.round(performance.now() - startTime);
    logger.info("Agent analysis completed", { agentName: config.name, executionTime });

    if (!result.success) {
      throw new Error(result.error || "Analysis failed");
    }

    // Parse result based on response format
    let analysisResult: AgentAnalysisResult;

    if (config.responseFormat === "json") {
      analysisResult = parseJSONAnalysisResult(result.content, config.domain);
    } else {
      analysisResult = parseTextAnalysisResult(result.content, config.domain);
    }

    analysisResult.executionTime = executionTime;
    analysisResult.tokenUsage = result.usage
      ? {
        inputTokens: result.usage.promptTokens || 0,
        outputTokens: result.usage.completionTokens || 0,
        totalTokens: result.usage.totalTokens || 0,
      }
      : undefined;

    logger.info("Agent analysis results", {
      agentName: config.name,
      issuesCount: analysisResult.issues.length,
      recommendationsCount: analysisResult.recommendations.length,
    });

    return analysisResult;
  } catch (error) {
    const executionTime = Math.round(performance.now() - startTime);
    logger.error("Agent analysis failed", error, {
      agentName: config.name,
      executionTime,
    });

    const isEstonian = context.language === "et";
    return {
      domain: config.domain,
      issues: [],
      recommendations: [
        isEstonian
          ? `${config.name} analüüs ebaõnnestus - palun kontrollige käsitsi`
          : `${config.name} analysis failed - please review manually`,
      ],
      delegationRequests: [],
      executionTime,
    };
  }
}

// Build a standard analysis prompt
function buildAnalysisPrompt(
  config: SpecializedAgentConfig,
  contentText: string,
  context: ProjectContext,
): string {
  const isEstonian = context.language === "et";

  const basePrompt = isEstonian
    ? `Sa oled ekspert ${config.domain} ülevaataja ehituse kvaliteedikontrolli jaoks.

DOKUMENDI SISU:
${contentText}

KASUTAJA ROLL: ${context.userRole || "spetsialist"}

Analüüsi dokumendid ${config.domain} standardite suhtes ja otsi probleeme.`
    : `You are an expert ${config.domain} reviewer for construction quality control.

DOCUMENT CONTENT:
${contentText}

USER ROLE: ${context.userRole || "specialist"}

Analyze the documents against ${config.domain} standards and identify issues.`;

  if (config.responseFormat === "json") {
    const jsonFormat = isEstonian
      ? `

Tagasta oma analüüs JSON-ina täpselt selle struktuuriga:
{
  "issues": [
    {
      "ruleId": "ID",
      "title": "Probleemi pealkiri",
      "description": "Detailne kirjeldus",
      "severity": "high|medium|low",
      "recommendation": "Konkreetne soovitus"
    }
  ],
  "recommendations": [
    "Üldine soovitus 1",
    "Üldine soovitus 2"
  ],
  "delegationRequests": [
    "Küsimus teistele spetsialistidele"
  ]
}`
      : `

Return your analysis as JSON with this exact structure:
{
  "issues": [
    {
      "ruleId": "ID",
      "title": "Issue title",
      "description": "Detailed description",
      "severity": "high|medium|low",
      "recommendation": "Specific recommendation"
    }
  ],
  "recommendations": [
    "General recommendation 1",
    "General recommendation 2"
  ],
  "delegationRequests": [
    "Question for other specialists"
  ]
}`;

    return basePrompt + jsonFormat;
  }

  return basePrompt;
}

// Parse JSON analysis result
function parseJSONAnalysisResult(
  content: string,
  domain: string,
): AgentAnalysisResult {
  try {
    const cleanResponse = content.trim().replace(/```json\n?|\n?```/g, "");
    const result = JSON.parse(cleanResponse);

    return {
      domain,
      issues: result.issues || [],
      recommendations: result.recommendations || [],
      delegationRequests: result.delegationRequests || [],
    };
  } catch (error) {
    logger.warn("Failed to parse JSON analysis result, using fallback", {
      error: error instanceof Error ? error.message : String(error),
      domain,
    });
    return parseTextAnalysisResult(content, domain);
  }
}

// Parse text analysis result (fallback)
function parseTextAnalysisResult(
  content: string,
  domain: string,
): AgentAnalysisResult {
  const lines = content.split("\n").filter((line) => line.trim());
  const issues: AnalysisIssue[] = [];
  const recommendations: string[] = [];

  let currentSection = "general";

  for (const line of lines) {
    const lowerLine = line.toLowerCase();

    if (
      lowerLine.includes("issue") || lowerLine.includes("problem") ||
      lowerLine.includes("violation")
    ) {
      currentSection = "issues";
      const severity = lowerLine.includes("critical") || lowerLine.includes("high")
        ? "high"
        : lowerLine.includes("medium")
        ? "medium"
        : "low";

      issues.push({
        title: line.replace(/^\W+/, "").slice(0, 100),
        description: line,
        severity,
        recommendation: "Review and address this issue",
      });
    } else if (
      lowerLine.includes("recommend") || lowerLine.includes("suggest")
    ) {
      currentSection = "recommendations";
      recommendations.push(line.replace(/^\W+/, ""));
    } else if (
      currentSection === "recommendations" && line.trim().startsWith("-")
    ) {
      recommendations.push(line.replace(/^-\s*/, ""));
    }
  }

  // Ensure at least some content is captured
  if (issues.length === 0 && recommendations.length === 0) {
    recommendations.push(
      content.slice(0, 500) + (content.length > 500 ? "..." : ""),
    );
  }

  return {
    domain,
    issues,
    recommendations,
    delegationRequests: [],
  };
}

/**
 * Creates a pre-configured architecture analysis agent.
 *
 * Factory function that returns configuration for an architecture review agent
 * specialized in analyzing system design, patterns, and best practices.
 *
 * @param llmConfig LLM configuration (Claude API settings)
 * @param language Language for agent responses ("en" or "et")
 * @param vectorSearchTool Optional vector search tool for knowledge retrieval
 * @returns Specialized agent configuration for architecture analysis
 *
 * @example
 * ```ts
 * const architectConfig = createArchitectureAgentConfig(
 *   { provider: "claude", apiKey: "..." },
 *   "en"
 * );
 * const result = await runSpecializedAnalysis(
 *   architectConfig,
 *   files,
 *   context
 * );
 * ```
 */
export function createArchitectureAgentConfig(
  llmConfig: LLMConfig,
  language: "en" | "et" = "en",
  vectorSearchTool?: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
    handler: (params: Record<string, unknown>) => Promise<unknown> | unknown;
  },
): SpecializedAgentConfig {
  const isEstonian = language === "et";

  return {
    domain: "architecture",
    name: isEstonian ? "Arhitektuuri Agent" : "Architecture Agent",
    description: isEstonian
      ? "Arhitektuuri ülevaatamise ekspert ehituse kvaliteedikontrolli jaoks"
      : "Expert architecture reviewer for construction quality control",
    systemPrompt: isEstonian
      ? `Sa oled ekspert arhitektuuri ülevaataja ehituse kvaliteedikontrolli jaoks.

Sinu ülesanded:
1. Kontrollida ehituseeskirjade vastavust (laekõrgused, akende proportsioonid jne)
2. Hinnata konstruktiivse terviklikkuse nõudeid
3. Tuvastada projekteerimisstandardi rikkumisi
4. Kontrollida ohutuse ja ligipääsetavuse küsimusi

Kui tuvastad probleeme, mis võivad vajada konstruktsiooniinseneride sisendit, märgi need delegationRequests alla.`
      : `You are an expert architecture reviewer for construction quality control.

Your responsibilities:
1. Check building code compliance (ceiling heights, window ratios, etc.)
2. Assess structural integrity requirements
3. Identify design standard violations
4. Verify safety and accessibility issues

If you identify issues that might need structural engineering input, note them in delegationRequests.`,
    llm: llmConfig,
    tools: vectorSearchTool ? [vectorSearchTool] : [],
    responseFormat: "json",
    language,
  };
}

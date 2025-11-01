// Rules vector storage using LanceDB
// Enables semantic search over rules for RAG applications

import type { LanceDBState } from "../vector-store/lancedb.ts";
import { createWorkspaceTable, deleteWorkspaceDocument } from "../vector-store/lancedb.ts";
import type { Rule } from "./types.ts";
import {
  buildRuleFilters,
  createRuleRecord,
  extractMetadataFromResult,
  type RuleVectorMetadata,
} from "../vector-store/schemas.ts";
import { createSubLogger } from "../utils/logger.ts";

const logger = createSubLogger("rules-vector-store");

/**
 * Get the table name for rules in a workspace
 */
function getRulesTableName(workspaceId: string): string {
  return `workspace_${workspaceId}_rules`;
}

/**
 * Initialize rules vector table for a workspace
 */
export async function initializeRulesVectorTable(
  vectorState: LanceDBState,
  workspaceId: string,
): Promise<void> {
  await createWorkspaceTable(vectorState, `${workspaceId}_rules`);
  logger.info("Initialized rules vector table", { tableName: `workspace_${workspaceId}_rules` });
}

/**
 * Add a rule to the vector store
 */
export async function embedRule(
  vectorState: LanceDBState,
  workspaceId: string,
  rule: Rule,
): Promise<void> {
  const tableName = getRulesTableName(workspaceId);

  // Check if table exists
  let tableExists = false;
  try {
    await vectorState.connection.openTable(tableName);
    tableExists = true;
  } catch {
    tableExists = false;
  }

  if (tableExists) {
    // Table exists, add document using centralized metadata schema
    const { embedText } = await import("../embeddings/openai.ts");
    const embedding = await embedText(vectorState.embeddings, rule.content);
    const record = createRuleRecord(rule, embedding, vectorState.isCloud);
    const table = await vectorState.connection.openTable(tableName);
    await table.add([record]);
  } else {
    // Table doesn't exist, create it with proper schema using centralized function
    logger.debug("Creating rules table with proper schema", { tableName });
    const { embedText } = await import("../embeddings/openai.ts");
    const embedding = await embedText(vectorState.embeddings, rule.content);

    // Use centralized createRuleRecord for consistent schema
    const record = createRuleRecord(rule, embedding, vectorState.isCloud);

    await vectorState.connection.createTable(tableName, [record]);
    logger.info("Created rules table with schema", { tableName });
  }

  logger.debug("Embedded rule in vector store", { ruleId: rule.id, tableName });
}

/**
 * Embed multiple rules
 */
export async function embedRules(
  vectorState: LanceDBState,
  workspaceId: string,
  rules: Rule[],
): Promise<void> {
  for (const rule of rules) {
    await embedRule(vectorState, workspaceId, rule);
  }
  logger.info("Embedded rules in vector store", { count: rules.length, workspaceId });
}

/**
 * Delete a rule from the vector store
 */
export async function deleteRuleFromVectorStore(
  vectorState: LanceDBState,
  workspaceId: string,
  ruleId: string,
): Promise<void> {
  await deleteWorkspaceDocument(vectorState, `${workspaceId}_rules`, ruleId);
  logger.debug("Deleted rule from vector store", { ruleId, workspaceId });
}

/**
 * Search rules semantically
 */
export async function searchRulesVector(
  vectorState: LanceDBState,
  workspaceId: string,
  query: string,
  options?: {
    limit?: number;
    threshold?: number;
    filters?: {
      category?: string;
      severity?: string[];
      enabled?: boolean;
    };
  },
): Promise<Array<{ rule: Partial<Rule>; score: number }>> {
  const tableName = getRulesTableName(workspaceId);
  const limit = options?.limit || 10;

  // Use centralized filter building function
  const filter = options?.filters
    ? buildRuleFilters(options.filters, vectorState.isCloud)
    : undefined;

  // Use searchSimilar directly with table name, not searchWorkspace which adds workspace_ prefix
  const { searchSimilar } = await import("../vector-store/lancedb.ts");
  const results = await searchSimilar(
    vectorState,
    query,
    { limit, filter },
    tableName,
  );

  // Extract metadata using centralized function
  return results.map((result) => {
    const metadata = extractMetadataFromResult<RuleVectorMetadata>(result, vectorState.isCloud);
    return {
      rule: {
        id: metadata.ruleId,
        name: metadata.name,
        category: metadata.category,
        severity: metadata.severity,
        enabled: metadata.enabled,
        content: result.content,
        keywords: metadata.keywords,
      },
      score: result.score || 0,
    };
  });
}

/**
 * Get relevant rules for a given context (RAG)
 */
export async function getRelevantRules(
  vectorState: LanceDBState,
  workspaceId: string,
  context: string,
  options?: {
    limit?: number;
    category?: string;
    severityThreshold?: "low" | "medium" | "high" | "critical";
  },
): Promise<Rule[]> {
  const severityOrder = ["low", "medium", "high", "critical"];
  const threshold = options?.severityThreshold || "low";
  const minSeverityIndex = severityOrder.indexOf(threshold);
  const allowedSeverities = severityOrder.slice(minSeverityIndex);

  const results = await searchRulesVector(
    vectorState,
    workspaceId,
    context,
    {
      limit: options?.limit || 5,
      filters: {
        category: options?.category,
        severity: allowedSeverities as ("critical" | "high" | "medium" | "low")[],
        enabled: true,
      },
    },
  );

  return results.map((r) => r.rule as Rule);
}

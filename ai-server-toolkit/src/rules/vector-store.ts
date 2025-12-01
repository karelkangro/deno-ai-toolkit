// Rules vector storage using LanceDB
// Enables semantic search over rules for RAG applications

import { createWorkspaceTable, deleteWorkspaceDocument } from "../vector-store/lancedb.ts";
import { ruleToVectorMetadata, type RuleVectorMetadata } from "../vector-store/schemas.ts";
import type { VectorDocument, VectorStore } from "../types.ts";
import type { Rule } from "./types.ts";
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
  vectorStore: VectorStore,
  workspaceId: string,
): Promise<void> {
  await createWorkspaceTable(vectorStore, `${workspaceId}_rules`);
  logger.info("Initialized rules vector table", { tableName: `workspace_${workspaceId}_rules` });
}

/**
 * Add a rule to the vector store
 */
export async function embedRule(
  vectorStore: VectorStore,
  workspaceId: string,
  rule: Rule,
): Promise<void> {
  const tableName = getRulesTableName(workspaceId);

  // Ensure table exists
  await vectorStore.createTable(tableName);

  const metadata = ruleToVectorMetadata(rule);

  const doc: VectorDocument = {
    id: rule.id,
    content: rule.content,
    metadata: metadata as unknown as Record<string, unknown>,
  };

  await vectorStore.addDocument(doc, tableName);

  logger.debug("Embedded rule in vector store", { ruleId: rule.id, tableName });
}

/**
 * Embed multiple rules
 */
export async function embedRules(
  vectorStore: VectorStore,
  workspaceId: string,
  rules: Rule[],
): Promise<void> {
  for (const rule of rules) {
    await embedRule(vectorStore, workspaceId, rule);
  }
  logger.info("Embedded rules in vector store", { count: rules.length, workspaceId });
}

/**
 * Delete a rule from the vector store
 */
export async function deleteRuleFromVectorStore(
  vectorStore: VectorStore,
  workspaceId: string,
  ruleId: string,
): Promise<void> {
  await deleteWorkspaceDocument(vectorStore, `${workspaceId}_rules`, ruleId);
  logger.debug("Deleted rule from vector store", { ruleId, workspaceId });
}

/**
 * Search rules semantically
 */
export async function searchRulesVector(
  vectorStore: VectorStore,
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

  // Build filter object for VectorStore
  const filter: Record<string, unknown> = {};
  if (options?.filters) {
    if (options.filters.category) {
      filter.category = options.filters.category;
    }
    if (options.filters.enabled !== undefined) {
      filter.enabled = options.filters.enabled;
    }
    if (options.filters.severity && options.filters.severity.length > 0) {
      filter.severity = options.filters.severity;
    }
  }

  const results = await vectorStore.search(
    query,
    { limit, filter },
    tableName,
  );

  // Map results to Rule format
  return results.map((result) => {
    // VectorStore returns normalized metadata (no meta_ prefix)
    const metadata = result.metadata as unknown as RuleVectorMetadata;
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
  vectorStore: VectorStore,
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
    vectorStore,
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

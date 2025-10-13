// Rules vector storage using LanceDB
// Enables semantic search over rules for RAG applications

import type { LanceDBState } from "../vector-store/lancedb.ts";
import {
  addWorkspaceDocument,
  createWorkspaceTable,
  deleteWorkspaceDocument,
  searchWorkspace,
} from "../vector-store/lancedb.ts";
import type { Rule } from "./types.ts";

/**
 * Get the table name for rules in a workspace
 */
function getRulesTableName(workspaceId: string): string {
  return `${workspaceId}_rules`;
}

/**
 * Initialize rules vector table for a workspace
 */
export async function initializeRulesVectorTable(
  vectorState: LanceDBState,
  workspaceId: string,
): Promise<void> {
  const tableName = getRulesTableName(workspaceId);
  await createWorkspaceTable(vectorState, tableName);
  console.log(`✅ Initialized rules vector table: ${tableName}`);
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

  // Create a document from the rule
  const document = {
    id: rule.id,
    content: rule.content,
    metadata: {
      ruleId: rule.id,
      name: rule.name,
      description: rule.description || "",
      category: rule.category,
      severity: rule.severity,
      enabled: rule.enabled,
      schemaId: rule.schemaId,
      keywords: rule.keywords,
      version: rule.version,
      createdAt: rule.createdAt,
      updatedAt: rule.updatedAt,
      // Include custom rule data as well
      ...Object.fromEntries(
        Object.entries(rule.data).map(([key, value]) => [
          `data_${key}`,
          typeof value === "string" || typeof value === "number" ||
            typeof value === "boolean"
            ? value
            : JSON.stringify(value),
        ]),
      ),
    },
  };

  await addWorkspaceDocument(vectorState, tableName, document);
  console.log(`✅ Embedded rule in vector store: ${rule.id}`);
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
  console.log(`✅ Embedded ${rules.length} rules in vector store`);
}

/**
 * Delete a rule from the vector store
 */
export async function deleteRuleFromVectorStore(
  vectorState: LanceDBState,
  workspaceId: string,
  ruleId: string,
): Promise<void> {
  const tableName = getRulesTableName(workspaceId);
  await deleteWorkspaceDocument(vectorState, tableName, ruleId);
  console.log(`🗑️ Deleted rule from vector store: ${ruleId}`);
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

  // Build filter conditions
  const filterConditions: string[] = [];
  if (options?.filters?.category) {
    filterConditions.push(`metadata.category = '${options.filters.category}'`);
  }
  if (options?.filters?.enabled !== undefined) {
    filterConditions.push(`metadata.enabled = ${options.filters.enabled}`);
  }
  if (options?.filters?.severity && options.filters.severity.length > 0) {
    const severityFilter = options.filters.severity
      .map((s) => `'${s}'`)
      .join(", ");
    filterConditions.push(
      `metadata.severity IN (${severityFilter})`,
    );
  }

  const filter = filterConditions.length > 0 ? filterConditions.join(" AND ") : undefined;

  const results = await searchWorkspace(
    vectorState,
    tableName,
    query,
    { limit, filter: filter as Record<string, unknown> | undefined },
  );

  return results.map((result) => ({
    rule: {
      id: result.metadata?.ruleId as string,
      name: result.metadata?.name as string,
      description: result.metadata?.description as string,
      category: result.metadata?.category as string,
      severity: result.metadata?.severity as
        | "critical"
        | "high"
        | "medium"
        | "low",
      enabled: result.metadata?.enabled as boolean,
      content: result.content,
      keywords: result.metadata?.keywords as string[],
    },
    score: result.score || 0,
  }));
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

// Rules storage using Deno KV
// Provides CRUD operations for rule schemas and rules

import type { WorkspaceKVState } from "../workspace/types.ts";
import type {
  CreateRuleRequest,
  CreateRuleSchemaRequest,
  Rule,
  RuleConflict,
  RuleFilters,
  RuleMetadataSchema,
  RuleStats,
  UpdateRuleRequest,
} from "./types.ts";
import { generateId } from "../workspace/kv-store.ts";
import { createSubLogger } from "../utils/logger.ts";

const logger = createSubLogger("rules-kv-store");

/**
 * Generate unique rule ID
 */
export function generateRuleId(): string {
  return `rule_${generateId()}`;
}

/**
 * Generate unique rule schema ID
 */
export function generateRuleSchemaId(): string {
  return `schema_${generateId()}`;
}

/**
 * Generate unique conflict ID
 */
export function generateConflictId(): string {
  return `conflict_${generateId()}`;
}

// ============================================================================
// Rule Schema Operations
// ============================================================================

/**
 * Create a new rule schema
 */
export async function createRuleSchema(
  kvState: WorkspaceKVState,
  request: CreateRuleSchemaRequest,
): Promise<RuleMetadataSchema> {
  const now = new Date().toISOString();
  const schema: RuleMetadataSchema = {
    id: generateRuleSchemaId(),
    workspaceId: request.workspaceId,
    schemaName: request.schemaName,
    schemaVersion: request.schemaVersion,
    description: request.description,
    fields: request.fields,
    createdAt: now,
    updatedAt: now,
    metadata: request.metadata,
  };

  const key = ["workspaces", request.workspaceId, "rule_schemas", schema.id];
  const result = await kvState.kv.atomic()
    .check({ key, versionstamp: null })
    .set(key, schema)
    .commit();

  if (!result.ok) {
    throw new Error(`Failed to create rule schema: ${schema.id}`);
  }

  logger.info("Created rule schema", { schemaId: schema.id, schemaName: schema.schemaName });
  return schema;
}

/**
 * Get rule schema by ID
 */
export async function getRuleSchema(
  kvState: WorkspaceKVState,
  workspaceId: string,
  schemaId: string,
): Promise<RuleMetadataSchema | null> {
  const key = ["workspaces", workspaceId, "rule_schemas", schemaId];
  const result = await kvState.kv.get<RuleMetadataSchema>(key);
  return result.value;
}

/**
 * List all rule schemas in a workspace
 */
export async function listRuleSchemas(
  kvState: WorkspaceKVState,
  workspaceId: string,
): Promise<RuleMetadataSchema[]> {
  const schemas: RuleMetadataSchema[] = [];
  const prefix = ["workspaces", workspaceId, "rule_schemas"];

  for await (const entry of kvState.kv.list<RuleMetadataSchema>({ prefix })) {
    schemas.push(entry.value);
  }

  return schemas.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

/**
 * Delete rule schema
 */
export async function deleteRuleSchema(
  kvState: WorkspaceKVState,
  workspaceId: string,
  schemaId: string,
): Promise<boolean> {
  // Check if any rules use this schema
  const rules = await listRules(kvState, workspaceId, { schemaId });
  if (rules.length > 0) {
    throw new Error(
      `Cannot delete schema ${schemaId}: ${rules.length} rules depend on it`,
    );
  }

  const key = ["workspaces", workspaceId, "rule_schemas", schemaId];
  await kvState.kv.delete(key);
  logger.info("Deleted rule schema", { schemaId });
  return true;
}

// ============================================================================
// Rule Operations
// ============================================================================

/**
 * Create a new rule
 */
export async function createRule(
  kvState: WorkspaceKVState,
  request: CreateRuleRequest,
): Promise<Rule> {
  // Verify schema exists
  const schema = await getRuleSchema(
    kvState,
    request.workspaceId,
    request.schemaId,
  );
  if (!schema) {
    throw new Error(`Rule schema not found: ${request.schemaId}`);
  }

  const now = new Date().toISOString();
  const rule: Rule = {
    id: generateRuleId(),
    workspaceId: request.workspaceId,
    schemaId: request.schemaId,
    name: request.name,
    category: request.category,
    severity: request.severity,
    enabled: request.enabled ?? true,
    data: request.data,
    keywords: request.keywords,
    content: request.content,
    version: 1,
    createdAt: now,
    updatedAt: now,
    createdBy: request.metadata?.createdBy as string | undefined,
    metadata: request.metadata,
  };

  const key = ["workspaces", request.workspaceId, "rules", rule.id];
  const categoryKey = [
    "workspaces",
    request.workspaceId,
    "rules_by_category",
    request.category,
    rule.id,
  ];

  const result = await kvState.kv.atomic()
    .check({ key, versionstamp: null })
    .set(key, rule)
    .set(categoryKey, rule.id) // Index by category
    .commit();

  if (!result.ok) {
    throw new Error(`Failed to create rule: ${rule.id}`);
  }

  logger.info("Created rule", {
    ruleId: rule.id,
    ruleName: rule.name,
    workspaceId: rule.workspaceId,
  });
  return rule;
}

/**
 * Get rule by ID
 */
export async function getRule(
  kvState: WorkspaceKVState,
  workspaceId: string,
  ruleId: string,
): Promise<Rule | null> {
  const key = ["workspaces", workspaceId, "rules", ruleId];
  const result = await kvState.kv.get<Rule>(key);
  return result.value;
}

/**
 * Update rule
 */
export async function updateRule(
  kvState: WorkspaceKVState,
  workspaceId: string,
  ruleId: string,
  updates: UpdateRuleRequest,
): Promise<Rule | null> {
  const existing = await getRule(kvState, workspaceId, ruleId);
  if (!existing) {
    return null;
  }

  const updated: Rule = {
    ...existing,
    ...updates,
    version: existing.version + 1,
    updatedAt: new Date().toISOString(),
  };

  const key = ["workspaces", workspaceId, "rules", ruleId];
  await kvState.kv.set(key, updated);

  // Update category index if category changed
  if (updates.category && updates.category !== existing.category) {
    const oldCategoryKey = [
      "workspaces",
      workspaceId,
      "rules_by_category",
      existing.category,
      ruleId,
    ];
    const newCategoryKey = [
      "workspaces",
      workspaceId,
      "rules_by_category",
      updates.category,
      ruleId,
    ];
    await kvState.kv.delete(oldCategoryKey);
    await kvState.kv.set(newCategoryKey, ruleId);
  }

  logger.info("Updated rule", { ruleId });
  return updated;
}

/**
 * Delete rule
 */
export async function deleteRule(
  kvState: WorkspaceKVState,
  workspaceId: string,
  ruleId: string,
): Promise<boolean> {
  const existing = await getRule(kvState, workspaceId, ruleId);
  if (!existing) {
    return false;
  }

  const key = ["workspaces", workspaceId, "rules", ruleId];
  const categoryKey = [
    "workspaces",
    workspaceId,
    "rules_by_category",
    existing.category,
    ruleId,
  ];

  await kvState.kv.atomic()
    .delete(key)
    .delete(categoryKey)
    .commit();

  logger.info("Deleted rule", { ruleId });
  return true;
}

/**
 * List rules with optional filters
 */
export async function listRules(
  kvState: WorkspaceKVState,
  workspaceId: string,
  filters?: RuleFilters,
): Promise<Rule[]> {
  const rules: Rule[] = [];

  // If filtering by category, use the category index
  if (filters?.category) {
    const prefix = [
      "workspaces",
      workspaceId,
      "rules_by_category",
      filters.category,
    ];
    for await (const entry of kvState.kv.list<string>({ prefix })) {
      const rule = await getRule(kvState, workspaceId, entry.value);
      if (rule) {
        rules.push(rule);
      }
    }
  } else {
    // Otherwise, scan all rules
    const prefix = ["workspaces", workspaceId, "rules"];
    for await (const entry of kvState.kv.list<Rule>({ prefix })) {
      rules.push(entry.value);
    }
  }

  // Apply other filters
  let filtered = rules;

  if (filters?.schemaId) {
    filtered = filtered.filter((r) => r.schemaId === filters.schemaId);
  }

  if (filters?.severity && filters.severity.length > 0) {
    filtered = filtered.filter((r) => filters.severity!.includes(r.severity));
  }

  if (filters?.enabled !== undefined) {
    filtered = filtered.filter((r) => r.enabled === filters.enabled);
  }

  if (filters?.keywords && filters.keywords.length > 0) {
    filtered = filtered.filter((r) => filters.keywords!.some((kw) => r.keywords.includes(kw)));
  }

  return filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

// ============================================================================
// Rule Conflicts
// ============================================================================

/**
 * Store a rule conflict
 */
export async function storeRuleConflict(
  kvState: WorkspaceKVState,
  conflict: Omit<RuleConflict, "id" | "detectedAt">,
): Promise<RuleConflict> {
  const fullConflict: RuleConflict = {
    ...conflict,
    id: generateConflictId(),
    detectedAt: new Date().toISOString(),
  };

  const key = [
    "workspaces",
    conflict.workspaceId,
    "rule_conflicts",
    fullConflict.id,
  ];
  await kvState.kv.set(key, fullConflict);

  logger.warn("Stored rule conflict", { conflictId: fullConflict.id });
  return fullConflict;
}

/**
 * List conflicts for a workspace
 */
export async function listRuleConflicts(
  kvState: WorkspaceKVState,
  workspaceId: string,
): Promise<RuleConflict[]> {
  const conflicts: RuleConflict[] = [];
  const prefix = ["workspaces", workspaceId, "rule_conflicts"];

  for await (const entry of kvState.kv.list<RuleConflict>({ prefix })) {
    conflicts.push(entry.value);
  }

  return conflicts.sort((a, b) =>
    new Date(b.detectedAt).getTime() - new Date(a.detectedAt).getTime()
  );
}

/**
 * Delete a conflict
 */
export async function deleteRuleConflict(
  kvState: WorkspaceKVState,
  workspaceId: string,
  conflictId: string,
): Promise<boolean> {
  const key = ["workspaces", workspaceId, "rule_conflicts", conflictId];
  await kvState.kv.delete(key);
  return true;
}

// ============================================================================
// Statistics
// ============================================================================

/**
 * Get rule statistics for a workspace
 */
export async function getRuleStats(
  kvState: WorkspaceKVState,
  workspaceId: string,
): Promise<RuleStats> {
  const rules = await listRules(kvState, workspaceId);
  const schemas = await listRuleSchemas(kvState, workspaceId);
  const conflicts = await listRuleConflicts(kvState, workspaceId);

  const rulesByCategory: Record<string, number> = {};
  const rulesBySeverity: Record<string, number> = {};

  for (const rule of rules) {
    rulesByCategory[rule.category] = (rulesByCategory[rule.category] || 0) + 1;
    rulesBySeverity[rule.severity] = (rulesBySeverity[rule.severity] || 0) + 1;
  }

  return {
    totalRules: rules.length,
    enabledRules: rules.filter((r) => r.enabled).length,
    disabledRules: rules.filter((r) => !r.enabled).length,
    rulesByCategory,
    rulesBySeverity,
    totalConflicts: conflicts.length,
    totalSchemas: schemas.length,
  };
}

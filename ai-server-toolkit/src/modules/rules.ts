/**
 * Rules management module exports
 *
 * @since 1.11.0
 */

import type { WorkspaceKVState } from "../workspace/types.ts";
import type {
  BusinessRule,
  Rule,
  RuleMetadataSchema,
  RuleScope,
  RuleTarget,
} from "../rules/types.ts";
import {
  addRule,
  getRule as getBusinessRuleFromKV,
  listRules as listBusinessRulesFromKV,
} from "../rules/kv-store.ts";
import { detectSimpleConflicts } from "../rules/validator.ts";

export * from "../rules/types.ts";
export { evaluateCondition, evaluateRule, filterApplicableRules } from "../rules/evaluator.ts";
export { addRule, deleteRule, updateRule } from "../rules/kv-store.ts";
export { getRule as getBusinessRule, listRules as listBusinessRules } from "../rules/kv-store.ts";

// Wrapper functions to convert between BusinessRule and Rule types
export async function getRule(
  kvState: WorkspaceKVState,
  _workspaceId: string,
  ruleId: string,
): Promise<Rule | null> {
  const businessRule = await getBusinessRuleFromKV(kvState, ruleId);
  if (!businessRule) return null;

  return {
    id: businessRule.id,
    name: businessRule.name,
    category: (businessRule.metadata?.category as string) || "",
    severity: (businessRule.metadata?.severity as "critical" | "high" | "medium" | "low") ||
      "medium",
    enabled: businessRule.active,
    content: businessRule.description || "",
    keywords: (businessRule.metadata?.keywords as string[]) || [],
    schemaId: (businessRule.metadata?.schemaId as string) || "",
    version: 1,
    data: (businessRule.metadata?.data as Record<string, unknown>) || {},
    createdAt: businessRule.createdAt,
    updatedAt: businessRule.updatedAt,
  } as Rule;
}

export async function listRules(
  kvState: WorkspaceKVState,
  workspaceId: string,
  filters?: RuleFilters,
): Promise<Rule[]> {
  const businessRules = await listBusinessRulesFromKV(kvState, workspaceId);
  let rules = businessRules.map((br) => ({
    id: br.id,
    name: br.name,
    category: (br.metadata?.category as string) || "",
    severity: (br.metadata?.severity as "critical" | "high" | "medium" | "low") || "medium",
    enabled: br.active,
    content: br.description || "",
    keywords: (br.metadata?.keywords as string[]) || [],
    schemaId: (br.metadata?.schemaId as string) || "",
    version: 1,
    data: (br.metadata?.data as Record<string, unknown>) || {},
    createdAt: br.createdAt,
    updatedAt: br.updatedAt,
    workspaceId: br.workspaceId,
    metadata: br.metadata,
  }));

  // Apply filters if provided
  if (filters) {
    if (filters.category) {
      rules = rules.filter((r) => r.category === filters.category);
    }
    if (filters.severity) {
      rules = rules.filter((r) => r.severity === filters.severity);
    }
    if (filters.enabled !== undefined) {
      rules = rules.filter((r) => r.enabled === filters.enabled);
    }
  }

  return rules;
}

// Wrapper for compatibility - converts CreateRuleRequest to BusinessRule format
export type CreateRuleRequest = Omit<Rule, "id" | "createdAt" | "updatedAt"> & {
  workspaceId: string;
  schemaId: string;
  metadata?: Record<string, unknown>;
};

export async function createRule(
  kvState: WorkspaceKVState,
  request: CreateRuleRequest,
): Promise<Rule> {
  // Convert CreateRuleRequest to BusinessRule format for addRule
  const businessRule: Omit<BusinessRule, "id" | "createdAt" | "updatedAt"> = {
    name: request.name,
    description: request.content,
    workspaceId: request.workspaceId,
    target: "WORKSPACE" as RuleTarget,
    scope: "RESTRICTION" as RuleScope,
    conditions: [],
    priority: 0,
    active: request.enabled ?? true,
    metadata: {
      category: request.category,
      severity: request.severity,
      schemaId: request.schemaId,
      keywords: request.keywords,
      data: request.data,
      ...request.metadata,
    },
  };

  const addedRule = await addRule(kvState, businessRule);

  // Convert BusinessRule back to Rule format
  const rule: Rule = {
    id: addedRule.id,
    name: addedRule.name,
    category: (addedRule.metadata?.category as string) || "",
    severity: (addedRule.metadata?.severity as "critical" | "high" | "medium" | "low") || "medium",
    enabled: addedRule.active,
    content: addedRule.description || "",
    keywords: (addedRule.metadata?.keywords as string[]) || [],
    schemaId: (addedRule.metadata?.schemaId as string) || "",
    version: 1,
    data: (addedRule.metadata?.data as Record<string, unknown>) || {},
    createdAt: addedRule.createdAt,
    updatedAt: addedRule.updatedAt,
  };

  // Add optional fields if they exist
  if (addedRule.workspaceId) {
    (rule as Rule & { workspaceId?: string }).workspaceId = addedRule.workspaceId;
  }
  if (addedRule.metadata) {
    (rule as Rule & { metadata?: Record<string, unknown> }).metadata = addedRule.metadata;
  }

  return rule;
}

// Export rule validation and vector store functions
export { detectSimpleConflicts, validateRuleAgainstSchema } from "../rules/validator.ts";
export {
  deleteRuleFromVectorStore,
  embedRule,
  embedRules,
  getRelevantRules,
  initializeRulesVectorTable,
  searchRulesVector,
} from "../rules/vector-store.ts";

// Schema management types
export type CreateRuleSchemaRequest = {
  workspaceId: string;
  schemaName: string;
  schemaVersion?: string;
  description?: string;
  fields: Array<{
    name: string;
    type: "string" | "number" | "boolean" | "array" | "object" | "enum";
    required: boolean;
    description?: string;
    defaultValue?: unknown;
    enumValues?: string[];
    validation?: Record<string, unknown> | {
      min?: number;
      max?: number;
      pattern?: string;
    };
  }>;
};

export type UpdateRuleRequest = Partial<Omit<Rule, "id" | "createdAt">> & {
  id: string;
  workspaceId: string;
};

export type RuleFilters = {
  workspaceId?: string;
  category?: string;
  severity?: string;
  enabled?: boolean;
};

export type RuleStats = {
  total: number;
  byCategory: Record<string, number>;
  bySeverity: Record<string, number>;
};

// Stub implementations - TODO: Implement properly
export async function createRuleSchema(
  kvState: WorkspaceKVState,
  request: CreateRuleSchemaRequest,
): Promise<RuleMetadataSchema> {
  // Temporary implementation - creates schema in KV
  const schemaId = crypto.randomUUID();
  const now = new Date().toISOString();
  const schema: RuleMetadataSchema = {
    id: schemaId,
    name: request.schemaName,
    description: request.description,
    workspaceId: request.workspaceId || null,
    fields: request.fields.map((f) => ({
      name: f.name,
      type: f.type === "object" ? "string" : f.type, // RuleField doesn't support "object"
      required: f.required,
      description: f.description,
      enumValues: f.enumValues,
      validation:
        typeof f.validation === "object" && f.validation !== null && !Array.isArray(f.validation)
          ? (f.validation as { min?: number; max?: number; pattern?: string })
          : undefined,
    })),
    createdAt: now,
    updatedAt: now,
  };

  if (request.workspaceId) {
    await kvState.kv.set(
      ["rule-schemas", request.workspaceId, schemaId],
      schema,
    );
  }

  return schema;
}

export async function getRuleSchema(
  kvState: WorkspaceKVState,
  workspaceId: string,
  schemaId: string,
): Promise<RuleMetadataSchema | null> {
  const result = await kvState.kv.get<RuleMetadataSchema>([
    "rule-schemas",
    workspaceId,
    schemaId,
  ]);
  if (result.value) {
    // Ensure workspaceId is set if it's missing (for backward compatibility)
    if (!result.value.workspaceId) {
      result.value.workspaceId = workspaceId;
    }
  }
  return result.value;
}

export async function listRuleSchemas(
  kvState: WorkspaceKVState,
  workspaceId: string,
): Promise<RuleMetadataSchema[]> {
  const schemas: RuleMetadataSchema[] = [];
  const entries = kvState.kv.list<RuleMetadataSchema>({
    prefix: ["rule-schemas", workspaceId],
  });

  for await (const entry of entries) {
    // Ensure workspaceId is set (for backward compatibility)
    const schema = entry.value;
    if (!schema.workspaceId) {
      schema.workspaceId = workspaceId;
    }
    schemas.push(schema);
  }

  return schemas;
}

export async function deleteRuleSchema(
  _kvState: WorkspaceKVState,
  _workspaceId: string,
  _schemaId: string,
): Promise<boolean> {
  throw new Error("deleteRuleSchema not yet implemented in toolkit");
}

export async function getRuleStats(
  _kvState: WorkspaceKVState,
  _workspaceId: string,
): Promise<RuleStats> {
  throw new Error("getRuleStats not yet implemented in toolkit");
}

export async function listRuleConflicts(
  kvState: WorkspaceKVState,
  workspaceId: string,
): Promise<Array<{ rule1: Rule; rule2: Rule; reason: string }>> {
  const rules = await listRules(kvState, workspaceId);
  // Use detectSimpleConflicts as a fallback
  const conflicts = detectSimpleConflicts(rules);
  return conflicts.map((c) => ({
    rule1: c.rule1 as Rule,
    rule2: c.rule2 as Rule,
    reason: c.reason,
  }));
}


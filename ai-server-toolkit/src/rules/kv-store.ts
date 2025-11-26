import type { WorkspaceKVState } from "../workspace/types.ts";
import type { BusinessRule } from "./types.ts";

const RULE_KEY_PREFIX = ["rules"];
const RULE_BY_WORKSPACE_PREFIX = ["rules", "workspace"];

const getRuleKey = (ruleId: string): Deno.KvKey => [...RULE_KEY_PREFIX, ruleId];
const getWorkspaceRulesKey = (
  workspaceId: string,
): Deno.KvKey => [...RULE_BY_WORKSPACE_PREFIX, workspaceId];

export const listRules = async (
  kvState: WorkspaceKVState,
  workspaceId?: string | undefined,
): Promise<BusinessRule[]> => {
  const rules: BusinessRule[] = [];

  if (workspaceId) {
    const workspaceKey = getWorkspaceRulesKey(workspaceId);
    const entries = kvState.kv.list<BusinessRule>({ prefix: workspaceKey });
    for await (const entry of entries) {
      if (entry.value.active) {
        rules.push(entry.value);
      }
    }
  } else {
    const entries = kvState.kv.list<BusinessRule>({ prefix: RULE_KEY_PREFIX });
    for await (const entry of entries) {
      if (entry.value.active) {
        rules.push(entry.value);
      }
    }
  }

  return rules.sort((a, b) => b.priority - a.priority);
};

export const getRule = async (
  kvState: WorkspaceKVState,
  ruleId: string,
): Promise<BusinessRule | null> => {
  const result = await kvState.kv.get<BusinessRule>(getRuleKey(ruleId));
  return result.value;
};

export const addRule = async (
  kvState: WorkspaceKVState,
  rule: Omit<BusinessRule, "id" | "createdAt" | "updatedAt">,
): Promise<BusinessRule> => {
  const now = new Date().toISOString();
  const ruleId = crypto.randomUUID();
  const newRule: BusinessRule = {
    ...rule,
    id: ruleId,
    createdAt: now,
    updatedAt: now,
  };

  await kvState.kv.set(getRuleKey(ruleId), newRule);

  if (rule.workspaceId) {
    await kvState.kv.set([...getWorkspaceRulesKey(rule.workspaceId), ruleId], newRule);
  }

  return newRule;
};

export const updateRule = async (
  kvState: WorkspaceKVState,
  ruleId: string,
  updates: Partial<Omit<BusinessRule, "id" | "createdAt">>,
): Promise<BusinessRule | null> => {
  const existing = await getRule(kvState, ruleId);
  if (!existing) {
    return null;
  }

  const updated: BusinessRule = {
    ...existing,
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  await kvState.kv.set(getRuleKey(ruleId), updated);

  if (updated.workspaceId) {
    await kvState.kv.set([...getWorkspaceRulesKey(updated.workspaceId), ruleId], updated);
  }

  return updated;
};

export const deleteRule = async (
  kvState: WorkspaceKVState,
  ruleId: string,
): Promise<boolean> => {
  const existing = await getRule(kvState, ruleId);
  if (!existing) {
    return false;
  }

  await kvState.kv.delete(getRuleKey(ruleId));

  if (existing.workspaceId) {
    await kvState.kv.delete([...getWorkspaceRulesKey(existing.workspaceId), ruleId]);
  }

  return true;
};

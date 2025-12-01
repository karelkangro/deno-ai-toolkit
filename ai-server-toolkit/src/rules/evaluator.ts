import type { BusinessRule, RuleCondition, RuleEvaluationContext } from "./types.ts";

export const evaluateCondition = (condition: RuleCondition, userValue: unknown): boolean => {
  switch (condition.operator) {
    case "equals":
      return userValue === condition.value;
    case "not_equals":
      return userValue !== condition.value;
    case "greater_than":
      return typeof userValue === "number" && typeof condition.value === "number" &&
        userValue > condition.value;
    case "less_than":
      return typeof userValue === "number" && typeof condition.value === "number" &&
        userValue < condition.value;
    case "greater_than_or_equal":
      return typeof userValue === "number" && typeof condition.value === "number" &&
        userValue >= condition.value;
    case "less_than_or_equal":
      return typeof userValue === "number" && typeof condition.value === "number" &&
        userValue <= condition.value;
    case "in":
      return Array.isArray(condition.value) && condition.value.includes(userValue);
    case "not_in":
      return Array.isArray(condition.value) && !condition.value.includes(userValue);
    case "contains":
      return Array.isArray(userValue) && userValue.includes(condition.value);
    case "not_contains":
      return Array.isArray(userValue) && !userValue.includes(condition.value);
    case "starts_with":
      return typeof userValue === "string" && typeof condition.value === "string" &&
        userValue.startsWith(condition.value);
    case "ends_with":
      return typeof userValue === "string" && typeof condition.value === "string" &&
        userValue.endsWith(condition.value);
    case "matches":
      if (typeof userValue === "string" && typeof condition.value === "string") {
        try {
          const regex = new RegExp(condition.value);
          return regex.test(userValue);
        } catch {
          return false;
        }
      }
      return false;
    default:
      return false;
  }
};

export const evaluateRule = (rule: BusinessRule, context: RuleEvaluationContext): boolean => {
  if (!rule.active) {
    return false;
  }

  return rule.conditions.every((condition) => {
    const userValue = context[condition.type];
    return evaluateCondition(condition, userValue);
  });
};

export const filterApplicableRules = (
  rules: BusinessRule[],
  context: RuleEvaluationContext,
): BusinessRule[] => {
  return rules
    .filter((rule) => {
      if (rule.target === "PRODUCT" && rule.targetId && rule.targetId !== context.productId) {
        return false;
      }
      if (rule.target === "CATEGORY" && rule.targetId && rule.targetId !== context.category) {
        return false;
      }
      if (
        rule.target === "WORKSPACE" && rule.workspaceId && rule.workspaceId !== context.workspaceId
      ) {
        return false;
      }
      return evaluateRule(rule, context);
    })
    .sort((a, b) => b.priority - a.priority);
};

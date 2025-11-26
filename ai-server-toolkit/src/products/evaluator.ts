/**
 * Product Evaluation Functions
 *
 * Generic, domain-agnostic product evaluation functions.
 * Domain-specific evaluation logic should be implemented in the application layer.
 */

import type { Product, ProductEvaluationContext, ProductEvaluationResult } from "./types.ts";
import type { BusinessRule, RuleEvaluationContext, RuleScope } from "../rules/types.ts";
import { evaluateRule, filterApplicableRules } from "../rules/evaluator.ts";

const RULE_SCOPE_RESTRICTION: RuleScope = "RESTRICTION";
const RULE_SCOPE_ELIGIBILITY: RuleScope = "ELIGIBILITY";
const RULE_SCOPE_BONUS: RuleScope = "BONUS";

const RESTRICTION_KEY_PRODUCT_IDS = "productIds" as const;

/**
 * Evaluate product against business rules
 * Generic function that works with any rule conditions
 */
export const evaluateProductRules = (
  product: Product,
  context: ProductEvaluationContext,
  rules: BusinessRule[],
): ProductEvaluationResult => {
  const reasons: string[] = [];
  const warnings: string[] = [];

  // Build rule evaluation context
  const ruleContext: RuleEvaluationContext = {
    productId: product.id,
    category: context.category,
    workspaceId: context.workspaceId || product.workspaceId,
    ...context, // Include all context fields
  };

  // Filter applicable rules
  const applicableRules = filterApplicableRules(rules, ruleContext);

  // Evaluate each rule
  for (const rule of applicableRules) {
    const ruleResult = evaluateRule(rule, ruleContext);

    if (!ruleResult) {
      // Rule condition not met
      if (rule.scope === RULE_SCOPE_RESTRICTION) {
        reasons.push(`Restriction: ${rule.name}`);
      } else if (rule.scope === RULE_SCOPE_ELIGIBILITY) {
        reasons.push(`Not eligible: ${rule.name}`);
      }
    } else {
      // Rule condition met
      if (rule.scope === RULE_SCOPE_BONUS) {
        warnings.push(`Bonus applies: ${rule.name}`);
      }
    }
  }

  // Product is eligible if no restriction/eligibility rules failed
  const hasRestrictions = applicableRules.some(
    (r) =>
      (r.scope === RULE_SCOPE_RESTRICTION || r.scope === RULE_SCOPE_ELIGIBILITY) &&
      !evaluateRule(r, ruleContext),
  );

  return {
    eligible: !hasRestrictions,
    reasons,
    warnings,
  };
};

/**
 * Evaluate product metadata against context
 * Generic key-value matching - works with any metadata structure
 */
export const evaluateProductMetadata = (
  product: Product,
  context: ProductEvaluationContext,
): ProductEvaluationResult => {
  const reasons: string[] = [];
  const warnings: string[] = [];

  // Check metadata fields against context
  for (const [key, value] of Object.entries(product.metadata)) {
    const contextValue = context[key];

    if (contextValue !== undefined) {
      // Simple equality check - application layer can implement more complex logic
      if (Array.isArray(value)) {
        if (!value.includes(contextValue)) {
          reasons.push(`Metadata mismatch: ${key}`);
        }
      } else if (value !== contextValue) {
        reasons.push(`Metadata mismatch: ${key}`);
      }
    }
  }

  return {
    eligible: reasons.length === 0,
    reasons,
    warnings,
  };
};

/**
 * Check product restrictions generically
 * Works with any restriction type stored in metadata or as separate restrictions
 */
export const checkProductRestrictions = (
  product: Product,
  restrictions: Record<string, unknown>,
): ProductEvaluationResult => {
  const reasons: string[] = [];
  const warnings: string[] = [];

  // Check product conflicts
  if (product.conflicts && product.conflicts.length > 0) {
    const conflictIds = restrictions[RESTRICTION_KEY_PRODUCT_IDS] as string[] | undefined;
    if (conflictIds) {
      const hasConflict = product.conflicts.some((id) => conflictIds.includes(id));
      if (hasConflict) {
        reasons.push("Product conflicts with selected products");
      }
    }
  }

  // Check product dependencies
  if (product.dependencies && product.dependencies.length > 0) {
    const selectedIds = restrictions[RESTRICTION_KEY_PRODUCT_IDS] as string[] | undefined;
    if (selectedIds) {
      const missingDependencies = product.dependencies.filter((id) => !selectedIds.includes(id));
      if (missingDependencies.length > 0) {
        warnings.push(`Recommended dependencies: ${missingDependencies.join(", ")}`);
      }
    }
  }

  // Generic restriction checking - iterate through restrictions object
  for (const [key, value] of Object.entries(restrictions)) {
    if (key === RESTRICTION_KEY_PRODUCT_IDS) continue; // Already handled above

    const productValue = product.metadata[key];
    if (productValue !== undefined) {
      // Simple comparison - application layer can implement domain-specific logic
      if (typeof productValue === "object" && productValue !== null) {
        // For objects, check if restriction value matches any property
        const restrictionMet = Object.values(productValue).includes(value);
        if (!restrictionMet) {
          reasons.push(`Restriction not met: ${key}`);
        }
      } else if (productValue !== value) {
        reasons.push(`Restriction not met: ${key}`);
      }
    }
  }

  return {
    eligible: reasons.length === 0,
    reasons,
    warnings,
  };
};

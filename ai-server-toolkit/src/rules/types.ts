// ============================================
// EXISTING RULE TYPE - For QA/Validation Rules (Semantic Search)
// ============================================
// This type is used for rules that are embedded in vector stores
// and searched semantically (e.g., quality assurance rules, validation rules)
// Used by: validator.ts, vector-store.ts, schemas.ts

export interface Rule {
  id: string;
  name: string;
  category: string;
  severity: "critical" | "high" | "medium" | "low";
  enabled: boolean;
  content: string;
  keywords: string[];
  schemaId: string;
  version: number;
  data: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface RuleField {
  name: string;
  type: "string" | "number" | "boolean" | "array" | "enum";
  required: boolean;
  description?: string;
  enumValues?: string[];
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
  };
}

export interface RuleMetadataSchema {
  id: string;
  name: string;
  description?: string;
  workspaceId: string | null;
  fields: RuleField[];
  createdAt: string;
  updatedAt: string;
}

export interface RuleValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

// ============================================
// NEW BUSINESS RULE TYPE - For Evaluable Rules (Conditional Logic)
// ============================================
// This type is used for rules that are evaluated against user/product context
// and applied conditionally (e.g., ecommerce restrictions, eligibility rules)
// Used by: evaluator.ts, kv-store.ts

export type RuleScope = "RESTRICTION" | "ELIGIBILITY" | "TRIGGER" | "BONUS";
export type RuleTarget = "PRODUCT" | "CATEGORY" | "USER_PROFILE" | "CONCERN" | "WORKSPACE";

export type ComparisonOperator =
  | "equals"
  | "not_equals"
  | "greater_than"
  | "less_than"
  | "greater_than_or_equal"
  | "less_than_or_equal"
  | "in"
  | "not_in"
  | "contains"
  | "not_contains"
  | "starts_with"
  | "ends_with"
  | "matches";

export interface RuleCondition {
  type: string;
  operator: ComparisonOperator;
  value: unknown;
}

export interface BusinessRule {
  id: string;
  name: string;
  description?: string;
  workspaceId?: string;
  target: RuleTarget;
  targetId?: string;
  scope: RuleScope;
  conditions: RuleCondition[];
  priority: number;
  active: boolean;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface RuleEvaluationContext {
  productId?: string;
  category?: string;
  workspaceId?: string;
  userAge?: number;
  userGender?: string;
  userConcern?: string;
  userConditions?: string[];
  [key: string]: unknown;
}

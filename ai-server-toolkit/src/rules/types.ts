// Rules management types for AI agent systems
// Supports dynamic rule schemas for different domains (construction, e-commerce, etc.)

/**
 * Rule field definition for dynamic schemas
 */
export interface RuleField {
  name: string;
  type: "string" | "number" | "boolean" | "array" | "object" | "enum";
  required: boolean;
  defaultValue?: unknown;
  description?: string;
  enumValues?: string[]; // For enum type
  validation?: {
    min?: number; // For number/string length
    max?: number;
    pattern?: string; // Regex for string validation
    custom?: string; // Custom validation function name
  };
}

/**
 * Rule metadata schema - defines structure for a type of rule
 */
export interface RuleMetadataSchema {
  id: string;
  workspaceId: string;
  schemaName: string; // e.g., "structural_engineering_compliance"
  schemaVersion: string;
  description?: string;
  fields: RuleField[];
  createdAt: string;
  updatedAt: string;
  metadata?: Record<string, unknown>;
}

/**
 * Individual rule instance
 */
export interface Rule {
  id: string;
  workspaceId: string;
  schemaId: string; // Links to RuleMetadataSchema
  name: string;
  description?: string;
  category: string;
  severity: "critical" | "high" | "medium" | "low";
  enabled: boolean;
  data: Record<string, unknown>; // Dynamic data based on schema
  keywords: string[]; // For vector search
  content: string; // Natural language description for RAG
  version: number;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Rule conflict detection
 */
export interface RuleConflict {
  id: string;
  workspaceId: string;
  ruleId1: string;
  ruleId2: string;
  conflictType: "contradiction" | "overlap" | "dependency";
  severity: "error" | "warning";
  description: string;
  autoResolvable: boolean;
  detectedAt: string;
}

/**
 * Rule validation result
 */
export interface RuleValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Rule filters for queries
 */
export interface RuleFilters {
  schemaId?: string;
  category?: string;
  severity?: string[];
  enabled?: boolean;
  keywords?: string[];
}

/**
 * Rule evaluation result
 */
export interface RuleEvaluationResult {
  matchedRules: Rule[];
  conflicts: RuleConflict[];
  recommendations: string[];
}

/**
 * Request to create a rule schema
 */
export interface CreateRuleSchemaRequest {
  workspaceId: string;
  schemaName: string;
  schemaVersion: string;
  description?: string;
  fields: RuleField[];
  metadata?: Record<string, unknown>;
}

/**
 * Request to create a rule
 */
export interface CreateRuleRequest {
  workspaceId: string;
  schemaId: string;
  name: string;
  description?: string;
  category: string;
  severity: "critical" | "high" | "medium" | "low";
  enabled?: boolean;
  data: Record<string, unknown>;
  keywords: string[];
  content: string;
  metadata?: Record<string, unknown>;
}

/**
 * Request to update a rule
 */
export interface UpdateRuleRequest {
  name?: string;
  description?: string;
  category?: string;
  severity?: "critical" | "high" | "medium" | "low";
  enabled?: boolean;
  data?: Record<string, unknown>;
  keywords?: string[];
  content?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Statistics for rules in a workspace
 */
export interface RuleStats {
  totalRules: number;
  enabledRules: number;
  disabledRules: number;
  rulesByCategory: Record<string, number>;
  rulesBySeverity: Record<string, number>;
  totalConflicts: number;
  totalSchemas: number;
}

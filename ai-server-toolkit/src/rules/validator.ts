// Rule validation logic
// Validates rules against their schemas and detects conflicts

import type { Rule, RuleField, RuleMetadataSchema, RuleValidationResult } from "./types.ts";

/**
 * Validate a rule against its schema
 */
export function validateRuleAgainstSchema(
  rule: Rule,
  schema: RuleMetadataSchema,
): RuleValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check all required fields are present
  for (const field of schema.fields) {
    if (field.required && !(field.name in rule.data)) {
      errors.push(`Missing required field: ${field.name}`);
    }
  }

  // Validate each field in the rule data
  for (const [fieldName, fieldValue] of Object.entries(rule.data)) {
    const fieldDef = schema.fields.find((f) => f.name === fieldName);

    if (!fieldDef) {
      warnings.push(`Unknown field: ${fieldName} (not defined in schema)`);
      continue;
    }

    const fieldErrors = validateField(fieldValue, fieldDef);
    errors.push(...fieldErrors);
  }

  // Validate basic rule properties
  if (!rule.name || rule.name.trim().length === 0) {
    errors.push("Rule name cannot be empty");
  }

  if (!rule.category || rule.category.trim().length === 0) {
    errors.push("Rule category cannot be empty");
  }

  if (!rule.content || rule.content.trim().length === 0) {
    errors.push("Rule content cannot be empty");
  }

  if (!rule.keywords || rule.keywords.length === 0) {
    warnings.push("Rule has no keywords (may affect search performance)");
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validate a single field value against its definition
 */
function validateField(value: unknown, field: RuleField): string[] {
  const errors: string[] = [];

  // Type validation
  const actualType = getActualType(value);
  const expectedType = field.type === "enum" ? "string" : field.type;

  if (actualType !== expectedType) {
    errors.push(
      `Field '${field.name}' has incorrect type: expected ${field.type}, got ${actualType}`,
    );
    return errors; // Don't continue validation if type is wrong
  }

  // Type-specific validation
  if (field.type === "string") {
    errors.push(...validateStringField(value as string, field));
  } else if (field.type === "number") {
    errors.push(...validateNumberField(value as number, field));
  } else if (field.type === "enum") {
    errors.push(...validateEnumField(value as string, field));
  } else if (field.type === "array") {
    errors.push(...validateArrayField(value as unknown[], field));
  }

  return errors;
}

/**
 * Get the actual type of a value (matches RuleField types)
 */
function getActualType(
  value: unknown,
): "string" | "number" | "boolean" | "array" | "object" {
  if (Array.isArray(value)) return "array";
  if (value === null) return "object";
  if (typeof value === "object") return "object";
  return typeof value as "string" | "number" | "boolean";
}

/**
 * Validate string field
 */
function validateStringField(value: string, field: RuleField): string[] {
  const errors: string[] = [];

  if (field.validation?.min && value.length < field.validation.min) {
    errors.push(
      `Field '${field.name}' must be at least ${field.validation.min} characters`,
    );
  }

  if (field.validation?.max && value.length > field.validation.max) {
    errors.push(
      `Field '${field.name}' must be at most ${field.validation.max} characters`,
    );
  }

  if (field.validation?.pattern) {
    const regex = new RegExp(field.validation.pattern);
    if (!regex.test(value)) {
      errors.push(`Field '${field.name}' does not match required pattern`);
    }
  }

  return errors;
}

/**
 * Validate number field
 */
function validateNumberField(value: number, field: RuleField): string[] {
  const errors: string[] = [];

  if (field.validation?.min !== undefined && value < field.validation.min) {
    errors.push(
      `Field '${field.name}' must be at least ${field.validation.min}`,
    );
  }

  if (field.validation?.max !== undefined && value > field.validation.max) {
    errors.push(
      `Field '${field.name}' must be at most ${field.validation.max}`,
    );
  }

  return errors;
}

/**
 * Validate enum field
 */
function validateEnumField(value: string, field: RuleField): string[] {
  const errors: string[] = [];

  if (!field.enumValues || field.enumValues.length === 0) {
    errors.push(`Field '${field.name}' is enum but has no valid values`);
    return errors;
  }

  if (!field.enumValues.includes(value)) {
    errors.push(
      `Field '${field.name}' must be one of: ${field.enumValues.join(", ")}`,
    );
  }

  return errors;
}

/**
 * Validate array field
 */
function validateArrayField(value: unknown[], field: RuleField): string[] {
  const errors: string[] = [];

  if (field.validation?.min && value.length < field.validation.min) {
    errors.push(
      `Field '${field.name}' must have at least ${field.validation.min} items`,
    );
  }

  if (field.validation?.max && value.length > field.validation.max) {
    errors.push(
      `Field '${field.name}' must have at most ${field.validation.max} items`,
    );
  }

  return errors;
}

/**
 * Simple conflict detection (can be extended with more sophisticated logic)
 */
export function detectSimpleConflicts(rules: Rule[]): {
  rule1: Rule;
  rule2: Rule;
  reason: string;
}[] {
  const conflicts: { rule1: Rule; rule2: Rule; reason: string }[] = [];

  // Check for rules with identical names in same category
  for (let i = 0; i < rules.length; i++) {
    for (let j = i + 1; j < rules.length; j++) {
      const r1 = rules[i];
      const r2 = rules[j];

      // Same name in same category
      if (r1.category === r2.category && r1.name === r2.name) {
        conflicts.push({
          rule1: r1,
          rule2: r2,
          reason: "Duplicate rule names in same category",
        });
      }

      // Check for overlapping keywords (potential overlap)
      const sharedKeywords = r1.keywords.filter((k) => r2.keywords.includes(k));
      if (
        sharedKeywords.length >= 3 && r1.category === r2.category &&
        r1.severity !== r2.severity
      ) {
        conflicts.push({
          rule1: r1,
          rule2: r2,
          reason:
            `High keyword overlap (${sharedKeywords.length} keywords) but different severity levels`,
        });
      }
    }
  }

  return conflicts;
}

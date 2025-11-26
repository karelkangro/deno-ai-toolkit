/**
 * Product Management Types
 *
 * Generic, domain-agnostic product management types for use across different applications.
 * Domain-specific fields (like age, gender, health conditions) are stored in metadata.
 */

/**
 * Core product interface - generic and extensible
 */
export interface Product {
  id: string;
  code: string; // SKU/product code
  name: string;
  description?: string;
  url?: string;
  status: "active" | "inactive" | "draft";

  // Relationships
  categories: string[]; // Category IDs
  conflicts?: string[]; // Product IDs that conflict with this product
  dependencies?: string[]; // Product IDs that work well together

  // Extensible metadata - domain-specific fields go here
  metadata: Record<string, unknown>;

  // Workspace support
  workspaceId?: string;

  // Timestamps
  createdAt: string;
  updatedAt: string;
}

/**
 * Product category interface
 */
export interface ProductCategory {
  id: string;
  name: string;
  description?: string;
  parentId?: string; // For hierarchical categories
  metadata?: Record<string, unknown>; // Category-specific metadata
  workspaceId?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Product restriction interface - generic restriction structure
 * Domain-specific restrictions are stored as key-value pairs
 */
export interface ProductRestriction {
  id: string;
  productId: string;
  type: string; // Restriction type (e.g., 'age', 'gender', 'health', etc.)
  operator:
    | "equals"
    | "not_equals"
    | "greater_than"
    | "less_than"
    | "in"
    | "not_in"
    | "contains"
    | "not_contains";
  value: unknown; // Restriction value (flexible type)
  metadata?: Record<string, unknown>;
  workspaceId?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Product configuration - for managing configurable entities (age groups, conditions, etc.)
 */
export interface ProductConfiguration {
  id: string;
  type: string; // Configuration type (e.g., 'age-group', 'health-condition', 'gender')
  name: string;
  value: unknown; // Flexible value based on type
  metadata?: Record<string, unknown>;
  workspaceId?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Product metadata structure - core fields + extensible custom fields
 */
export interface ProductMetadata {
  // Core metadata fields (optional, can be in metadata map instead)
  activeIngredients?: string[];
  seasonalAvailability?: {
    startMonth: number;
    endMonth: number;
  };
  specialRestrictions?: Record<string, boolean | number>;
  timingRequirements?: string;

  // Extensible custom metadata
  [key: string]: unknown;
}

/**
 * Product evaluation context - generic context for evaluation
 */
export interface ProductEvaluationContext {
  productId?: string;
  category?: string;
  workspaceId?: string;
  [key: string]: unknown; // Flexible context fields
}

/**
 * Product evaluation result
 */
export interface ProductEvaluationResult {
  eligible: boolean;
  reasons: string[];
  warnings: string[];
  metadata?: Record<string, unknown>;
}

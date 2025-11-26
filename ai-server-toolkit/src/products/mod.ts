/**
 * Product Management Module
 *
 * Exports all product-related functions for use in applications.
 */

// Types
export type {
  Product,
  ProductCategory,
  ProductConfiguration,
  ProductEvaluationContext,
  ProductEvaluationResult,
  ProductMetadata,
  ProductRestriction,
} from "./types.ts";

// KV Store Operations
export {
  addCategory,
  addConfiguration,
  addProduct,
  addRestriction,
  deleteCategory,
  deleteConfiguration,
  deleteProduct,
  deleteRestriction,
  getCategory,
  getConfiguration,
  getProduct,
  getRestriction,
  listCategories,
  listConfigurations,
  listProducts,
  listRestrictions,
  updateCategory,
  updateConfiguration,
  updateProduct,
} from "./kv-store.ts";

// Evaluation Functions
export {
  checkProductRestrictions,
  evaluateProductMetadata,
  evaluateProductRules,
} from "./evaluator.ts";

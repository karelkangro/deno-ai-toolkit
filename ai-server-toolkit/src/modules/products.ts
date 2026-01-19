/**
 * Product management module exports
 *
 * @since 1.11.0
 */

export {
  type Product,
  type ProductCategory,
  type ProductConfiguration,
  type ProductEvaluationContext,
  type ProductEvaluationResult,
  type ProductMetadata,
  type ProductRestriction,
} from "../products/mod.ts";
export {
  addCategory,
  addConfiguration,
  addProduct,
  addRestriction,
  checkProductRestrictions,
  deleteCategory,
  deleteConfiguration,
  deleteProduct,
  deleteRestriction,
  evaluateProductMetadata,
  evaluateProductRules,
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
} from "../products/mod.ts";


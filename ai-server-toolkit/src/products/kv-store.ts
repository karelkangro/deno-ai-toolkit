/**
 * Product KV Store Operations
 *
 * Generic CRUD operations for products, categories, and configurations in Deno KV.
 * Uses workspace pattern consistent with existing toolkit modules.
 */

import type { WorkspaceKVState } from "../workspace/types.ts";
import type {
  Product,
  ProductCategory,
  ProductConfiguration,
  ProductRestriction,
} from "./types.ts";

// Key prefixes for KV storage
const PRODUCT_KEY_PREFIX = ["products"];
const PRODUCT_BY_WORKSPACE_PREFIX = ["products", "workspace"];
const CATEGORY_KEY_PREFIX = ["product-categories"];
const CATEGORY_BY_WORKSPACE_PREFIX = ["product-categories", "workspace"];
const CONFIGURATION_KEY_PREFIX = ["product-configurations"];
const CONFIGURATION_BY_WORKSPACE_PREFIX = ["product-configurations", "workspace"];
const RESTRICTION_KEY_PREFIX = ["product-restrictions"];
const RESTRICTION_BY_PRODUCT_PREFIX = ["product-restrictions", "product"];

// Helper functions for key generation
const getProductKey = (productId: string): Deno.KvKey => [...PRODUCT_KEY_PREFIX, productId];
const getWorkspaceProductsKey = (
  workspaceId: string,
): Deno.KvKey => [...PRODUCT_BY_WORKSPACE_PREFIX, workspaceId];
const getCategoryKey = (categoryId: string): Deno.KvKey => [...CATEGORY_KEY_PREFIX, categoryId];
const getWorkspaceCategoriesKey = (
  workspaceId: string,
): Deno.KvKey => [...CATEGORY_BY_WORKSPACE_PREFIX, workspaceId];
const getConfigurationKey = (
  configId: string,
): Deno.KvKey => [...CONFIGURATION_KEY_PREFIX, configId];
const getWorkspaceConfigurationsKey = (
  workspaceId: string,
): Deno.KvKey => [...CONFIGURATION_BY_WORKSPACE_PREFIX, workspaceId];
const getRestrictionKey = (
  restrictionId: string,
): Deno.KvKey => [...RESTRICTION_KEY_PREFIX, restrictionId];
const getProductRestrictionsKey = (
  productId: string,
): Deno.KvKey => [...RESTRICTION_BY_PRODUCT_PREFIX, productId];

// ==================== PRODUCT OPERATIONS ====================

export const listProducts = async (
  kvState: WorkspaceKVState,
  workspaceId?: string,
): Promise<Product[]> => {
  const products: Product[] = [];

  if (workspaceId) {
    const workspaceKey = getWorkspaceProductsKey(workspaceId);
    const entries = kvState.kv.list<Product>({ prefix: workspaceKey });
    for await (const entry of entries) {
      products.push(entry.value);
    }
  } else {
    const entries = kvState.kv.list<Product>({ prefix: PRODUCT_KEY_PREFIX });
    for await (const entry of entries) {
      products.push(entry.value);
    }
  }

  return products.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
};

export const getProduct = async (
  kvState: WorkspaceKVState,
  productId: string,
): Promise<Product | null> => {
  const result = await kvState.kv.get<Product>(getProductKey(productId));
  return result.value;
};

export const addProduct = async (
  kvState: WorkspaceKVState,
  product: Omit<Product, "id" | "createdAt" | "updatedAt">,
): Promise<Product> => {
  const now = new Date().toISOString();
  const productId = crypto.randomUUID();
  const newProduct: Product = {
    ...product,
    id: productId,
    createdAt: now,
    updatedAt: now,
  };

  await kvState.kv.set(getProductKey(productId), newProduct);

  if (product.workspaceId) {
    await kvState.kv.set([...getWorkspaceProductsKey(product.workspaceId), productId], newProduct);
  }

  return newProduct;
};

export const updateProduct = async (
  kvState: WorkspaceKVState,
  productId: string,
  updates: Partial<Omit<Product, "id" | "createdAt">>,
): Promise<Product | null> => {
  const existing = await getProduct(kvState, productId);
  if (!existing) {
    return null;
  }

  const updated: Product = {
    ...existing,
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  await kvState.kv.set(getProductKey(productId), updated);

  if (updated.workspaceId) {
    await kvState.kv.set([...getWorkspaceProductsKey(updated.workspaceId), productId], updated);
  }

  return updated;
};

export const deleteProduct = async (
  kvState: WorkspaceKVState,
  productId: string,
): Promise<boolean> => {
  const existing = await getProduct(kvState, productId);
  if (!existing) {
    return false;
  }

  await kvState.kv.delete(getProductKey(productId));

  if (existing.workspaceId) {
    await kvState.kv.delete([...getWorkspaceProductsKey(existing.workspaceId), productId]);
  }

  return true;
};

// ==================== CATEGORY OPERATIONS ====================

export const listCategories = async (
  kvState: WorkspaceKVState,
  workspaceId?: string,
): Promise<ProductCategory[]> => {
  const categories: ProductCategory[] = [];

  if (workspaceId) {
    const workspaceKey = getWorkspaceCategoriesKey(workspaceId);
    const entries = kvState.kv.list<ProductCategory>({ prefix: workspaceKey });
    for await (const entry of entries) {
      categories.push(entry.value);
    }
  } else {
    const entries = kvState.kv.list<ProductCategory>({ prefix: CATEGORY_KEY_PREFIX });
    for await (const entry of entries) {
      categories.push(entry.value);
    }
  }

  return categories.sort((a, b) => a.name.localeCompare(b.name));
};

export const getCategory = async (
  kvState: WorkspaceKVState,
  categoryId: string,
): Promise<ProductCategory | null> => {
  const result = await kvState.kv.get<ProductCategory>(getCategoryKey(categoryId));
  return result.value;
};

export const addCategory = async (
  kvState: WorkspaceKVState,
  category: Omit<ProductCategory, "id" | "createdAt" | "updatedAt">,
): Promise<ProductCategory> => {
  const now = new Date().toISOString();
  const categoryId = crypto.randomUUID();
  const newCategory: ProductCategory = {
    ...category,
    id: categoryId,
    createdAt: now,
    updatedAt: now,
  };

  await kvState.kv.set(getCategoryKey(categoryId), newCategory);

  if (category.workspaceId) {
    await kvState.kv.set(
      [...getWorkspaceCategoriesKey(category.workspaceId), categoryId],
      newCategory,
    );
  }

  return newCategory;
};

export const updateCategory = async (
  kvState: WorkspaceKVState,
  categoryId: string,
  updates: Partial<Omit<ProductCategory, "id" | "createdAt">>,
): Promise<ProductCategory | null> => {
  const existing = await getCategory(kvState, categoryId);
  if (!existing) {
    return null;
  }

  const updated: ProductCategory = {
    ...existing,
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  await kvState.kv.set(getCategoryKey(categoryId), updated);

  if (updated.workspaceId) {
    await kvState.kv.set([...getWorkspaceCategoriesKey(updated.workspaceId), categoryId], updated);
  }

  return updated;
};

export const deleteCategory = async (
  kvState: WorkspaceKVState,
  categoryId: string,
): Promise<boolean> => {
  const existing = await getCategory(kvState, categoryId);
  if (!existing) {
    return false;
  }

  await kvState.kv.delete(getCategoryKey(categoryId));

  if (existing.workspaceId) {
    await kvState.kv.delete([...getWorkspaceCategoriesKey(existing.workspaceId), categoryId]);
  }

  return true;
};

// ==================== CONFIGURATION OPERATIONS ====================

export const listConfigurations = async (
  kvState: WorkspaceKVState,
  type?: string,
  workspaceId?: string,
): Promise<ProductConfiguration[]> => {
  const configurations: ProductConfiguration[] = [];

  if (workspaceId) {
    const workspaceKey = getWorkspaceConfigurationsKey(workspaceId);
    const entries = kvState.kv.list<ProductConfiguration>({ prefix: workspaceKey });
    for await (const entry of entries) {
      if (!type || entry.value.type === type) {
        configurations.push(entry.value);
      }
    }
  } else {
    const entries = kvState.kv.list<ProductConfiguration>({ prefix: CONFIGURATION_KEY_PREFIX });
    for await (const entry of entries) {
      if (!type || entry.value.type === type) {
        configurations.push(entry.value);
      }
    }
  }

  return configurations.sort((a, b) => a.name.localeCompare(b.name));
};

export const getConfiguration = async (
  kvState: WorkspaceKVState,
  configId: string,
): Promise<ProductConfiguration | null> => {
  const result = await kvState.kv.get<ProductConfiguration>(getConfigurationKey(configId));
  return result.value;
};

export const addConfiguration = async (
  kvState: WorkspaceKVState,
  configuration: Omit<ProductConfiguration, "id" | "createdAt" | "updatedAt">,
): Promise<ProductConfiguration> => {
  const now = new Date().toISOString();
  const configId = crypto.randomUUID();
  const newConfiguration: ProductConfiguration = {
    ...configuration,
    id: configId,
    createdAt: now,
    updatedAt: now,
  };

  await kvState.kv.set(getConfigurationKey(configId), newConfiguration);

  if (configuration.workspaceId) {
    await kvState.kv.set(
      [...getWorkspaceConfigurationsKey(configuration.workspaceId), configId],
      newConfiguration,
    );
  }

  return newConfiguration;
};

export const updateConfiguration = async (
  kvState: WorkspaceKVState,
  configId: string,
  updates: Partial<Omit<ProductConfiguration, "id" | "createdAt">>,
): Promise<ProductConfiguration | null> => {
  const existing = await getConfiguration(kvState, configId);
  if (!existing) {
    return null;
  }

  const updated: ProductConfiguration = {
    ...existing,
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  await kvState.kv.set(getConfigurationKey(configId), updated);

  if (updated.workspaceId) {
    await kvState.kv.set(
      [...getWorkspaceConfigurationsKey(updated.workspaceId), configId],
      updated,
    );
  }

  return updated;
};

export const deleteConfiguration = async (
  kvState: WorkspaceKVState,
  configId: string,
): Promise<boolean> => {
  const existing = await getConfiguration(kvState, configId);
  if (!existing) {
    return false;
  }

  await kvState.kv.delete(getConfigurationKey(configId));

  if (existing.workspaceId) {
    await kvState.kv.delete([...getWorkspaceConfigurationsKey(existing.workspaceId), configId]);
  }

  return true;
};

// ==================== RESTRICTION OPERATIONS ====================

export const listRestrictions = async (
  kvState: WorkspaceKVState,
  productId?: string,
  workspaceId?: string,
): Promise<ProductRestriction[]> => {
  const restrictions: ProductRestriction[] = [];

  if (productId) {
    const productKey = getProductRestrictionsKey(productId);
    const entries = kvState.kv.list<ProductRestriction>({ prefix: productKey });
    for await (const entry of entries) {
      restrictions.push(entry.value);
    }
  } else {
    const entries = kvState.kv.list<ProductRestriction>({ prefix: RESTRICTION_KEY_PREFIX });
    for await (const entry of entries) {
      if (!workspaceId || entry.value.workspaceId === workspaceId) {
        restrictions.push(entry.value);
      }
    }
  }

  return restrictions;
};

export const getRestriction = async (
  kvState: WorkspaceKVState,
  restrictionId: string,
): Promise<ProductRestriction | null> => {
  const result = await kvState.kv.get<ProductRestriction>(getRestrictionKey(restrictionId));
  return result.value;
};

export const addRestriction = async (
  kvState: WorkspaceKVState,
  restriction: Omit<ProductRestriction, "id" | "createdAt" | "updatedAt">,
): Promise<ProductRestriction> => {
  const now = new Date().toISOString();
  const restrictionId = crypto.randomUUID();
  const newRestriction: ProductRestriction = {
    ...restriction,
    id: restrictionId,
    createdAt: now,
    updatedAt: now,
  };

  await kvState.kv.set(getRestrictionKey(restrictionId), newRestriction);
  await kvState.kv.set(
    [...getProductRestrictionsKey(restriction.productId), restrictionId],
    newRestriction,
  );

  return newRestriction;
};

export const deleteRestriction = async (
  kvState: WorkspaceKVState,
  restrictionId: string,
): Promise<boolean> => {
  const existing = await getRestriction(kvState, restrictionId);
  if (!existing) {
    return false;
  }

  await kvState.kv.delete(getRestrictionKey(restrictionId));
  await kvState.kv.delete([...getProductRestrictionsKey(existing.productId), restrictionId]);

  return true;
};

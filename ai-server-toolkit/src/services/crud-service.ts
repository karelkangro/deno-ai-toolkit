/**
 * Generic CRUD Service Factory
 *
 * Provides a reusable CRUD service factory for workspace-scoped entities stored in Deno KV.
 * Follows the same patterns as existing toolkit services (workspace, rules, products).
 *
 * @since 1.11.0
 */

import type { WorkspaceKVState } from "../workspace/types.ts";
import { createSubLogger } from "../utils/logger.ts";

const logger = createSubLogger("crud-service");

/**
 * Configuration for creating a CRUD service
 *
 * @since 1.11.0
 */
export interface CrudServiceConfig<T> {
  /** Key prefix for KV storage (e.g., ["sessions"]) */
  keyPrefix: string[];
  /** Optional workspace index prefix for filtering (e.g., ["sessions", "workspace"]) */
  workspaceIndexPrefix?: string[];
  /** Optional sorting function for getAll results */
  sortBy?: (a: T, b: T) => number;
  /** Optional transform function for data normalization */
  transform?: (data: unknown) => T;
}

/**
 * CRUD service interface returned by createCrudService
 *
 * @since 1.11.0
 */
export interface CrudService<T extends { id: string; createdAt: string; updatedAt: string }> {
  /** Get all entities, optionally filtered by workspace */
  getAll: (workspaceId?: string) => Promise<T[]>;
  /** Get entity by ID, optionally filtered by workspace */
  getById: (id: string, workspaceId?: string) => Promise<T | null>;
  /** Create a new entity */
  create: (data: Omit<T, "id" | "createdAt" | "updatedAt">) => Promise<T>;
  /** Update an existing entity */
  update: (
    id: string,
    updates: Partial<Omit<T, "id" | "createdAt">>,
    workspaceId?: string,
  ) => Promise<T | null>;
  /** Delete an entity by ID */
  deleteById: (id: string, workspaceId?: string) => Promise<boolean>;
}

/**
 * Creates a generic CRUD service for workspace-scoped entities
 *
 * This factory function creates a CRUD service following the same patterns as
 * existing toolkit services (workspace, rules, products). It handles:
 * - Workspace-scoped filtering
 * - Automatic ID generation (UUID)
 * - Timestamp management (createdAt, updatedAt)
 * - Key prefix management for KV storage
 * - Optional workspace indexing for efficient filtering
 *
 * @param kvState - Workspace KV state instance
 * @param config - CRUD service configuration
 * @returns CRUD service with getAll, getById, create, update, deleteById methods
 *
 * @example
 * ```ts
 * interface Session {
 *   id: string;
 *   workspaceId: string;
 *   createdAt: string;
 *   updatedAt: string;
 *   // ... other fields
 * }
 *
 * const sessionService = createCrudService<Session>(kvState, {
 *   keyPrefix: ["sessions"],
 *   workspaceIndexPrefix: ["sessions", "workspace"],
 *   sortBy: (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
 * });
 *
 * // Use the service
 * const sessions = await sessionService.getAll("workspace-123");
 * const session = await sessionService.getById("session-456", "workspace-123");
 * const newSession = await sessionService.create({ workspaceId: "workspace-123", ... });
 * ```
 *
 * @since 1.11.0
 */
export function createCrudService<
  T extends { id: string; createdAt: string; updatedAt: string; workspaceId?: string },
>(
  kvState: WorkspaceKVState,
  config: CrudServiceConfig<T>,
): CrudService<T> {
  const getEntityKey = (id: string): Deno.KvKey => [...config.keyPrefix, id];

  const getWorkspaceEntityKey = (workspaceId: string, id: string): Deno.KvKey => {
    if (config.workspaceIndexPrefix) {
      return [...config.workspaceIndexPrefix, workspaceId, id];
    }
    return [...config.keyPrefix, workspaceId, id];
  };

  const getAll = async (workspaceId?: string): Promise<T[]> => {
    const entities: T[] = [];
    const seenIds = new Set<string>();

    if (workspaceId && config.workspaceIndexPrefix) {
      // Use workspace index for efficient filtering
      const workspaceKey = [...config.workspaceIndexPrefix, workspaceId];
      const entries = kvState.kv.list<T>({ prefix: workspaceKey });
      for await (const entry of entries) {
        if (entry.value && !seenIds.has(entry.value.id)) {
          seenIds.add(entry.value.id);
          const entity = config.transform ? config.transform(entry.value) : entry.value;
          entities.push(entity);
        }
      }
    } else if (workspaceId) {
      // Filter by workspaceId in entity data
      const entries = kvState.kv.list<T>({ prefix: config.keyPrefix });
      for await (const entry of entries) {
        // Skip workspace-indexed entries to avoid duplicates
        if (
          config.workspaceIndexPrefix && entry.key.length > 1 &&
          entry.key[1] === config.workspaceIndexPrefix[0]
        ) {
          continue;
        }
        if (
          entry.value && entry.value.workspaceId === workspaceId && !seenIds.has(entry.value.id)
        ) {
          seenIds.add(entry.value.id);
          const entity = config.transform ? config.transform(entry.value) : entry.value;
          entities.push(entity);
        }
      }
    } else {
      // Get all entities
      const entries = kvState.kv.list<T>({ prefix: config.keyPrefix });
      for await (const entry of entries) {
        // Skip workspace-indexed entries to avoid duplicates
        if (
          config.workspaceIndexPrefix && entry.key.length > 1 &&
          entry.key[1] === config.workspaceIndexPrefix[0]
        ) {
          continue;
        }
        if (entry.value && !seenIds.has(entry.value.id)) {
          seenIds.add(entry.value.id);
          const entity = config.transform ? config.transform(entry.value) : entry.value;
          entities.push(entity);
        }
      }
    }

    return config.sortBy ? entities.sort(config.sortBy) : entities;
  };

  const getById = async (id: string, workspaceId?: string): Promise<T | null> => {
    const result = await kvState.kv.get<T>(getEntityKey(id));
    if (!result.value) {
      return null;
    }
    if (workspaceId && result.value.workspaceId !== workspaceId) {
      return null;
    }
    return config.transform ? config.transform(result.value) : result.value;
  };

  const create = async (data: Omit<T, "id" | "createdAt" | "updatedAt">): Promise<T> => {
    const now = new Date().toISOString();
    const id = crypto.randomUUID();
    const newEntity: T = {
      ...data,
      id,
      createdAt: now,
      updatedAt: now,
    } as T;

    await kvState.kv.set(getEntityKey(id), newEntity);

    // Update workspace index if configured
    if (config.workspaceIndexPrefix && newEntity.workspaceId) {
      await kvState.kv.set(getWorkspaceEntityKey(newEntity.workspaceId, id), newEntity);
    }

    logger.debug("Created entity", { id, keyPrefix: config.keyPrefix });
    return newEntity;
  };

  const update = async (
    id: string,
    updates: Partial<Omit<T, "id" | "createdAt">>,
    workspaceId?: string,
  ): Promise<T | null> => {
    const existing = await getById(id, workspaceId);
    if (!existing) {
      return null;
    }

    const updated: T = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString(),
    } as T;

    await kvState.kv.set(getEntityKey(id), updated);

    // Update workspace index if configured
    if (config.workspaceIndexPrefix && updated.workspaceId) {
      await kvState.kv.set(getWorkspaceEntityKey(updated.workspaceId, id), updated);
    }

    logger.debug("Updated entity", { id, keyPrefix: config.keyPrefix });
    return updated;
  };

  const deleteById = async (id: string, workspaceId?: string): Promise<boolean> => {
    const existing = await getById(id, workspaceId);
    if (!existing) {
      return false;
    }

    await kvState.kv.delete(getEntityKey(id));

    // Delete from workspace index if configured
    if (config.workspaceIndexPrefix && existing.workspaceId) {
      await kvState.kv.delete(getWorkspaceEntityKey(existing.workspaceId, id));
    }

    logger.debug("Deleted entity", { id, keyPrefix: config.keyPrefix });
    return true;
  };

  return {
    getAll,
    getById,
    create,
    update,
    deleteById,
  };
}

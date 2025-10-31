// Single source of truth for LanceDB vector store schemas
// Ensures type safety and consistency across all table operations

import type { LanceDBState } from "./lancedb.ts";
import type { Rule } from "../rules/types.ts";

/**
 * Base metadata that all documents have
 */
export interface BaseVectorMetadata {
  // Add common fields here if needed
}

/**
 * Rule document metadata schema
 * This is the single source of truth for rule metadata structure
 */
export interface RuleVectorMetadata extends BaseVectorMetadata {
  ruleId: string;
  name: string;
  category: string;
  severity: "critical" | "high" | "medium" | "low";
  enabled: boolean;
  schemaId: string;
  keywords: string[];
  version: number;
  createdAt: string;
  updatedAt: string;
  // Dynamic data fields from rule.data are prefixed with data_
  [key: `data_${string}`]: string | number | boolean;
  // General index signature for compatibility with Record<string, unknown>
  [key: string]: unknown;
}

/**
 * Base document metadata schema for document embedding systems
 * Common fields that any document chunking/embedding system would need
 * Extend this for app-specific metadata requirements
 */
export interface BaseDocumentMetadata extends BaseVectorMetadata {
  /** Document identifier */
  documentId: string;
  /** Human-readable document name */
  documentName: string;
  /** Index of this chunk within the document (0-based) */
  chunkIndex: number;
  /** Total number of chunks in the document */
  totalChunks: number;
  /** Workspace/namespace identifier */
  workspaceId: string;
}

/**
 * Helper function to create base document metadata
 * Ensures consistent structure for document chunks
 */
export function createBaseDocumentMetadata(
  documentId: string,
  documentName: string,
  chunkIndex: number,
  totalChunks: number,
  workspaceId: string,
): BaseDocumentMetadata {
  return {
    documentId: String(documentId),
    documentName: String(documentName),
    chunkIndex,
    totalChunks,
    workspaceId: String(workspaceId),
  };
}

/**
 * File/document metadata schema (legacy, use BaseDocumentMetadata for new code)
 */
export interface FileVectorMetadata extends BaseVectorMetadata {
  fileName: string;
  fileType: string;
  uploadedAt: string;
  fileSize?: number;
  pageNumber?: number;
  // General index signature for compatibility with Record<string, unknown>
  [key: string]: unknown;
}

/**
 * Convert Rule to RuleVectorMetadata
 */
export function ruleToVectorMetadata(rule: Rule): RuleVectorMetadata {
  const metadata: RuleVectorMetadata = {
    ruleId: rule.id,
    name: rule.name,
    category: rule.category,
    severity: rule.severity,
    enabled: rule.enabled,
    schemaId: rule.schemaId,
    keywords: rule.keywords,
    version: rule.version,
    createdAt: rule.createdAt,
    updatedAt: rule.updatedAt,
  };

  // Add dynamic data fields with data_ prefix
  for (const [key, value] of Object.entries(rule.data)) {
    const dataKey = `data_${key}` as `data_${string}`;
    metadata[dataKey] =
      typeof value === "string" || typeof value === "number" || typeof value === "boolean"
        ? value
        : JSON.stringify(value);
  }

  return metadata;
}

/**
 * Get field name for LanceDB query
 * Handles Cloud (meta_prefix) vs Local (metadata.prefix) automatically
 */
export function getFieldName(
  fieldName: keyof RuleVectorMetadata | keyof FileVectorMetadata,
  isCloud: boolean,
): string {
  return isCloud ? `meta_${fieldName}` : `metadata.${fieldName}`;
}

/**
 * Build filter string for LanceDB queries
 * Type-safe filter building
 */
export function buildRuleFilters(
  filters: {
    category?: string;
    severity?: string[];
    enabled?: boolean;
  },
  isCloud: boolean,
): string | undefined {
  const conditions: string[] = [];

  if (filters.category) {
    const field = getFieldName("category", isCloud);
    conditions.push(`${field} = '${filters.category}'`);
  }

  if (filters.enabled !== undefined) {
    const field = getFieldName("enabled", isCloud);
    conditions.push(`${field} = ${filters.enabled}`);
  }

  if (filters.severity && filters.severity.length > 0) {
    const field = getFieldName("severity", isCloud);
    const severityList = filters.severity.map((s) => `'${s}'`).join(", ");
    conditions.push(`${field} IN (${severityList})`);
  }

  return conditions.length > 0 ? conditions.join(" AND ") : undefined;
}

/**
 * Transform metadata for LanceDB storage
 * Handles Cloud (flat meta_* fields) vs Local (nested metadata object)
 */
export function transformMetadataForStorage<T extends Record<string, unknown>>(
  metadata: T,
  isCloud: boolean,
): Record<string, unknown> {
  if (!isCloud) {
    return { metadata };
  }

  // Cloud: flatten metadata as individual columns with meta_ prefix
  const flatMetadata: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(metadata)) {
    flatMetadata[`meta_${key}`] =
      typeof value === "string" || typeof value === "number" || typeof value === "boolean"
        ? value
        : JSON.stringify(value);
  }
  return flatMetadata;
}

/**
 * Extract metadata from LanceDB result
 * Handles Cloud (meta_* fields) vs Local (metadata object)
 */
export function extractMetadataFromResult<T extends Record<string, unknown>>(
  result: Record<string, unknown>,
  isCloud: boolean,
): T {
  if (!isCloud) {
    return (result.metadata as T) || ({} as T);
  }

  // Cloud: extract meta_* fields
  const metadata: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(result)) {
    if (key.startsWith("meta_") && value !== null && value !== undefined) {
      const metaKey = key.replace("meta_", "");
      try {
        metadata[metaKey] =
          typeof value === "string" && (value.startsWith("{") || value.startsWith("["))
            ? JSON.parse(value)
            : value;
      } catch {
        metadata[metaKey] = value;
      }
    }
  }
  return metadata as T;
}

/**
 * Create a LanceDB record for rule
 * Single source of truth for rule record structure
 */
export function createRuleRecord(
  rule: Rule,
  embedding: number[],
  isCloud: boolean,
): Record<string, unknown> {
  const metadata = ruleToVectorMetadata(rule);

  return {
    id: rule.id,
    content: rule.content,
    vector: embedding,
    ...transformMetadataForStorage(metadata, isCloud),
  };
}

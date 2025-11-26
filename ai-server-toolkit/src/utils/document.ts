/**
 * Document utility functions
 * Provides helpers for working with document content types, MIME types, and content storage
 */

import type { DocumentContentType } from "../workspace/types.ts";

/**
 * Map document content type to MIME type
 *
 * @param contentType Document content type
 * @returns MIME type string
 *
 * @example
 * ```ts
 * contentTypeToMimeType("markdown") // "text/markdown"
 * contentTypeToMimeType("html") // "text/html"
 * contentTypeToMimeType("pdf") // "application/pdf"
 * ```
 */
export function contentTypeToMimeType(contentType: DocumentContentType | string): string {
  const mapping: Record<string, string> = {
    text: "text/plain",
    markdown: "text/markdown",
    html: "text/html",
    pdf: "application/pdf",
    url: "text/uri-list",
    json: "application/json",
    csv: "text/csv",
    xml: "application/xml",
  };

  return mapping[contentType.toLowerCase()] || "application/octet-stream";
}

/**
 * Extract content from WorkspaceDocument metadata
 * Content is stored in metadata.content as per file storage pattern
 *
 * @param document WorkspaceDocument with content in metadata
 * @returns Content string or empty string if not found
 *
 * @example
 * ```ts
 * const content = extractContentFromMetadata(doc);
 * ```
 */
export function extractContentFromMetadata(
  document: { metadata?: Record<string, unknown> },
): string {
  const content = document.metadata?.content;
  if (typeof content === "string") {
    return content;
  }
  return "";
}

/**
 * Store content in WorkspaceDocument metadata
 * Returns updated metadata object with content stored in metadata.content
 *
 * @param metadata Existing metadata object
 * @param content Content string to store
 * @returns Updated metadata with content stored
 *
 * @example
 * ```ts
 * const updatedMetadata = storeContentInMetadata(existing.metadata, "document content");
 * ```
 */
export function storeContentInMetadata(
  metadata: Record<string, unknown> | undefined,
  content: string,
): Record<string, unknown> {
  return {
    ...metadata,
    content,
  };
}

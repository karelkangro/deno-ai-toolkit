// Citation formatter for LLM responses
import type { CitationInfo } from "./types.ts";

/**
 * Formats citation information for display in LLM responses.
 *
 * Creates a user-friendly, multi-line citation with emojis for visual clarity.
 * Includes document name, page number, section, heading, and standard references.
 *
 * @param citation Citation information extracted from chunk metadata
 * @returns Formatted multi-line citation string with emojis
 *
 * @example
 * ```ts
 * const citation = formatCitation({
 *   documentName: "EVS 812",
 *   pageNumber: 15,
 *   section: "3.2.1"
 * });
 * // Returns:
 * // "📄 EVS 812
 * // 📍 Page 15, §3.2.1"
 * ```
 */
export function formatCitation(citation: CitationInfo): string {
  const parts: string[] = [];

  parts.push(`📄 ${citation.documentName}`);

  if (citation.pageNumber) {
    const pageInfo = `📍 Page ${citation.pageNumber}`;
    if (citation.section) {
      parts.push(`${pageInfo}, §${citation.section}`);
    } else if (citation.heading) {
      parts.push(`${pageInfo} (${citation.heading})`);
    } else {
      parts.push(pageInfo);
    }
  }

  if (citation.standardReferences && citation.standardReferences.length > 0) {
    parts.push(`📋 ${citation.standardReferences.join(", ")}`);
  }

  if (citation.chunkIndex !== undefined && citation.totalChunks !== undefined) {
    parts.push(`📑 Chunk ${citation.chunkIndex + 1}/${citation.totalChunks}`);
  }

  return parts.join("\n");
}

/**
 * Formats citation in a compact, single-line format.
 *
 * Creates a brief citation suitable for inline references or limited space.
 * Uses pipe separators between components.
 *
 * @param citation Citation information extracted from chunk metadata
 * @returns Compact single-line citation string
 *
 * @example
 * ```ts
 * const citation = formatCitationCompact({
 *   documentName: "EVS 812",
 *   pageNumber: 15,
 *   section: "3.2.1"
 * });
 * // Returns: "EVS 812 | p.15 | §3.2.1"
 * ```
 */
export function formatCitationCompact(citation: CitationInfo): string {
  const parts: string[] = [];

  if (citation.documentName) {
    parts.push(citation.documentName);
  }

  if (citation.pageNumber) {
    parts.push(`p.${citation.pageNumber}`);
  }

  if (citation.section) {
    parts.push(`§${citation.section}`);
  }

  return parts.join(" | ");
}

/**
 * Formats citation as structured Markdown.
 *
 * Creates a well-formatted Markdown citation with headers, lists, and proper
 * structure suitable for documentation or reports.
 *
 * @param citation Citation information extracted from chunk metadata
 * @returns Markdown-formatted citation string
 *
 * @example
 * ```ts
 * const citation = formatCitationMarkdown({
 *   documentName: "EVS 812",
 *   pageNumber: 15,
 *   heading: "Thermal requirements"
 * });
 * // Returns Markdown with headers and bullet points
 * ```
 */
export function formatCitationMarkdown(citation: CitationInfo): string {
  let md = `**${citation.documentName}**\n\n`;

  if (citation.pageNumber) {
    md += `- **Page**: ${citation.pageNumber}\n`;
  }

  if (citation.section) {
    md += `- **Section**: ${citation.section}\n`;
  } else if (citation.heading) {
    md += `- **Heading**: ${citation.heading}\n`;
  }

  if (citation.standardReferences && citation.standardReferences.length > 0) {
    md += `- **References**: ${citation.standardReferences.join(", ")}\n`;
  }

  return md;
}

/**
 * Extracts citation information from chunk metadata.
 *
 * Parses chunk metadata to extract all relevant citation fields including
 * document name, page numbers, sections, headings, and standard references.
 *
 * @param metadata Chunk metadata object with citation-related fields
 * @returns CitationInfo object with extracted citation data
 *
 * @example
 * ```ts
 * const citation = extractCitationFromMetadata({
 *   documentName: "EVS 812",
 *   pageNumber: 15,
 *   section: "3.2.1"
 * });
 * ```
 */
export function extractCitationFromMetadata(
  // deno-lint-ignore no-explicit-any
  metadata: Record<string, any>,
): CitationInfo {
  return {
    documentName: metadata.documentName || "Unknown Document",
    pageNumber: metadata.pageNumber,
    section: metadata.section,
    heading: metadata.heading,
    chunkIndex: metadata.chunkIndex,
    totalChunks: metadata.totalChunks,
    standardReferences: metadata.standardReferences,
  };
}

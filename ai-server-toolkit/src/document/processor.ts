// Main document processor orchestrator
import type {
  ChunkingOptions,
  DocumentChunk,
  DocumentMetadata,
  ProcessedDocument,
} from "./types.ts";
import { DEFAULT_CHUNKING_OPTIONS } from "./types.ts";
import { extractPDFContent, extractTextOnly } from "./pdf-extractor.ts";
import { chunkDocumentPages } from "./chunking.ts";
import {
  buildSectionHierarchy,
  detectLegalKeywords,
  detectSectionNumbers,
  detectStandardReferences,
  enrichChunksWithLegalContext,
} from "./estonian-legal.ts";

/**
 * Processes a legal or regulatory document with specialized extraction and chunking.
 *
 * Main orchestrator that combines PDF extraction, legal content detection, section
 * hierarchy building, and intelligent chunking. Specifically designed for Estonian
 * building codes and regulatory documents.
 *
 * Features:
 * - Page-by-page PDF extraction with metadata
 * - Standard reference detection (EVS, RT, ISO)
 * - Legal keyword identification
 * - Section numbering and hierarchy
 * - Smart chunking with configurable strategies
 * - Rich metadata for citations
 *
 * @param content PDF file as Uint8Array (raw bytes)
 * @param options Partial chunking options (merged with defaults)
 * @returns Object containing processed document and enriched chunks
 *
 * @example
 * ```ts
 * const pdfBytes = await Deno.readFile("building-code.pdf");
 * const { document, chunks } = await processLegalDocument(pdfBytes, {
 *   strategy: "paragraph",
 *   maxChunkSize: 1000,
 *   language: "et"
 * });
 * console.log(chunks[0].metadata.standards);
 * ```
 */
export async function processLegalDocument(
  content: Uint8Array,
  options: Partial<ChunkingOptions> = {},
): Promise<{
  document: ProcessedDocument;
  chunks: DocumentChunk[];
}> {
  const opts: ChunkingOptions = {
    ...DEFAULT_CHUNKING_OPTIONS,
    ...options,
  };

  const document = await extractPDFContent(content);

  for (const page of document.pages) {
    const references = detectStandardReferences(page.text, page.pageNumber);
    document.structure.standardReferences.push(...references);

    const keywords = detectLegalKeywords(page.text, opts.language);
    document.structure.legalKeywords.push(...keywords);

    const sections = detectSectionNumbers(page.text);
    page.sections = sections.map((section) => ({
      level: calculateSectionLevel(section.pattern),
      title: section.title || "",
      content: "",
      pageNumber: page.pageNumber,
      startChar: 0,
      endChar: 0,
    }));
  }

  document.structure.legalKeywords = Array.from(new Set(document.structure.legalKeywords));

  const allSections = document.pages.flatMap((p) =>
    p.sections.map((s) => ({
      pattern: `${s.level}`,
      title: s.title,
      type: "numbered" as const,
      page: p.pageNumber,
    }))
  );
  document.structure.sections = buildSectionHierarchy(allSections);

  let chunks = chunkDocumentPages(document.pages, opts);

  chunks = enrichChunksWithLegalContext(chunks, document.pages, opts.language);

  return {
    document,
    chunks,
  };
}

/**
 * Extracts plain text from a document without processing or chunking.
 *
 * Quick extraction that returns the full text content as a single string.
 * Useful for simple text analysis or when metadata is not needed.
 *
 * @param content PDF file as Uint8Array (raw bytes)
 * @returns Promise resolving to the complete text content
 *
 * @example
 * ```ts
 * const pdfBytes = await Deno.readFile("document.pdf");
 * const text = await extractDocumentText(pdfBytes);
 * console.log(text.length);
 * ```
 */
export async function extractDocumentText(content: Uint8Array): Promise<string> {
  return await extractTextOnly(content);
}

/**
 * Extracts only metadata from a document without full processing.
 *
 * Lightweight extraction that returns document metadata (title, author, dates,
 * page count) without processing the full content or creating chunks.
 *
 * @param content PDF file as Uint8Array (raw bytes)
 * @returns Promise resolving to DocumentMetadata object
 *
 * @example
 * ```ts
 * const pdfBytes = await Deno.readFile("document.pdf");
 * const metadata = await extractDocumentMetadata(pdfBytes);
 * console.log(metadata.title);
 * console.log(metadata.pageCount);
 * ```
 */
export async function extractDocumentMetadata(
  content: Uint8Array,
): Promise<DocumentMetadata> {
  const document = await extractPDFContent(content);
  return document.metadata;
}

function calculateSectionLevel(pattern: string): number {
  if (pattern.startsWith("§")) {
    return 1;
  }
  return pattern.split(".").length;
}

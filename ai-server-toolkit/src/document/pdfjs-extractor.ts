/**
 * PDF extraction using pdfjs-dist (Mozilla PDF.js)
 *
 * Provides proper Unicode/UTF-8 support for documents with special characters.
 * Better alternative to pdf-parse for international documents.
 */

import * as pdfjsLib from "npm:pdfjs-dist@4.0.379";
import type { DocumentMetadata, DocumentPage, ProcessedDocument } from "./types.ts";
import { createSubLogger } from "../utils/logger.ts";

const logger = createSubLogger("pdfjs-extractor");

// Disable worker to avoid canvas dependency issues in Deno
// Setting to false disables the worker entirely
if (
  "GlobalWorkerOptions" in pdfjsLib && typeof pdfjsLib.GlobalWorkerOptions === "object" &&
  pdfjsLib.GlobalWorkerOptions !== null
) {
  (pdfjsLib.GlobalWorkerOptions as { workerSrc?: unknown }).workerSrc = false;
}

/**
 * Extract PDF content using pdfjs-dist with proper UTF-8 encoding
 *
 * @param content PDF file as Uint8Array
 * @returns ProcessedDocument with pages and metadata
 */
export async function extractPDFContentWithPdfjs(
  content: Uint8Array,
): Promise<ProcessedDocument> {
  try {
    logger.debug("Loading PDF document");

    // Load PDF document
    const loadingTask = pdfjsLib.getDocument({
      data: content,
      useWorkerFetch: false,
      isEvalSupported: false,
      useSystemFonts: true,
    });

    const pdfDocument = await loadingTask.promise;

    logger.debug("PDF loaded", { pageCount: pdfDocument.numPages });

    // Extract metadata
    const metadata = await pdfDocument.getMetadata();
    const info = metadata.info as Record<string, unknown>;

    const documentMetadata: DocumentMetadata = {
      title: typeof info?.Title === "string" ? info.Title : undefined,
      author: typeof info?.Author === "string" ? info.Author : undefined,
      subject: typeof info?.Subject === "string" ? info.Subject : undefined,
      keywords: typeof info?.Keywords === "string"
        ? info.Keywords.split(",").map((k) => k.trim())
        : undefined,
      creationDate: typeof info?.CreationDate === "string" ? info.CreationDate : undefined,
      modificationDate: typeof info?.ModDate === "string" ? info.ModDate : undefined,
      pageCount: pdfDocument.numPages,
      producer: typeof info?.Producer === "string" ? info.Producer : undefined,
      creator: typeof info?.Creator === "string" ? info.Creator : undefined,
    };

    logger.debug("Metadata extracted", {
      title: documentMetadata.title,
      pages: documentMetadata.pageCount,
    });

    // Extract text from each page
    const pages: DocumentPage[] = [];

    for (let pageNum = 1; pageNum <= pdfDocument.numPages; pageNum++) {
      const page = await pdfDocument.getPage(pageNum);
      const textContent = await page.getTextContent();

      // Combine text items with proper spacing
      const pageText = textContent.items
        .map((item: unknown) => {
          // Handle text items with proper string extraction
          if (typeof item === "object" && item !== null && "str" in item) {
            const textItem = item as { str: unknown };
            return typeof textItem.str === "string" ? textItem.str : "";
          }
          return "";
        })
        .join(" ")
        .replace(/\s+/g, " ") // Normalize whitespace
        .trim();

      pages.push({
        pageNumber: pageNum,
        text: pageText,
        sections: [],
        hasTable: detectTable(pageText),
        hasImage: false,
      });

      if (pageNum % 10 === 0) {
        logger.debug("Processing page", { currentPage: pageNum, totalPages: pdfDocument.numPages });
      }
    }

    logger.info("Extracted text from PDF", { pageCount: pages.length });

    // Log character encoding sample
    const allText = pages.map((p) => p.text).join("\n\n");
    const hasUnicode = /[äöüõšžÄÖÜÕŠŽ]/.test(allText);
    logger.debug("Unicode characters detected", { hasUnicode });

    return {
      pages,
      metadata: documentMetadata,
      structure: {
        sections: [],
        standardReferences: [],
        legalKeywords: [],
      },
    };
  } catch (error) {
    logger.error("PDF extraction failed", error);
    throw new Error(
      `pdfjs-dist extraction failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/**
 * Extract only text content using pdfjs-dist (lightweight)
 *
 * @param content PDF file as Uint8Array
 * @returns Complete text content as string
 */
export async function extractTextOnlyWithPdfjs(content: Uint8Array): Promise<string> {
  const doc = await extractPDFContentWithPdfjs(content);
  return doc.pages.map((p) => p.text).join("\n\n");
}

function detectTable(text: string): boolean {
  const tablePatterns = [
    /\|[^|]+\|[^|]+\|/,
    /\t[^\t]+\t[^\t]+\t/,
    /(\d+\s+){3,}/,
  ];

  return tablePatterns.some((pattern) => pattern.test(text));
}

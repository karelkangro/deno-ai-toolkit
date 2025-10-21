import { Buffer } from "node:buffer";
import { PDFParse } from "pdf-parse";
import type { DocumentMetadata, DocumentPage, ProcessedDocument } from "./types.ts";
import type { PDFParser } from "./pdf-parse-types.ts";

/**
 * Extracts complete PDF content including metadata, text, and page-by-page breakdown.
 *
 * Parses a PDF file to extract document metadata (title, author, dates), full text content,
 * and individual page data with section detection. Automatically detects potential table of
 * contents pages and identifies list structures.
 *
 * @param content PDF file as Uint8Array (raw bytes)
 * @returns Promise resolving to ProcessedDocument with metadata, pages, and full text
 *
 * @example
 * ```ts
 * const pdfBytes = await Deno.readFile("document.pdf");
 * const doc = await extractPDFContent(pdfBytes);
 * console.log(doc.metadata.title);
 * console.log(doc.pages.length);
 * ```
 */
export async function extractPDFContent(
  content: Uint8Array,
): Promise<ProcessedDocument> {
  try {
    const buffer = Buffer.from(content);
    const parser = new PDFParse({ data: buffer });

    const pdfData = await parser.getText();

    const info = pdfData.info || {};
    const pageCount = pdfData.numpages || pdfData.numPages || 0;

    const metadata: DocumentMetadata = {
      title: info.Title,
      author: info.Author,
      subject: info.Subject,
      keywords: info.Keywords?.split(",").map((k: string) => k.trim()),
      creationDate: info.CreationDate,
      modificationDate: info.ModDate,
      pageCount,
      producer: info.Producer,
      creator: info.Creator,
    };

    const pages: DocumentPage[] = extractPagesFromText(pdfData.text, pageCount);

    await parser.destroy();

    return {
      pages,
      metadata,
      structure: {
        sections: [],
        standardReferences: [],
        legalKeywords: [],
      },
    };
  } catch (error) {
    throw new Error(
      `PDF extraction failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

const extractPagesFromText = (fullText: string, pageCount: number): DocumentPage[] => {
  const formFeedSplit = fullText.split("\f");

  if (formFeedSplit.length > 1 && formFeedSplit.length === pageCount) {
    return formFeedSplit.map((pageText, index) => ({
      pageNumber: index + 1,
      text: pageText.trim(),
      sections: [],
      hasTable: detectTable(pageText),
      hasImage: false,
    }));
  }

  const avgCharsPerPage = Math.ceil(fullText.length / pageCount);
  const pages: DocumentPage[] = [];

  const paragraphs = fullText.split(/\n\n+/);
  let currentPage = 1;
  let currentPageText = "";

  for (const para of paragraphs) {
    if (currentPageText.length + para.length > avgCharsPerPage && currentPage < pageCount) {
      pages.push({
        pageNumber: currentPage,
        text: currentPageText.trim(),
        sections: [],
        hasTable: detectTable(currentPageText),
        hasImage: false,
      });
      currentPage++;
      currentPageText = para;
    } else {
      currentPageText += (currentPageText ? "\n\n" : "") + para;
    }
  }

  if (currentPageText.trim()) {
    pages.push({
      pageNumber: currentPage,
      text: currentPageText.trim(),
      sections: [],
      hasTable: detectTable(currentPageText),
      hasImage: false,
    });
  }

  return pages;
};

function detectTable(text: string): boolean {
  const tablePatterns = [
    /\|[^|]+\|[^|]+\|/,
    /\t[^\t]+\t[^\t]+\t/,
    /(\d+\s+){3,}/,
  ];

  return tablePatterns.some((pattern) => pattern.test(text));
}

/**
 * Extracts only the text content from a PDF without metadata or page breakdown.
 *
 * Lightweight extraction that returns the full text of the PDF as a single string.
 * Useful when metadata and page-level information are not needed.
 *
 * @param content PDF file as Uint8Array (raw bytes)
 * @returns Promise resolving to the complete text content of the PDF
 *
 * @example
 * ```ts
 * const pdfBytes = await Deno.readFile("document.pdf");
 * const text = await extractTextOnly(pdfBytes);
 * console.log(text);
 * ```
 */
export async function extractTextOnly(content: Uint8Array): Promise<string> {
  const buffer = Buffer.from(content);
  const parser = new PDFParse({ data: buffer });
  const pdfData = await parser.getText();
  await parser.destroy();
  return pdfData.text || "";
}

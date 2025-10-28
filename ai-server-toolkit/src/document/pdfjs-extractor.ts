/**
 * PDF extraction using pdfjs-dist (Mozilla PDF.js)
 *
 * Provides proper Unicode/UTF-8 support for documents with special characters.
 * Better alternative to pdf-parse for international documents.
 */

import * as pdfjsLib from "npm:pdfjs-dist@4.0.379";
import type { DocumentMetadata, DocumentPage, ProcessedDocument } from "./types.ts";

// Disable worker to avoid canvas dependency issues in Deno
pdfjsLib.GlobalWorkerOptions.workerSrc = "";

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
    console.log(`🔍 [pdfjs] Loading PDF document...`);

    // Load PDF document
    const loadingTask = pdfjsLib.getDocument({
      data: content,
      useWorkerFetch: false,
      isEvalSupported: false,
      useSystemFonts: true,
    });

    const pdfDocument = await loadingTask.promise;

    console.log(`✅ [pdfjs] PDF loaded: ${pdfDocument.numPages} pages`);

    // Extract metadata
    const metadata = await pdfDocument.getMetadata();
    const info = metadata.info as any;

    const documentMetadata: DocumentMetadata = {
      title: info?.Title,
      author: info?.Author,
      subject: info?.Subject,
      keywords: info?.Keywords?.split(",").map((k: string) => k.trim()),
      creationDate: info?.CreationDate,
      modificationDate: info?.ModDate,
      pageCount: pdfDocument.numPages,
      producer: info?.Producer,
      creator: info?.Creator,
    };

    console.log(`📊 [pdfjs] Metadata extracted:`, {
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
        .map((item: any) => {
          // Handle text items with proper string extraction
          if ('str' in item) {
            return item.str;
          }
          return '';
        })
        .join(' ')
        .replace(/\s+/g, ' ')  // Normalize whitespace
        .trim();

      pages.push({
        pageNumber: pageNum,
        text: pageText,
        sections: [],
        hasTable: detectTable(pageText),
        hasImage: false,
      });

      if (pageNum % 10 === 0) {
        console.log(`📄 [pdfjs] Processed ${pageNum}/${pdfDocument.numPages} pages`);
      }
    }

    console.log(`✅ [pdfjs] Extracted text from ${pages.length} pages`);

    // Log character encoding sample
    const allText = pages.map(p => p.text).join('\n\n');
    const hasUnicode = /[äöüõšžÄÖÜÕŠŽ]/.test(allText);
    console.log(`🔤 [pdfjs] Unicode characters detected: ${hasUnicode ? 'YES ✓' : 'NO'}`);

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
    console.error(`❌ [pdfjs] PDF extraction failed:`, error);
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
  return doc.pages.map(p => p.text).join('\n\n');
}

function detectTable(text: string): boolean {
  const tablePatterns = [
    /\|[^|]+\|[^|]+\|/,
    /\t[^\t]+\t[^\t]+\t/,
    /(\d+\s+){3,}/,
  ];

  return tablePatterns.some((pattern) => pattern.test(text));
}

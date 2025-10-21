// Smart chunking strategies for document processing
import type { ChunkingOptions, DocumentChunk, DocumentPage } from "./types.ts";

/**
 * Chunks document pages using the specified strategy.
 *
 * Main entry point for document chunking. Routes to the appropriate chunking
 * strategy (paragraph, sentence, or section-based) based on the options provided.
 *
 * @param pages Array of document pages to chunk
 * @param options Chunking configuration including strategy, size limits, and overlap
 * @returns Array of DocumentChunk objects with content, metadata, and navigation links
 *
 * @example
 * ```ts
 * const chunks = chunkDocumentPages(pages, {
 *   strategy: "paragraph",
 *   maxChunkSize: 1000,
 *   overlap: 200
 * });
 * ```
 */
export function chunkDocumentPages(
  pages: DocumentPage[],
  options: ChunkingOptions,
): DocumentChunk[] {
  switch (options.strategy) {
    case "paragraph":
      return chunkByParagraphs(pages, options);
    case "sentence":
      return chunkBySentences(pages, options);
    case "section":
      return chunkBySections(pages, options);
    default:
      return chunkByParagraphs(pages, options);
  }
}

/**
 * Chunks document by paragraphs with configurable size and overlap.
 *
 * Splits text at paragraph boundaries (double newlines) while respecting
 * maximum chunk size limits. Includes overlapping text between chunks for
 * better context preservation.
 *
 * @param pages Array of document pages to chunk
 * @param options Chunking configuration with size limits and overlap
 * @returns Array of paragraph-based chunks with page tracking
 */
export function chunkByParagraphs(
  pages: DocumentPage[],
  options: ChunkingOptions,
): DocumentChunk[] {
  const chunks: DocumentChunk[] = [];
  let currentChunk = "";
  let currentPageNumber = pages[0]?.pageNumber || 1;
  let startPage = currentPageNumber;
  let charStart = 0;

  for (const page of pages) {
    const paragraphs = page.text.split(/\n\n+/).filter((p) => p.trim().length > 0);

    for (const para of paragraphs) {
      const trimmedPara = para.trim();

      if (
        currentChunk.length + trimmedPara.length + 2 > options.maxChunkSize &&
        currentChunk.length > options.minChunkSize!
      ) {
        chunks.push(
          createChunk(currentChunk, startPage, currentPageNumber, charStart, chunks.length),
        );

        const overlapText = getOverlapText(currentChunk, options.overlap);
        currentChunk = overlapText + trimmedPara;
        startPage = page.pageNumber;
        charStart += currentChunk.length - overlapText.length;
      } else {
        currentChunk += (currentChunk ? "\n\n" : "") + trimmedPara;
        currentPageNumber = page.pageNumber;
      }
    }
  }

  if (currentChunk.trim()) {
    chunks.push(createChunk(currentChunk, startPage, currentPageNumber, charStart, chunks.length));
  }

  linkChunks(chunks);

  return chunks;
}

/**
 * Chunks document by sentences for fine-grained control.
 *
 * Splits text at sentence boundaries (periods, exclamation marks, question marks)
 * while maintaining chunk size limits. Best for documents requiring precise chunking.
 *
 * @param pages Array of document pages to chunk
 * @param options Chunking configuration with size limits and overlap
 * @returns Array of sentence-based chunks with page tracking
 */
export function chunkBySentences(
  pages: DocumentPage[],
  options: ChunkingOptions,
): DocumentChunk[] {
  const chunks: DocumentChunk[] = [];
  let currentChunk = "";
  let currentPageNumber = pages[0]?.pageNumber || 1;
  let startPage = currentPageNumber;
  let charStart = 0;

  for (const page of pages) {
    const sentences = page.text.split(/(?<=[.!?])\s+/).filter((s) => s.trim().length > 0);

    for (const sentence of sentences) {
      const trimmedSentence = sentence.trim();

      if (
        currentChunk.length + trimmedSentence.length + 1 > options.maxChunkSize &&
        currentChunk.length > options.minChunkSize!
      ) {
        chunks.push(
          createChunk(currentChunk, startPage, currentPageNumber, charStart, chunks.length),
        );

        const overlapText = getOverlapText(currentChunk, options.overlap);
        currentChunk = overlapText + trimmedSentence;
        startPage = page.pageNumber;
        charStart += currentChunk.length - overlapText.length;
      } else {
        currentChunk += (currentChunk ? " " : "") + trimmedSentence;
        currentPageNumber = page.pageNumber;
      }
    }
  }

  if (currentChunk.trim()) {
    chunks.push(createChunk(currentChunk, startPage, currentPageNumber, charStart, chunks.length));
  }

  linkChunks(chunks);

  return chunks;
}

/**
 * Chunks document by detected sections and headings.
 *
 * Uses page section metadata to create semantically meaningful chunks that
 * respect document structure. Falls back to paragraph chunking if no sections
 * are detected.
 *
 * @param pages Array of document pages with section metadata
 * @param options Chunking configuration with size limits and overlap
 * @returns Array of section-based chunks preserving document hierarchy
 */
export function chunkBySections(
  pages: DocumentPage[],
  options: ChunkingOptions,
): DocumentChunk[] {
  const chunks: DocumentChunk[] = [];

  for (const page of pages) {
    if (page.sections && page.sections.length > 0) {
      for (const section of page.sections) {
        if (section.content.length > options.maxChunkSize) {
          const subChunks = chunkByParagraphs([{
            pageNumber: page.pageNumber,
            text: section.content,
            sections: [],
          }], options);

          subChunks.forEach((chunk) => {
            chunk.section = section.title;
            chunk.heading = section.title;
            chunks.push(chunk);
          });
        } else {
          chunks.push({
            id: `chunk_${chunks.length}`,
            content: section.content,
            pageNumber: page.pageNumber,
            section: section.title,
            heading: section.title,
            chunkIndex: chunks.length,
            totalChunks: 0,
            charStart: section.startChar,
            charEnd: section.endChar,
          });
        }
      }
    } else {
      const pageChunks = chunkByParagraphs([page], options);
      chunks.push(...pageChunks);
    }
  }

  chunks.forEach((chunk, idx) => {
    chunk.chunkIndex = idx;
    chunk.totalChunks = chunks.length;
  });

  linkChunks(chunks);

  return chunks;
}

function createChunk(
  content: string,
  startPage: number,
  endPage: number,
  charStart: number,
  index: number,
): DocumentChunk {
  return {
    id: `chunk_${index}`,
    content: content.trim(),
    pageNumber: startPage,
    startPage,
    endPage,
    chunkIndex: index,
    totalChunks: 0,
    charStart,
    charEnd: charStart + content.length,
  };
}

function getOverlapText(text: string, overlapSize: number): string {
  if (text.length <= overlapSize) return text;

  const overlapText = text.slice(-overlapSize);

  const sentenceEnd = overlapText.lastIndexOf(". ");
  if (sentenceEnd > overlapSize / 2) {
    return overlapText.slice(sentenceEnd + 2);
  }

  return overlapText;
}

function linkChunks(chunks: DocumentChunk[]): void {
  chunks.forEach((chunk, idx) => {
    chunk.totalChunks = chunks.length;
    if (idx > 0) {
      chunk.previousChunkId = chunks[idx - 1].id;
    }
    if (idx < chunks.length - 1) {
      chunk.nextChunkId = chunks[idx + 1].id;
    }
  });
}

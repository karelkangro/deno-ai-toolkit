// Document processing module exports

export * from "./types.ts";
export * from "./processor.ts";
export * from "./pdf-extractor.ts";
export * from "./pdfjs-extractor.ts";
export * from "./chunking.ts";
export * from "./estonian-legal.ts";
export * from "./formatter.ts";

export { extractDocumentMetadata, extractDocumentText, processLegalDocument } from "./processor.ts";

export {
  chunkByParagraphs,
  chunkBySections,
  chunkBySentences,
  chunkDocumentPages,
} from "./chunking.ts";

export {
  buildSectionHierarchy,
  detectLegalKeywords,
  detectSectionNumbers,
  detectStandardReferences,
  enrichChunksWithLegalContext,
} from "./estonian-legal.ts";

export {
  extractCitationFromMetadata,
  formatCitation,
  formatCitationCompact,
  formatCitationMarkdown,
} from "./formatter.ts";

export { extractPDFContent, extractTextOnly } from "./pdf-extractor.ts";
export { extractPDFContentWithPdfjs, extractTextOnlyWithPdfjs } from "./pdfjs-extractor.ts";

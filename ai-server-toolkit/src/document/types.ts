// Document processing types for legal and regulatory documents

export interface ProcessedDocument {
  pages: DocumentPage[];
  metadata: DocumentMetadata;
  structure: DocumentStructure;
}

export interface DocumentPage {
  pageNumber: number;
  text: string;
  sections: DocumentSection[];
  hasTable?: boolean;
  hasImage?: boolean;
}

export interface DocumentSection {
  level: number;
  title: string;
  content: string;
  pageNumber: number;
  startChar: number;
  endChar: number;
}

export interface DocumentMetadata {
  title?: string;
  author?: string;
  subject?: string;
  keywords?: string[];
  creationDate?: string;
  modificationDate?: string;
  pageCount: number;
  language?: string;
  producer?: string;
  creator?: string;
}

export interface DocumentStructure {
  sections: HierarchicalSection[];
  standardReferences: StandardReference[];
  legalKeywords: string[];
}

export interface HierarchicalSection {
  id: string;
  level: number;
  number?: string;
  title: string;
  pageNumber: number;
  children: HierarchicalSection[];
}

export interface StandardReference {
  standard: string;
  year?: string;
  title?: string;
  page: number;
  fullReference: string;
}

export interface DocumentChunk {
  id: string;
  content: string;
  pageNumber: number;
  startPage?: number;
  endPage?: number;
  section?: string;
  heading?: string;
  chunkIndex: number;
  totalChunks: number;
  charStart: number;
  charEnd: number;
  previousChunkId?: string;
  nextChunkId?: string;
  standardReferences?: string[];
  legalKeywords?: string[];
}

export type ChunkingStrategy = "sentence" | "paragraph" | "section" | "semantic";

export interface ChunkingOptions {
  strategy: ChunkingStrategy;
  maxChunkSize: number;
  overlap: number;
  preserveStructure: boolean;
  language: "et" | "en";
  minChunkSize?: number;
}

export interface CitationInfo {
  documentName: string;
  pageNumber?: number;
  section?: string;
  heading?: string;
  chunkIndex?: number;
  totalChunks?: number;
  standardReferences?: string[];
}

export const DEFAULT_CHUNKING_OPTIONS: ChunkingOptions = {
  strategy: "paragraph",
  maxChunkSize: 1000,
  overlap: 200,
  preserveStructure: true,
  language: "et",
  minChunkSize: 100,
};

export interface PDFInfo {
  Title?: string;
  Author?: string;
  Subject?: string;
  Creator?: string;
  Producer?: string;
  CreationDate?: string;
  ModDate?: string;
  [key: string]: string | undefined;
}

export interface PDFParseResult {
  text: string;
  numpages?: number;
  numPages?: number;
  info?: PDFInfo;
}

export interface PDFParseOptions {
  data: Uint8Array;
  first?: number;
  last?: number;
}

export interface PDFParser {
  getText(options?: { first?: number; last?: number }): Promise<PDFParseResult>;
  destroy(): Promise<void>;
}

export interface PDFParseConstructor {
  new (options: PDFParseOptions): PDFParser;
}

declare const PDFParse: PDFParseConstructor;
export default PDFParse;

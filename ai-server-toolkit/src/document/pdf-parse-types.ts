export interface PDFInfo {
  Title?: string;
  Author?: string;
  Subject?: string;
  Creator?: string;
  Producer?: string;
  CreationDate?: string;
  ModDate?: string;
  Keywords?: string;
  [key: string]: string | undefined;
}

export interface PDFParseResult {
  text: string;
  info?: PDFInfo;
  numpages?: number;
  numPages?: number;
  metadata?: Record<string, unknown>;
}

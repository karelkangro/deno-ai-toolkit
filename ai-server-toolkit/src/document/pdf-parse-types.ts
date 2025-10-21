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

declare module "pdf-parse" {
  export interface TextResult {
    text: string;
    numpages?: number;
    numPages?: number;
    info?: PDFInfo;
  }
}

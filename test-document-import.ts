// Test importing document processing functions
import {
  extractDocumentMetadata,
  extractDocumentText,
  extractPDFContent,
  processLegalDocument,
} from "./ai-server-toolkit/mod.ts";

console.log("✅ Document functions imported successfully:");
console.log("- extractDocumentMetadata:", typeof extractDocumentMetadata);
console.log("- extractDocumentText:", typeof extractDocumentText);
console.log("- extractPDFContent:", typeof extractPDFContent);
console.log("- processLegalDocument:", typeof processLegalDocument);

console.log("\n✅ All imports successful - no TypeScript errors!");

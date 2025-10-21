// Test pdf-parse import with Deno
import { PDFParse } from "npm:pdf-parse@2.4.3";

console.log("PDFParse imported:", typeof PDFParse);
console.log("PDFParse:", PDFParse);

// Test with dummy data
const testPDF = new Uint8Array([0x25, 0x50, 0x44, 0x46]); // %PDF header

try {
  const parser = new PDFParse({ data: testPDF });
  console.log("Parser created:", parser);
  console.log("Parser methods:", Object.getOwnPropertyNames(Object.getPrototypeOf(parser)));
} catch (error) {
  console.log("Error creating parser:", error instanceof Error ? error.message : String(error));
}

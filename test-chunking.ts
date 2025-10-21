import { extractPDFContent } from "./ai-server-toolkit/src/document/pdf-extractor.ts";
import { chunkDocumentPages } from "./ai-server-toolkit/src/document/chunking.ts";
import type { ChunkingOptions } from "./ai-server-toolkit/src/document/types.ts";

const testChunking = async () => {
  const pdfPath = "/Users/leon/Learn/sirkelmall/nihik/knowledge-base/EK/EK_EVS_EN_338_2016_et_ehituspuit.Tugevusklassid.pdf";

  console.log("=".repeat(80));
  console.log("PDF CHUNKING TEST");
  console.log("=".repeat(80));
  console.log(`\nTesting file: ${pdfPath}`);

  try {
    const fileData = await Deno.readFile(pdfPath);
    console.log(`\n✓ File loaded: ${fileData.length} bytes`);

    const document = await extractPDFContent(fileData);
    console.log(`✓ PDF extracted: ${document.pages.length} pages`);

    console.log("\n" + "=".repeat(80));
    console.log("DOCUMENT METADATA");
    console.log("=".repeat(80));
    console.log(JSON.stringify(document.metadata, null, 2));

    console.log("\n" + "=".repeat(80));
    console.log("PAGE PREVIEW");
    console.log("=".repeat(80));
    document.pages.slice(0, 3).forEach((page) => {
      console.log(`\nPage ${page.pageNumber}:`);
      console.log(`  Length: ${page.text.length} chars`);
      console.log(`  Has table: ${page.hasTable}`);
      console.log(`  Preview: ${page.text.substring(0, 150)}...`);
    });

    const strategies: Array<{ name: string; options: ChunkingOptions }> = [
      {
        name: "Paragraph (1000/200)",
        options: {
          strategy: "paragraph",
          maxChunkSize: 1000,
          overlap: 200,
          preserveStructure: true,
          language: "et",
          minChunkSize: 100,
        },
      },
      {
        name: "Paragraph (500/100)",
        options: {
          strategy: "paragraph",
          maxChunkSize: 500,
          overlap: 100,
          preserveStructure: true,
          language: "et",
          minChunkSize: 50,
        },
      },
      {
        name: "Sentence (800/150)",
        options: {
          strategy: "sentence",
          maxChunkSize: 800,
          overlap: 150,
          preserveStructure: true,
          language: "et",
          minChunkSize: 100,
        },
      },
      {
        name: "Section-based",
        options: {
          strategy: "section",
          maxChunkSize: 1500,
          overlap: 200,
          preserveStructure: true,
          language: "et",
          minChunkSize: 100,
        },
      },
    ];

    for (const { name, options } of strategies) {
      console.log("\n" + "=".repeat(80));
      console.log(`CHUNKING STRATEGY: ${name}`);
      console.log("=".repeat(80));

      const chunks = chunkDocumentPages(document.pages, options);

      console.log(`\nTotal chunks: ${chunks.length}`);
      console.log(`Strategy: ${options.strategy}`);
      console.log(`Max size: ${options.maxChunkSize} chars`);
      console.log(`Overlap: ${options.overlap} chars`);

      const chunkSizes = chunks.map(c => c.content.length);
      const avgSize = chunkSizes.reduce((a, b) => a + b, 0) / chunks.length;
      const minSize = Math.min(...chunkSizes);
      const maxSize = Math.max(...chunkSizes);

      console.log(`\nChunk sizes:`);
      console.log(`  Average: ${avgSize.toFixed(0)} chars`);
      console.log(`  Min: ${minSize} chars`);
      console.log(`  Max: ${maxSize} chars`);

      console.log(`\nFirst 3 chunks:`);
      chunks.slice(0, 3).forEach((chunk, idx) => {
        console.log(`\n--- Chunk ${idx + 1} (ID: ${chunk.id}) ---`);
        console.log(`Page: ${chunk.pageNumber}${chunk.startPage ? ` (${chunk.startPage}-${chunk.endPage})` : ""}`);
        console.log(`Size: ${chunk.content.length} chars`);
        console.log(`Index: ${chunk.chunkIndex + 1}/${chunk.totalChunks}`);
        console.log(`Char range: ${chunk.charStart}-${chunk.charEnd}`);
        if (chunk.section) console.log(`Section: ${chunk.section}`);
        if (chunk.heading) console.log(`Heading: ${chunk.heading}`);
        if (chunk.previousChunkId) console.log(`Previous: ${chunk.previousChunkId}`);
        if (chunk.nextChunkId) console.log(`Next: ${chunk.nextChunkId}`);
        console.log(`\nContent preview (first 200 chars):`);
        console.log(chunk.content.substring(0, 200) + "...");
      });

      if (chunks.length > 3) {
        console.log(`\n... (${chunks.length - 3} more chunks) ...`);

        const lastChunk = chunks[chunks.length - 1];
        console.log(`\n--- Last Chunk (ID: ${lastChunk.id}) ---`);
        console.log(`Page: ${lastChunk.pageNumber}${lastChunk.startPage ? ` (${lastChunk.startPage}-${lastChunk.endPage})` : ""}`);
        console.log(`Size: ${lastChunk.content.length} chars`);
        console.log(`Index: ${lastChunk.chunkIndex + 1}/${lastChunk.totalChunks}`);
        console.log(`\nContent preview (first 200 chars):`);
        console.log(lastChunk.content.substring(0, 200) + "...");
      }
    }

    console.log("\n" + "=".repeat(80));
    console.log("✓ ALL TESTS COMPLETED SUCCESSFULLY");
    console.log("=".repeat(80));

  } catch (error) {
    console.error("\n❌ ERROR:", error);
    throw error;
  }
};

if (import.meta.main) {
  await testChunking();
}


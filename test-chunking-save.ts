import { extractPDFContent } from "./ai-server-toolkit/src/document/pdf-extractor.ts";
import { chunkDocumentPages } from "./ai-server-toolkit/src/document/chunking.ts";
import type { ChunkingOptions } from "./ai-server-toolkit/src/document/types.ts";

const testChunkingAndSave = async () => {
  const pdfPath = "/Users/leon/Learn/sirkelmall/nihik/knowledge-base/EK/EK_EVS_EN_338_2016_et_ehituspuit.Tugevusklassid.pdf";

  console.log("=".repeat(80));
  console.log("PDF CHUNKING TEST - SAVING CHUNKS TO FILES");
  console.log("=".repeat(80));
  console.log(`\nTesting file: ${pdfPath}`);

  try {
    const fileData = await Deno.readFile(pdfPath);
    console.log(`\n✓ File loaded: ${fileData.length} bytes`);

    const document = await extractPDFContent(fileData);
    console.log(`✓ PDF extracted: ${document.pages.length} pages`);

    const outputBaseDir = "./chunks-output";
    await Deno.mkdir(outputBaseDir, { recursive: true });
    console.log(`✓ Created output directory: ${outputBaseDir}`);

    const strategies: Array<{ name: string; dirName: string; options: ChunkingOptions }> = [
      {
        name: "Paragraph (1000/200)",
        dirName: "paragraph-1000-200",
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
        dirName: "paragraph-500-100",
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
        dirName: "sentence-800-150",
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
        dirName: "section-based",
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

    for (const { name, dirName, options } of strategies) {
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

      const strategyDir = `${outputBaseDir}/${dirName}`;
      await Deno.mkdir(strategyDir, { recursive: true });

      const summaryLines = [
        `Chunking Strategy: ${name}`,
        `Strategy: ${options.strategy}`,
        `Max Chunk Size: ${options.maxChunkSize} chars`,
        `Overlap: ${options.overlap} chars`,
        `Min Chunk Size: ${options.minChunkSize} chars`,
        "",
        `Total Chunks: ${chunks.length}`,
        `Average Size: ${avgSize.toFixed(0)} chars`,
        `Min Size: ${minSize} chars`,
        `Max Size: ${maxSize} chars`,
        "",
        "=".repeat(80),
        "CHUNKS:",
        "=".repeat(80),
        "",
      ];

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const paddedIndex = String(i + 1).padStart(3, "0");
        const fileName = `chunk-${paddedIndex}.txt`;
        const filePath = `${strategyDir}/${fileName}`;

        const metadata = [
          `Chunk ID: ${chunk.id}`,
          `Chunk Index: ${chunk.chunkIndex + 1}/${chunk.totalChunks}`,
          `Page: ${chunk.pageNumber}${chunk.startPage ? ` (${chunk.startPage}-${chunk.endPage})` : ""}`,
          `Size: ${chunk.content.length} chars`,
          `Char Range: ${chunk.charStart}-${chunk.charEnd}`,
        ];

        if (chunk.section) metadata.push(`Section: ${chunk.section}`);
        if (chunk.heading) metadata.push(`Heading: ${chunk.heading}`);
        if (chunk.previousChunkId) metadata.push(`Previous: ${chunk.previousChunkId}`);
        if (chunk.nextChunkId) metadata.push(`Next: ${chunk.nextChunkId}`);

        const fileContent = [
          "=".repeat(80),
          ...metadata,
          "=".repeat(80),
          "",
          chunk.content,
          "",
        ].join("\n");

        await Deno.writeTextFile(filePath, fileContent);

        summaryLines.push(`${fileName} - ${chunk.content.length} chars - Page ${chunk.pageNumber}`);
      }

      await Deno.writeTextFile(`${strategyDir}/_SUMMARY.txt`, summaryLines.join("\n"));

      console.log(`\n✓ Saved ${chunks.length} chunks to ${strategyDir}/`);
      console.log(`✓ Summary saved to ${strategyDir}/_SUMMARY.txt`);
    }

    const indexContent = [
      "PDF CHUNKING TEST RESULTS",
      "=".repeat(80),
      "",
      `Source PDF: ${pdfPath}`,
      `PDF Size: ${fileData.length} bytes`,
      `Pages Extracted: ${document.pages.length}`,
      `Total Text Length: ${document.pages.reduce((sum, p) => sum + p.text.length, 0)} chars`,
      "",
      "Document Metadata:",
      document.metadata.title ? `  Title: ${document.metadata.title}` : "",
      document.metadata.author ? `  Author: ${document.metadata.author}` : "",
      document.metadata.subject ? `  Subject: ${document.metadata.subject}` : "",
      `  Page Count: ${document.metadata.pageCount}`,
      "",
      "=".repeat(80),
      "CHUNKING STRATEGIES:",
      "=".repeat(80),
      "",
      ...strategies.map(({ name, dirName }) => `- ${name}: ./${dirName}/`),
      "",
      "Each directory contains:",
      "  - Individual chunk files (chunk-001.txt, chunk-002.txt, etc.)",
      "  - _SUMMARY.txt with overview of all chunks",
      "",
    ].filter(line => line !== "").join("\n");

    await Deno.writeTextFile(`${outputBaseDir}/INDEX.txt`, indexContent);

    console.log("\n" + "=".repeat(80));
    console.log("✓ ALL TESTS COMPLETED SUCCESSFULLY");
    console.log("=".repeat(80));
    console.log(`\nAll chunks saved to: ${outputBaseDir}/`);
    console.log(`See INDEX.txt for overview`);

  } catch (error) {
    console.error("\n❌ ERROR:", error);
    throw error;
  }
};

if (import.meta.main) {
  await testChunkingAndSave();
}


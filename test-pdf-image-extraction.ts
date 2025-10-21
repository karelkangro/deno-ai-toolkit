import { Buffer } from "node:buffer";
import { PDFParse } from "pdf-parse";

const testImageExtraction = async () => {
  console.log("=".repeat(80));
  console.log("PDF IMAGE EXTRACTION TEST");
  console.log("=".repeat(80));

  try {
    console.log("\n--- Test 1: Remote PDF with URL ---");
    const link = new URL("https://mehmet-kozan.github.io/pdf-parse/pdf/image-test.pdf");
    console.log(`URL: ${link}`);

    const parser1 = new PDFParse({ url: link });
    const result1 = await parser1.getImage();
    console.log(`✓ Images extracted: ${result1.pages.length} pages`);

    result1.pages.forEach((page, idx) => {
      console.log(`  Page ${idx + 1}: ${page.images.length} images`);
      page.images.forEach((img, imgIdx) => {
        console.log(
          `    Image ${imgIdx + 1}: ${img.data.length} bytes`,
        );
      });
    });

    if (result1.pages[0]?.images[0]) {
      const imageData = result1.pages[0].images[0].data;
      await Deno.writeFile("./test-adobe.png", imageData);
      console.log(`\n✓ Saved first image to: ./test-adobe.png`);
    }

    await parser1.destroy();
    console.log("✓ Parser destroyed");
  } catch (error) {
    console.error("❌ Remote PDF test failed:", error);
  }

  try {
    console.log("\n" + "=".repeat(80));
    console.log("--- Test 2: Local Estonian PDF ---");
    const pdfPath =
      "/Users/leon/Learn/sirkelmall/nihik/knowledge-base/EK/EK_EVS_EN_338_2016_et_ehituspuit.Tugevusklassid.pdf";
    console.log(`File: ${pdfPath}`);

    const fileData = await Deno.readFile(pdfPath);
    console.log(`✓ File loaded: ${fileData.length} bytes`);

    const buffer = Buffer.from(fileData);
    const parser2 = new PDFParse({ data: buffer });

    console.log("\nExtracting images...");
    const result2 = await parser2.getImage();
    console.log(`✓ Images extracted from ${result2.pages.length} pages`);

    let totalImages = 0;
    result2.pages.forEach((page, idx) => {
      const imageCount = page.images.length;
      totalImages += imageCount;
      if (imageCount > 0) {
        console.log(`  Page ${idx + 1}: ${imageCount} images`);
        page.images.forEach((img, imgIdx) => {
          console.log(`    Image ${imgIdx + 1}: ${img.data.length} bytes`);
          console.log(`      Width: ${img.width || "unknown"}, Height: ${img.height || "unknown"}`);
        });
      }
    });

    console.log(`\nTotal images found: ${totalImages}`);

    if (totalImages > 0) {
      console.log("\nSaving images...");
      let savedCount = 0;
      for (let pageIdx = 0; pageIdx < result2.pages.length; pageIdx++) {
        const page = result2.pages[pageIdx];
        for (let imgIdx = 0; imgIdx < page.images.length; imgIdx++) {
          const img = page.images[imgIdx];
          const filename = `./estonian-pdf-page${pageIdx + 1}-img${imgIdx + 1}.png`;
          await Deno.writeFile(filename, img.data);
          console.log(`  ✓ Saved: ${filename}`);
          savedCount++;
        }
      }
      console.log(`\n✓ Saved ${savedCount} images`);
    } else {
      console.log("\nNo images found in the PDF");
    }

    await parser2.destroy();
    console.log("✓ Parser destroyed");
  } catch (error) {
    console.error("❌ Local PDF test failed:", error);
  }

  try {
    console.log("\n" + "=".repeat(80));
    console.log("--- Test 3: Compare getText vs getImage ---");
    const pdfPath =
      "/Users/leon/Learn/sirkelmall/nihik/knowledge-base/EK/EK_EVS_EN_338_2016_et_ehituspuit.Tugevusklassid.pdf";

    const fileData = await Deno.readFile(pdfPath);
    const buffer = Buffer.from(fileData);

    const parser3 = new PDFParse({ data: buffer });
    const textResult = await parser3.getText() as any;
    console.log(`Text extraction: ${textResult.text.length} chars, ${textResult.numpages} pages`);

    const imageResult = await parser3.getImage();
    console.log(`Image extraction: ${imageResult.pages.length} pages`);

    await parser3.destroy();
    console.log("✓ Comparison complete");
  } catch (error) {
    console.error("❌ Comparison test failed:", error);
  }

  console.log("\n" + "=".repeat(80));
  console.log("✓ ALL TESTS COMPLETED");
  console.log("=".repeat(80));
};

if (import.meta.main) {
  await testImageExtraction();
}

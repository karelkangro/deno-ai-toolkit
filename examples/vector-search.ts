// Vector Search Example
// Demonstrates pure vector search capabilities without AI agents

import { createVectorSearchSystem } from "../ai-server-toolkit/mod.ts";

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

if (!OPENAI_API_KEY) {
  console.error("❌ Please set OPENAI_API_KEY environment variable");
  Deno.exit(1);
}

async function main() {
  console.log("🚀 Setting up vector search system...");

  try {
    // Create a vector search system (no LLM needed)
    const vectorSystem = await createVectorSearchSystem({
      lancedbPath: "./examples/vector-search-db",
      openaiApiKey: OPENAI_API_KEY,
    });

    console.log("✅ Vector search system initialized");

    // Add sample documents about programming languages
    console.log("📚 Adding programming language documents...");

    const documents = [
      {
        id: "python",
        content:
          "Python is a high-level, interpreted programming language known for its simplicity and readability. It's widely used in data science, machine learning, and web development.",
        metadata: {
          category: "programming",
          type: "interpreted",
          year: "1991",
        },
      },
      {
        id: "javascript",
        content:
          "JavaScript is a dynamic programming language primarily used for web development. It runs in browsers and on servers with Node.js.",
        metadata: {
          category: "programming",
          type: "interpreted",
          year: "1995",
        },
      },
      {
        id: "rust",
        content:
          "Rust is a systems programming language focused on safety, speed, and concurrency. It prevents memory errors and data races at compile time.",
        metadata: { category: "programming", type: "compiled", year: "2010" },
      },
      {
        id: "go",
        content:
          "Go is a statically typed, compiled programming language designed for simplicity and efficiency. It's excellent for concurrent programming and cloud services.",
        metadata: { category: "programming", type: "compiled", year: "2009" },
      },
      {
        id: "typescript",
        content:
          "TypeScript is a superset of JavaScript that adds static type definitions. It compiles to plain JavaScript and helps catch errors during development.",
        metadata: { category: "programming", type: "transpiled", year: "2012" },
      },
      {
        id: "deno",
        content:
          "Deno is a runtime for JavaScript and TypeScript built with security in mind. It requires explicit permissions and has built-in tooling.",
        metadata: { category: "runtime", type: "platform", year: "2020" },
      },
    ];

    await vectorSystem.addDocuments(documents);
    console.log(`✅ Added ${documents.length} documents to vector database`);

    // Test various search queries
    const searchQueries = [
      {
        query: "safe memory management programming",
        description: "Looking for languages with memory safety",
      },
      {
        query: "web development browser scripting",
        description: "Looking for web technologies",
      },
      {
        query: "concurrent programming parallel processing",
        description: "Looking for concurrency features",
      },
      {
        query: "compiled languages performance speed",
        description: "Looking for compiled languages",
      },
      {
        query: "type checking static analysis",
        description: "Looking for type safety features",
      },
    ];

    console.log("\n🔍 Testing semantic search queries...\n");

    for (const { query, description } of searchQueries) {
      console.log(`📝 ${description}`);
      console.log(`🔍 Query: "${query}"`);

      const results = await vectorSystem.search(query, {
        limit: 3,
        threshold: 0.7, // Only show results with high similarity
      });

      if (results.length > 0) {
        console.log(`✅ Found ${results.length} relevant results:`);
        results.forEach((result, index) => {
          console.log(
            `   ${index + 1}. ${result.id} (similarity: ${
              result.score.toFixed(3)
            })`,
          );
          console.log(
            `      ${result.metadata?.type} language from ${result.metadata?.year}`,
          );
          console.log(`      ${result.content.slice(0, 80)}...`);
        });
      } else {
        console.log("❌ No results found above similarity threshold");
      }

      console.log("─".repeat(60));
    }

    // Test filtering by metadata
    console.log("\n🏷️ Testing metadata filtering...");

    const filteredResults = await vectorSystem.search("programming language", {
      limit: 5,
      filter: { type: "compiled" },
    });

    console.log(`Found ${filteredResults.length} compiled languages:`);
    filteredResults.forEach((result) => {
      console.log(
        `• ${result.id} (${result.metadata?.year}): ${
          result.content.slice(0, 60)
        }...`,
      );
    });

    // Get vector database statistics
    const stats = await vectorSystem.vectorStore.getStats();
    console.log("\n📊 Database Statistics:");
    console.log(`• Total documents: ${stats.totalDocuments}`);
    console.log(`• Total size: ${Math.round(stats.totalSize / 1024)} KB`);
    console.log(`• Last updated: ${stats.lastUpdated.toLocaleString()}`);

    console.log("\n🎉 Vector search demo completed successfully!");
  } catch (error) {
    console.error("❌ Error:", error);
    Deno.exit(1);
  }
}

if (import.meta.main) {
  main();
}

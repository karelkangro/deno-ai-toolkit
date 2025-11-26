// Basic RAG (Retrieval-Augmented Generation) Example
// Demonstrates how to set up a simple question-answering system with document search

import { createRAGSystem, type SearchResult } from "../ai-server-toolkit/mod.ts";

// Set up environment variables
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
const CLAUDE_API_KEY = Deno.env.get("CLAUDE_API_KEY");

if (!OPENAI_API_KEY || !CLAUDE_API_KEY) {
  console.error(
    "❌ Please set OPENAI_API_KEY and CLAUDE_API_KEY environment variables",
  );
  Deno.exit(1);
}

async function main() {
  console.log("🚀 Setting up RAG system...");

  try {
    // Create a RAG system with vector search and AI agent
    const ragSystem = await createRAGSystem({
      lancedbPath: "./examples/vector-db",
      openaiApiKey: OPENAI_API_KEY || "",
      claudeApiKey: CLAUDE_API_KEY || "",
      systemPrompt:
        `You are a helpful assistant that can search through documents to answer questions.
Always search for relevant information before answering questions. Be specific and cite your sources.`,
    });

    console.log("✅ RAG system initialized");

    // Add some sample documents
    console.log("📚 Adding sample documents...");
    await ragSystem.addDocuments([
      {
        id: "deno-intro",
        content:
          "Deno is a modern runtime for JavaScript and TypeScript that is secure by default. It requires explicit permissions for file, network, and environment access.",
        metadata: { category: "technology", source: "documentation" },
      },
      {
        id: "deno-features",
        content:
          "Deno features built-in TypeScript support, ES modules, a built-in test runner, code formatter, and linter. It also has a standard library.",
        metadata: { category: "technology", source: "documentation" },
      },
      {
        id: "vector-db",
        content:
          "Vector databases enable semantic search by storing high-dimensional vectors. They allow finding similar documents based on meaning rather than exact keyword matches.",
        metadata: { category: "technology", source: "documentation" },
      },
      {
        id: "ai-agents",
        content:
          "AI agents are autonomous programs that can use tools and make decisions. They can be chained together to create complex workflows and solve multi-step problems.",
        metadata: { category: "ai", source: "documentation" },
      },
    ]);

    console.log("✅ Documents added to vector database");

    // Test the RAG system with questions
    const questions = [
      "What is Deno?",
      "How do vector databases work?",
      "What are AI agents and how are they useful?",
      "What security features does Deno have?",
    ];

    console.log("\n🤖 Testing RAG system with questions...\n");

    for (const question of questions) {
      console.log(`\n❓ Question: ${question}`);
      console.log("⏳ Searching and generating answer...");

      const result = await ragSystem.ask(question);

      if (result.success) {
        console.log(`✅ Answer: ${result.content}`);

        if (result.usage) {
          console.log(`📊 Token usage: ${result.usage.totalTokens} total`);
        }
      } else {
        console.log(`❌ Error: ${result.error}`);
      }

      console.log("─".repeat(60));
    }

    // Test vector search directly
    console.log("\n🔍 Testing direct vector search...");
    const searchResults = await ragSystem.search(
      "JavaScript runtime security",
      {
        limit: 3,
      },
    );

    console.log(`Found ${searchResults.length} relevant documents:`);
    searchResults.forEach((result: SearchResult, index: number) => {
      console.log(
        `${index + 1}. ${result.id} (score: ${result.score.toFixed(3)})`,
      );
      console.log(`   ${result.content.slice(0, 100)}...`);
    });

    console.log("\n🎉 RAG system demo completed successfully!");
  } catch (error) {
    console.error("❌ Error:", error);
    Deno.exit(1);
  }
}

if (import.meta.main) {
  main();
}

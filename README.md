# 🤖 Deno AI Toolkit

A comprehensive **functional** toolkit for building AI-powered servers with Deno. Combines vector database operations with intelligent agent orchestration for creating sophisticated AI applications.

## ✨ Why This Toolkit?

Every AI-powered server needs these 3 core capabilities:
1. **🗄️ Vector Database Integration** - Store and search embeddings (LanceDB, Pinecone, etc.)
2. **🔍 Vector Operations** - Transform text to vectors, semantic search, CRUD operations
3. **🤖 AI Agent System** - Intelligent agents with LLM integration and tool usage

This toolkit provides all three in a **purely functional** architecture - **no classes, only functions and composition**.

## 🚀 Features

- **🦕 Deno-first** - Built specifically for Deno runtime
- **⚡ Functional Architecture** - Pure functions, no classes, easy composition
- **🔌 Plug-and-play** - Works with multiple providers (Claude, OpenAI, LanceDB)
- **🛠️ Built-in Tools** - Rate limiting, embeddings, vector search, agent orchestration
- **📦 Zero Config** - Sensible defaults, easy setup
- **🎯 TypeScript Native** - Fully typed interfaces throughout

## 📦 Installation

### Via deno.json (Recommended)
```json
{
  "imports": {
    "deno-ai-toolkit": "https://raw.githubusercontent.com/karelkangro/deno-ai-toolkit/v1.0.0/ai-server-toolkit/mod.ts"
  }
}
```

Then import in your code:
```typescript
import { createRAGSystem, createVectorSearchSystem } from "deno-ai-toolkit";
```

### Direct Import
```typescript
// Import specific version (recommended)
import { createRAGSystem, createVectorSearchSystem } from "https://raw.githubusercontent.com/karelkangro/deno-ai-toolkit/v1.0.0/ai-server-toolkit/mod.ts";

// Or latest (not recommended for production)
import { createRAGSystem, createVectorSearchSystem } from "https://raw.githubusercontent.com/karelkangro/deno-ai-toolkit/main/ai-server-toolkit/mod.ts";
```

### Version History
- **v1.0.0** - Initial release with functional architecture, Claude LLM, OpenAI embeddings, LanceDB, agents

## 🎯 Quick Start

### Basic RAG System
```typescript
import { createRAGSystem } from "./deno-ai-toolkit/ai-server-toolkit/mod.ts";

// Create a complete RAG system with 3 lines
const ragSystem = await createRAGSystem({
  lancedbPath: "./vector-db",
  openaiApiKey: Deno.env.get("OPENAI_API_KEY")!,
  claudeApiKey: Deno.env.get("CLAUDE_API_KEY")!,
});

// Add documents
await ragSystem.addDocuments([
  { id: "1", content: "Deno is a modern runtime for JavaScript and TypeScript." },
  { id: "2", content: "Vector databases enable semantic search capabilities." },
]);

// Ask questions with automatic RAG
const result = await ragSystem.ask("What is Deno?");
console.log(result.content);
```

### Vector Search Only
```typescript
import { createVectorSearchSystem } from "./deno-ai-toolkit/ai-server-toolkit/mod.ts";

const vectorSystem = await createVectorSearchSystem({
  lancedbPath: "./vectors",
  openaiApiKey: Deno.env.get("OPENAI_API_KEY")!,
});

// Search semantically
const results = await vectorSystem.search("modern JavaScript runtime", {
  limit: 5
});
```

### Custom AI Agent
```typescript
import {
  createAgent,
  createClaudeLLM,
  runAgent,
  createCalculatorTool,
  createWebSearchTool
} from "./deno-ai-toolkit/ai-server-toolkit/mod.ts";

const agent = createAgent({
  name: "math-assistant",
  description: "Helpful math assistant",
  systemPrompt: "You are a math expert. Use tools to help solve problems.",
  tools: [
    createCalculatorTool(),
    createWebSearchTool(),
  ],
  llm: {
    provider: 'claude',
    apiKey: Deno.env.get("CLAUDE_API_KEY")!,
  },
});

const result = await runAgent(agent, "Calculate 15% tip on $87.50");
console.log(result.content);
```

## 🏗️ Architecture

### Functional Composition
```typescript
// Everything is a function - no classes!
const embeddings = createOpenAIEmbeddings({ apiKey: "..." });
const vectorStore = await createLanceDB({ path: "./db" }, embeddings);
const llm = createClaudeLLM({ apiKey: "...", provider: 'claude' });

// Compose them functionally
const searchResults = await searchSimilar(vectorStore, "query");
const response = await generateResponse(llm, messages);
```

### Built-in Rate Limiting
```typescript
const rateLimiter = createRateLimiter({ requestsPerMinute: 50 });

await withRateLimit(rateLimiter, async () => {
  return await embedText(embeddings, "some text");
});
```

## 📁 Project Structure

```
deno-ai-toolkit/
├── ai-server-toolkit/           # Main toolkit
│   ├── src/
│   │   ├── types.ts            # All TypeScript interfaces
│   │   ├── embeddings/         # OpenAI embeddings (functional)
│   │   ├── vector-store/       # LanceDB integration (functional)
│   │   ├── llm/               # Claude LLM client (functional)
│   │   ├── agents/            # AI agents system (functional)
│   │   └── utils/             # Rate limiting, helpers
│   ├── mod.ts                 # Main exports
│   └── deno.json              # Deno configuration
├── examples/                   # Usage examples
├── tests/                     # Test files
└── README.md                  # This file
```

## 🔧 Development

```bash
# Check types
deno task check

# Format code
deno task fmt

# Lint code
deno task lint

# Run tests
deno task test

# Development mode
deno task dev
```

## 🌟 Core Modules

| Module | Purpose | Key Functions |
|--------|---------|---------------|
| **Vector Store** | Document storage & search | `createLanceDB`, `searchSimilar`, `addDocuments` |
| **Embeddings** | Text → Vector conversion | `createOpenAIEmbeddings`, `embedText`, `embedTexts` |
| **LLM** | AI text generation | `createClaudeLLM`, `generateResponse`, `streamResponse` |
| **Agents** | Intelligent AI assistants | `createAgent`, `runAgent`, `addTool` |
| **Utils** | Rate limiting, helpers | `createRateLimiter`, `withRateLimit` |

## 💡 Examples

See the `/examples` folder for complete working examples:
- `basic-rag.ts` - Simple RAG implementation
- `vector-search.ts` - Semantic search server
- `custom-agent.ts` - Multi-tool AI agent
- `streaming-chat.ts` - Streaming chat responses

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes (keep it functional!)
4. Add tests
5. Submit a pull request

## 📝 License

MIT License - see LICENSE file for details.

---

**Built with ❤️ for the Deno community**

*Pure functional AI toolkit - no classes, just composable functions.*
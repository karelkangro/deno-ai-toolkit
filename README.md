# 🤖 Deno AI Toolkit

A comprehensive **functional** toolkit for building AI-powered servers with
Deno. Combines vector database operations with intelligent agent orchestration
for creating sophisticated AI applications.

## ✨ Why This Toolkit?

Every AI-powered server needs these 3 core capabilities:

1. **🗄️ Vector Database Integration** - Store and search embeddings (LanceDB,
   Pinecone, etc.)
2. **🔍 Vector Operations** - Transform text to vectors, semantic search, CRUD
   operations
3. **🤖 AI Agent System** - Intelligent agents with LLM integration and tool
   usage

This toolkit provides all three in a **purely functional** architecture.

## 🚀 Features

- **🦕 Deno-first** - Built specifically for Deno runtime
- **⚡ Functional Architecture** - Pure functions, easy composition
- **🔌 Plug-and-play** - Works with multiple providers (Claude, OpenAI, LanceDB)
- **🛠️ Built-in Tools** - Rate limiting, embeddings, vector search, agent
  orchestration
- **📦 Zero Config** - Sensible defaults, easy setup
- **🎯 TypeScript Native** - Fully typed interfaces throughout

## 📦 Installation

### Via JSR (Recommended)

```json
{
  "imports": {
    "deno-ai-toolkit": "jsr:@karelkangro/deno-ai-toolkit@^1.1.0"
  }
}
```

Then import in your code:

```typescript
import { createRAGSystem, createVectorSearchSystem } from "deno-ai-toolkit";
```

### Direct JSR Import

```typescript
import {
  createRAGSystem,
  createVectorSearchSystem,
} from "jsr:@karelkangro/deno-ai-toolkit@^1.1.0";
```

### Version History

- **v1.2.0** - Added workspace isolation support, refactored to DRY principles,
  improved code quality
- **v1.1.0** - Added LanceDB Cloud support (cloud vector database)
- **v1.0.0** - Initial release with functional architecture, Claude LLM, OpenAI
  embeddings, LanceDB, agents

## 🎯 Quick Start

### Basic RAG System

```typescript
import { createRAGSystem } from "jsr:@karelkangro/deno-ai-toolkit";

// Create a complete RAG system with 3 lines
const ragSystem = await createRAGSystem({
  lancedbPath: "./vector-db",
  openaiApiKey: Deno.env.get("OPENAI_API_KEY")!,
  claudeApiKey: Deno.env.get("CLAUDE_API_KEY")!,
});

// Add documents
await ragSystem.addDocuments([
  {
    id: "1",
    content: "Deno is a modern runtime for JavaScript and TypeScript.",
  },
  { id: "2", content: "Vector databases enable semantic search capabilities." },
]);

// Ask questions with automatic RAG
const result = await ragSystem.ask("What is Deno?");
console.log(result.content);
```

### Vector Search Only

```typescript
import { createVectorSearchSystem } from "jsr:@karelkangro/deno-ai-toolkit";

const vectorSystem = await createVectorSearchSystem({
  lancedbPath: "./vectors",
  openaiApiKey: Deno.env.get("OPENAI_API_KEY")!,
});

// Search semantically
const results = await vectorSystem.search("modern JavaScript runtime", {
  limit: 5,
});
```

### Custom AI Agent

```typescript
import {
  createAgent,
  createCalculatorTool,
  createClaudeLLM,
  createWebSearchTool,
  runAgent,
} from "jsr:@karelkangro/deno-ai-toolkit";

const agent = createAgent({
  name: "math-assistant",
  description: "Helpful math assistant",
  systemPrompt: "You are a math expert. Use tools to help solve problems.",
  tools: [
    createCalculatorTool(),
    createWebSearchTool(),
  ],
  llm: {
    provider: "claude",
    apiKey: Deno.env.get("CLAUDE_API_KEY")!,
  },
});

const result = await runAgent(agent, "Calculate 15% tip on $87.50");
console.log(result.content);
```

### Workspace Isolation (NEW in v1.2.0)

```typescript
import {
  addWorkspaceDocument,
  createLanceDB,
  createWorkspaceTable,
  deleteWorkspaceTable,
  getWorkspaceStats,
  searchWorkspace,
} from "jsr:@karelkangro/deno-ai-toolkit";

// Initialize vector store
const vectorStore = await createLanceDB(
  {
    provider: "lancedb",
    path: "db://your-database-id", // or "./local-db" for local
    apiKey: Deno.env.get("LANCEDB_API_KEY"),
    region: "us-east-1",
  },
  {
    provider: "openai",
    apiKey: Deno.env.get("OPENAI_API_KEY")!,
  },
);

// Create isolated workspace
await createWorkspaceTable(vectorStore, "workspace_abc123");

// Add documents to workspace
await addWorkspaceDocument(vectorStore, "workspace_abc123", {
  id: "doc1",
  content: "Architecture guidelines for workspace ABC",
  metadata: {
    type: "rule",
    category: "architecture",
    severity: "high",
  },
});

// Search within workspace only
const results = await searchWorkspace(
  vectorStore,
  "workspace_abc123",
  "architecture guidelines",
  { limit: 5 },
);

// Get workspace statistics
const stats = await getWorkspaceStats(vectorStore, "workspace_abc123");
console.log(`Documents: ${stats.totalDocuments}`);

// Clean up workspace
await deleteWorkspaceTable(vectorStore, "workspace_abc123");
```

## 🏗️ Architecture

### Functional Composition

```typescript
// Everything is a function - no classes!
const embeddings = createOpenAIEmbeddings({ apiKey: "..." });
const vectorStore = await createLanceDB({ path: "./db" }, embeddings);
const llm = createClaudeLLM({ apiKey: "...", provider: "claude" });

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

| Module           | Purpose                   | Key Functions                                           |
| ---------------- | ------------------------- | ------------------------------------------------------- |
| **Vector Store** | Document storage & search | `createLanceDB`, `searchSimilar`, `addDocuments`        |
| **Embeddings**   | Text → Vector conversion  | `createOpenAIEmbeddings`, `embedText`, `embedTexts`     |
| **LLM**          | AI text generation        | `createClaudeLLM`, `generateResponse`, `streamResponse` |
| **Agents**       | Intelligent AI assistants | `createAgent`, `runAgent`, `addTool`                    |
| **Utils**        | Rate limiting, helpers    | `createRateLimiter`, `withRateLimit`                    |

## 💡 Examples

See the `/examples` folder for complete working examples:

- `basic-rag.ts` - Simple RAG implementation
- `vector-search.ts` - Semantic search server
- `custom-agent.ts` - Multi-tool AI agent
- `streaming-chat.ts` - Streaming chat responses

## 🏷️ Version Control & Releases

### Semantic Versioning

This project follows [Semantic Versioning](https://semver.org/):

- **MAJOR** version when you make incompatible API changes
- **MINOR** version when you add functionality in a backwards compatible manner
- **PATCH** version when you make backwards compatible bug fixes

### Creating a New Release

**1. Prepare the Release**

```bash
# Make sure you're on main and up to date
git checkout main
git pull origin main

# Update version in README.md (add to Version History section)
# Update CHANGELOG.md if you have one
```

**2. Create and Push the Tag**

```bash
# Create annotated tag with release notes
git tag -a v1.1.0 -m "Release v1.1.0: Add streaming support

Features:
- Add streaming response support for LLM calls
- Improve rate limiting with exponential backoff
- Add TypeScript strict mode support

Bug Fixes:
- Fix memory leak in vector search
- Resolve authentication timeout issues"

# Push the tag to GitHub
git push origin v1.1.0
```

**3. Create GitHub Release (Optional)**

```bash
# Using GitHub CLI (if installed)
gh release create v1.1.0 --title "v1.1.0: Streaming & Performance Improvements" --notes-from-tag

# Or create manually at: https://github.com/karelkangro/deno-ai-toolkit/releases
```

### Updating Consumer Projects

**In your main project's `deno.json`:**

```json
{
  "imports": {
    "deno-ai-toolkit": "https://raw.githubusercontent.com/karelkangro/deno-ai-toolkit/v1.1.0/ai-server-toolkit/mod.ts"
  }
}
```

**Version Update Workflow:**

```bash
# 1. Review changelog and breaking changes
# 2. Update deno.json to new version
# 3. Test your application
# 4. Update import version when ready
# 5. Commit the version bump
```

### Private Repository Considerations

For **private repositories**, you have several options:

**Option 1: Git Submodules (Recommended)**

```bash
# In your main project
git submodule add git@github.com:karelkangro/deno-ai-toolkit.git deno-ai-toolkit

# In deno.json
{
  "imports": {
    "deno-ai-toolkit": "./deno-ai-toolkit/ai-server-toolkit/mod.ts"
  }
}

# Update submodule to specific version
cd deno-ai-toolkit
git checkout v1.1.0
cd ..
git add deno-ai-toolkit
git commit -m "chore: update deno-ai-toolkit to v1.1.0"
```

**Option 2: Direct Git Import** (Deno 1.37+)

```json
{
  "imports": {
    "deno-ai-toolkit": "git+ssh://git@github.com/karelkangro/deno-ai-toolkit.git#v1.1.0"
  }
}
```

**Option 3: Personal Access Token**

```json
{
  "imports": {
    "deno-ai-toolkit": "https://username:token@raw.githubusercontent.com/karelkangro/deno-ai-toolkit/v1.1.0/ai-server-toolkit/mod.ts"
  }
}
```

### Breaking Changes Checklist

When introducing breaking changes (major version bump):

- [ ] Update function signatures in a backwards-incompatible way
- [ ] Remove deprecated functions or methods
- [ ] Change default behavior significantly
- [ ] Modify required parameters or configuration
- [ ] Update README with migration guide
- [ ] Add detailed changelog entry
- [ ] Consider deprecation warnings in previous version

### Development Workflow

**Feature Development:**

```bash
git checkout -b feature/streaming-support
# ... make changes ...
git commit -m "feat: add streaming response support"
git push origin feature/streaming-support
# Create PR to main
```

**Bug Fixes:**

```bash
git checkout -b fix/memory-leak
# ... make changes ...
git commit -m "fix: resolve memory leak in vector search"
# Create PR to main
```

**Release Process:**

```bash
# After merging all features/fixes for the release
git checkout main
git pull origin main
git tag -a v1.1.0 -m "Release v1.1.0"
git push origin v1.1.0
```

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

_Pure functional AI toolkit - no classes, just composable functions._

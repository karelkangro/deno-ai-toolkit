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
import { createRAGSystem, createVectorSearchSystem } from "jsr:@karelkangro/deno-ai-toolkit@^1.1.0";
```

### Version History

- **v1.8.0** - Added schema registry for multi-table workspace management, comprehensive examples documentation, removed redundant description field from rules
- **v1.7.x** - Document processing pipeline improvements, PDF extraction enhancements
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

### 🤖 Automatic Publishing to JSR

This toolkit uses **GitHub Actions** to automatically publish to JSR when you
push a version tag.

#### How It Works

1. **Push a version tag** → GitHub Actions triggers
2. **Workflow runs:**
   - Checks out code
   - Sets up Deno
   - Runs type checking (`deno check`)
   - Runs format check (`deno fmt --check`)
   - **Publishes to JSR** (`deno publish`)
3. **New version available** on JSR within minutes

#### Release a New Version (3 Steps)

**1. Update version in `deno.json`:**

```bash
# Edit deno.json - bump version
{
  "version": "1.2.1",  // <- Update this
  ...
}
```

**2. Update README.md Version History:**

```markdown
### Version History

- **v1.2.1** - Bug fixes and performance improvements
- **v1.2.0** - Added workspace isolation support
```

**3. Commit, Tag, and Push:**

```bash
# Commit your changes
git add .
git commit -m "chore: bump version to 1.2.1"

# Create annotated tag
git tag -a v1.2.1 -m "Release v1.2.1: Bug fixes

Improvements:
- Fix type inference issues
- Improve error messages
- Performance optimizations"

# Push commit and tag
git push origin main
git push origin v1.2.1  # 🚀 This triggers auto-publish!
```

**That's it!** GitHub Actions will automatically publish to JSR.

#### Monitor the Publish

Watch the workflow run at:

```
https://github.com/karelkangro/deno-ai-toolkit/actions
```

If the workflow succeeds, your package is live on JSR:

```
https://jsr.io/@karelkangro/deno-ai-toolkit
```

#### Requirements

- Repository must have **GitHub Actions enabled**
- Workflow file: `.github/workflows/publish.yml`
- No authentication needed (JSR uses OIDC with GitHub Actions)

#### Optional: Create GitHub Release

```bash
# Using GitHub CLI (if installed)
gh release create v1.2.1 --title "v1.2.1: Bug Fixes" --notes-from-tag

# Or create manually at: https://github.com/karelkangro/deno-ai-toolkit/releases
```

### Updating Consumer Projects

**In your project's `deno.json`:**

```json
{
  "imports": {
    "deno-ai-toolkit": "jsr:@karelkangro/deno-ai-toolkit@^1.2.0"
  }
}
```

**Version Update Workflow:**

```bash
# 1. Review changelog and breaking changes
# 2. Update deno.json to new version
# 3. Run: deno cache --reload  (fetch new version)
# 4. Test your application
# 5. Commit the version bump
```

### For Private/Development Usage

If you need to use a local or development version:

**Option 1: Local Path (Development)**

```json
{
  "imports": {
    "deno-ai-toolkit": "../deno-ai-toolkit/ai-server-toolkit/mod.ts"
  }
}
```

**Option 2: Git Import**

```json
{
  "imports": {
    "deno-ai-toolkit": "git+https://github.com/karelkangro/deno-ai-toolkit.git#v1.2.0"
  }
}
```

**Recommended:** Always use JSR for production
(`jsr:@karelkangro/deno-ai-toolkit@^1.2.0`)

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

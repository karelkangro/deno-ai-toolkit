# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Deno AI Toolkit** is a comprehensive functional toolkit for building AI-powered servers with Deno. Published to JSR as `@karelkangro/deno-ai-toolkit` (currently v1.6.2), it provides three core capabilities:

1. **Vector Database Integration** - LanceDB (local and cloud) with semantic search
2. **AI Agent System** - Intelligent agents with LLM integration (Claude) and tool usage
3. **Document Processing** - PDF extraction, chunking, legal document processing

The toolkit follows a **purely functional architecture** - all modules export stateful objects and pure functions that operate on them, no classes.

## Commands

### Type Checking & Validation

```bash
# Check TypeScript types for entire toolkit
deno task check

# Check specific file
deno check ai-server-toolkit/mod.ts
```

### Formatting & Linting

```bash
# Format all code
deno task fmt

# Lint all code
deno task lint
```

### Testing

```bash
# Run all tests
deno task test

# Run specific test file
deno test --allow-all test-chunking.ts

# Run test with specific permissions
deno test --allow-read --allow-write --allow-env test-pdf-import.ts
```

### Development

```bash
# Run in watch mode
deno task dev
```

## Architecture

### Functional Programming Patterns

This toolkit uses **stateful functional programming**:

1. **Create functions** return state objects (e.g., `createLanceDB()`, `createAgent()`)
2. **Operation functions** take state as first parameter (e.g., `searchSimilar(vectorStore, query)`)
3. **No classes** - only functions and state objects
4. **Pure functions** where possible, with explicit side effects

Example pattern:

```typescript
// 1. Create state
const vectorStore = await createLanceDB(config, embeddingsConfig);

// 2. Pass state to operations
await addDocument(vectorStore, doc);
const results = await searchSimilar(vectorStore, query);
```

### Module Structure

```
ai-server-toolkit/
├── mod.ts                 # Main entry point - exports everything
├── src/
│   ├── types.ts          # Core types used across modules
│   ├── embeddings/       # OpenAI embeddings (text → vectors)
│   │   └── openai.ts
│   ├── vector-store/     # LanceDB integration (local & cloud)
│   │   └── lancedb.ts
│   ├── llm/              # Claude LLM client
│   │   └── claude.ts
│   ├── agents/           # AI agent system
│   │   ├── base.ts       # Core agent functionality
│   │   └── specialized.ts # Domain-specific agents
│   ├── workspace/        # Workspace isolation (Deno KV)
│   │   ├── types.ts
│   │   ├── kv-store.ts   # Metadata storage
│   │   └── coordinator.ts # Coordinate KV + Vector operations
│   ├── rules/            # Rules management system
│   │   ├── types.ts
│   │   ├── kv-store.ts   # KV-based rule storage
│   │   ├── vector-store.ts # Vector-based rule search
│   │   └── validator.ts  # Rule validation
│   ├── storage/          # File storage (S3)
│   │   ├── types.ts
│   │   └── s3.ts
│   ├── document/         # Document processing pipeline
│   │   ├── types.ts
│   │   ├── pdf-extractor.ts      # Extract text/images from PDFs
│   │   ├── chunking.ts           # Split documents into chunks
│   │   ├── processor.ts          # Main processing pipeline
│   │   ├── estonian-legal.ts     # Estonian legal doc handling
│   │   ├── formatter.ts          # Citation formatting
│   │   └── mod.ts
│   └── utils/
│       └── rate-limiter.ts       # Rate limiting for API calls
```

### Key Concepts

#### Vector Store (LanceDB)

- State type: `LanceDBState`
- Supports both local (`./path`) and cloud (`db://database-id`) storage
- Main operations: `searchSimilar`, `addDocument(s)`, `updateDocument`, `deleteDocument`
- Workspace-specific operations: `createWorkspaceTable`, `searchWorkspace`, `addWorkspaceDocument`

#### Embeddings (OpenAI)

- State type: `OpenAIEmbeddingState`
- Converts text to vectors using OpenAI API
- Default model: `text-embedding-3-small` (1536 dimensions)
- Main operations: `embedText`, `embedTexts`, `calculateSimilarity`

#### LLM (Claude)

- State type: `ClaudeLLMState`
- Claude API integration for text generation
- Default model: `claude-3-5-sonnet-20241022`
- Main operations: `generateResponse`, `streamResponse`
- Supports tool use for agentic workflows

#### Agents

- State type: `AgentState`
- Combine LLM + tools + optional memory
- Built-in tools: `createSearchTool`, `createCalculatorTool`, `createWebSearchTool`
- Main operations: `runAgent`, `addTool`, `removeTool`, `clearMemory`

#### Workspaces (NEW in v1.4.0)

- Isolation layer for multi-tenant vector storage
- Uses Deno KV for metadata + LanceDB tables for vectors
- Each workspace gets its own vector table (e.g., `workspace_abc123`)
- Coordinator module handles atomic operations across both stores

#### Document Processing (NEW in v1.7.0)

- Extract text/images from PDFs (`extractPDFContent`)
- Chunking strategies: by paragraphs, sections, sentences, pages
- Legal document support (Estonian legal system)
- Citation formatting for references

### High-Level Factory Functions

Three convenience functions in `mod.ts` for quick setup:

1. **`createAISystem(config)`** - Full system: vector store + embeddings + LLM
2. **`createVectorSearchSystem(config)`** - Simplified: just vector search
3. **`createRAGSystem(config)`** - Complete RAG: includes agent with search tool

## Publishing to JSR

This package auto-publishes to JSR via GitHub Actions when version tags are pushed.

### Release Process

1. **Update version in `deno.json`:**
   ```json
   {
     "version": "1.6.3",
     ...
   }
   ```

2. **Update README.md Version History** (add new version entry)

3. **Commit, tag, and push:**
   ```bash
   git add .
   git commit -m "chore: bump version to 1.6.3"

   git tag -a v1.6.3 -m "Release v1.6.3: Description

   Changes:
   - Feature 1
   - Bug fix 2"

   git push origin main
   git push origin v1.6.3  # Triggers auto-publish
   ```

4. **Monitor workflow:** Check GitHub Actions tab for publish status

### Versioning Guidelines

- **MAJOR** (2.0.0): Breaking API changes
- **MINOR** (1.x.0): New features, backwards compatible
- **PATCH** (1.6.x): Bug fixes, backwards compatible

## Important Implementation Notes

### Type Safety

- `ai-server-toolkit/src/types.ts` contains all core interfaces
- Use explicit type imports: `import type { ... } from "./types.ts"`
- pdf-parse types are augmented in `document/pdf-parse-types.ts` due to lack of type definitions

### State Management

Every module follows the same pattern:

```typescript
// Create state
export function createThing(config: Config): ThingState {
  return { config, ...internalState };
}

// Operate on state
export async function doSomething(state: ThingState, params: Params): Promise<Result> {
  // Use state.config, state.otherFields
}
```

### Workspace Isolation Pattern

Workspaces coordinate between two storage systems:

1. **Deno KV** - Workspace metadata, document registry, rules
2. **LanceDB** - Vector embeddings in separate tables

Use `workspace/coordinator.ts` for atomic operations across both:

- `createWorkspaceCoordinated()` - Create KV workspace + vector table
- `deleteWorkspaceCoordinated()` - Clean up both stores

### Document Processing Pipeline

Typical flow:

1. `extractPDFContent()` - Extract text + images
2. `chunkByParagraphs()` or `chunkBySections()` - Split into chunks
3. `enrichChunksWithLegalContext()` - Add legal metadata (optional)
4. Embed chunks via `embedTexts()` and store in vector DB

### Rate Limiting

Always wrap API calls (especially embeddings) with rate limiting:

```typescript
const rateLimiter = createRateLimiter({ requestsPerMinute: 50 });

await withRateLimit(rateLimiter, async () => {
  return await embedText(embeddings, "some text");
});
```

## JSR Compliance

- **Module augmentation removed** - JSR doesn't support it
- Use type assertions for npm packages without types (e.g., pdf-parse)
- All imports use explicit `.ts` extensions
- No external dependencies in core exports (only npm packages in `imports`)

## Testing Patterns

Test files at root level follow naming: `test-*.ts`

Example test structure:

```typescript
import { assert } from "@std/assert";

Deno.test("feature description", async () => {
  // Setup
  const state = await createThing(config);

  // Execute
  const result = await doSomething(state, params);

  // Assert
  assert(result.success);
});
```

## Common Pitfalls

1. **LanceDB Cloud vs Local**: Use `db://` prefix for cloud, `./path` for local
2. **Workspace table naming**: Must prefix with workspace ID (e.g., `workspace_abc123`)
3. **KV paths**: Always use array format: `["workspaces", id]` not string keys
4. **Embeddings dimensions**: Must match between OpenAI config and LanceDB config (default: 1536)
5. **Tool use in agents**: Claude expects specific tool call format - see `agents/base.ts:106-159`

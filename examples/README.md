# 🚀 AI Toolkit Examples - Quick Reference

Complete examples for all toolkit components. Copy and run directly in your Deno project.

## 🔧 Environment Setup

```bash
export OPENAI_API_KEY="your-openai-key"
export CLAUDE_API_KEY="your-claude-key"
```

## 📚 Table of Contents

1. [LLM Integration](#llm-integration)
2. [Vector Operations](#vector-operations)
3. [Agent Systems](#agent-systems)
4. [Specialized Agents](#specialized-agents)
5. [Complete RAG System](#complete-rag-system)
6. [Production Setup](#production-setup)

---

## 🤖 LLM Integration

### Basic Claude Usage
```typescript
import { createClaudeLLM, generateResponse } from "./ai-server-toolkit/mod.ts";

const claude = createClaudeLLM({
  provider: 'claude',
  apiKey: Deno.env.get("CLAUDE_API_KEY")!,
  model: 'claude-3-sonnet-20240229',
});

const response = await generateResponse(claude, [
  { role: 'system', content: 'You are a helpful assistant.' },
  { role: 'user', content: 'What is Deno?' }
]);

console.log(response.content);
```

### Streaming Responses
```typescript
import { streamResponse } from "./ai-server-toolkit/mod.ts";

await streamResponse(claude, [
  { role: 'user', content: 'Tell me about TypeScript' }
], (chunk) => {
  process.stdout.write(chunk); // Real-time streaming
});
```

---

## 🔍 Vector Operations

### OpenAI Embeddings
```typescript
import { createOpenAIEmbeddings, embedText, embedTexts } from "./ai-server-toolkit/mod.ts";

const embeddings = createOpenAIEmbeddings({
  provider: 'openai',
  apiKey: Deno.env.get("OPENAI_API_KEY")!,
  model: 'text-embedding-3-small',
});

// Single text
const vector = await embedText(embeddings, "Hello world");
console.log(`Vector dimensions: ${vector.length}`);

// Batch processing
const vectors = await embedTexts(embeddings, ["Text 1", "Text 2", "Text 3"]);
console.log(`Processed ${vectors.length} texts`);
```

### LanceDB Vector Store
```typescript
import {
  createLanceDB,
  initializeTable,
  addDocument,
  searchSimilar
} from "./ai-server-toolkit/mod.ts";

// Setup
const vectorDB = await createLanceDB(
  { provider: 'lancedb', path: './vectors' },
  { provider: 'openai', apiKey: Deno.env.get("OPENAI_API_KEY")! }
);

await initializeTable(vectorDB);

// Add documents
await addDocument(vectorDB, {
  id: "doc1",
  content: "Deno is a secure runtime for JavaScript and TypeScript",
  metadata: { category: "tech" }
});

// Search
const results = await searchSimilar(vectorDB, "JavaScript runtime", { limit: 5 });
console.log(`Found ${results.length} similar documents`);
```

---

## 🤖 Agent Systems

### Basic Agent
```typescript
import { createAgent, runAgent } from "./ai-server-toolkit/mod.ts";

const agent = createAgent({
  name: "assistant",
  description: "Helpful assistant",
  systemPrompt: "You are a helpful assistant. Be concise and accurate.",
  llm: {
    provider: 'claude',
    apiKey: Deno.env.get("CLAUDE_API_KEY")!,
  },
  memory: true, // Remember conversation
});

const result = await runAgent(agent, "What are the benefits of functional programming?");
console.log(result.content);
```

### Agent with Tools
```typescript
import {
  createAgent,
  runAgent,
  createCalculatorTool,
  createSearchTool
} from "./ai-server-toolkit/mod.ts";

const agent = createAgent({
  name: "math-assistant",
  description: "Mathematical assistant",
  systemPrompt: "You are a math expert. Use tools to solve problems.",
  tools: [
    createCalculatorTool(),
    createSearchTool(async (query) => {
      // Custom search implementation
      return [{ title: "Result", content: `Search: ${query}`, url: "#" }];
    }),
  ],
  llm: {
    provider: 'claude',
    apiKey: Deno.env.get("CLAUDE_API_KEY")!,
  },
});

const result = await runAgent(agent, "Calculate 15% of 850 and search for tax information");
console.log(result.content);
console.log("Tool calls:", result.toolCalls);
```

---

## 🎯 Specialized Agents

### Domain-Specific Agent
```typescript
import {
  runSpecializedAnalysis,
  createArchitectureAgentConfig,
  type ProjectFile
} from "./ai-server-toolkit/mod.ts";

// Configure specialized agent
const config = createArchitectureAgentConfig({
  provider: 'claude',
  apiKey: Deno.env.get("CLAUDE_API_KEY")!,
}, 'en');

// Input files
const files: ProjectFile[] = [{
  name: "blueprint.txt",
  content: "3-story building with 2.8m ceiling heights",
  type: "txt"
}];

const context = {
  sessionId: "session-1",
  userRole: "architect",
  files,
  language: "en"
};

// Run analysis
const result = await runSpecializedAnalysis(config, files, context);
console.log(`Found ${result.issues.length} issues`);
console.log(`Generated ${result.recommendations.length} recommendations`);
```

### Custom Specialized Agent
```typescript
import { createSpecializedAgent, runSpecializedAnalysis } from "./ai-server-toolkit/mod.ts";

const customConfig = {
  domain: 'legal',
  name: 'Legal Review Agent',
  description: 'Legal document reviewer',
  systemPrompt: 'You are a legal expert. Review documents for compliance issues.',
  llm: {
    provider: 'claude',
    apiKey: Deno.env.get("CLAUDE_API_KEY")!,
  },
  responseFormat: 'json' as const,
  language: 'en' as const,
};

const result = await runSpecializedAnalysis(
  customConfig,
  [{ name: "contract.txt", content: "Legal contract text..." }],
  { files: [], language: "en" }
);
```

---

## 🔄 Complete RAG System

### One-Line RAG Setup
```typescript
import { createRAGSystem } from "./ai-server-toolkit/mod.ts";

const rag = await createRAGSystem({
  lancedbPath: "./rag-vectors",
  openaiApiKey: Deno.env.get("OPENAI_API_KEY")!,
  claudeApiKey: Deno.env.get("CLAUDE_API_KEY")!,
});

// Add knowledge
await rag.addDocuments([
  { id: "1", content: "TypeScript adds static typing to JavaScript" },
  { id: "2", content: "Deno has built-in TypeScript support" },
]);

// Ask questions with automatic retrieval
const answer = await rag.ask("How does TypeScript relate to Deno?");
console.log(answer.content);
```

### Custom RAG with Vector Search
```typescript
import { createVectorSearchSystem } from "./ai-server-toolkit/mod.ts";

const vectorSystem = await createVectorSearchSystem({
  lancedbPath: "./custom-vectors",
  openaiApiKey: Deno.env.get("OPENAI_API_KEY")!,
});

// Add documents with metadata
await vectorSystem.addDocuments([
  {
    id: "tech-1",
    content: "Functional programming emphasizes immutability",
    metadata: { category: "programming", difficulty: "intermediate" }
  }
]);

// Search with filters
const results = await vectorSystem.search("programming concepts", {
  limit: 3,
  filter: { category: "programming" }
});

results.forEach(r => console.log(`${r.id}: ${r.content}`));
```

---

## ⚡ Production Setup

### Error Handling & Rate Limits
```typescript
import {
  createRateLimiter,
  withRateLimit,
  createClaudeLLM
} from "./ai-server-toolkit/mod.ts";

// Custom rate limiter
const rateLimiter = createRateLimiter({
  requestsPerMinute: 10,
  requestsPerHour: 100,
});

// Safe API calls
const claude = createClaudeLLM({
  provider: 'claude',
  apiKey: Deno.env.get("CLAUDE_API_KEY")!,
});

try {
  const result = await withRateLimit(rateLimiter, async () => {
    return await generateResponse(claude, [
      { role: 'user', content: 'Hello' }
    ]);
  });
  console.log(result.content);
} catch (error) {
  if (error.message.includes('Rate limit')) {
    console.log('Rate limited - try again later');
  }
}
```

### Multi-Agent Workflow
```typescript
import { createAgent, runAgent } from "./ai-server-toolkit/mod.ts";

// Create specialized agents
const researcher = createAgent({
  name: "researcher",
  description: "Research specialist",
  systemPrompt: "Research topics thoroughly and provide factual information.",
  llm: { provider: 'claude', apiKey: Deno.env.get("CLAUDE_API_KEY")! },
});

const writer = createAgent({
  name: "writer",
  description: "Content writer",
  systemPrompt: "Write clear, engaging content based on research.",
  llm: { provider: 'claude', apiKey: Deno.env.get("CLAUDE_API_KEY")! },
});

// Workflow
const topic = "Benefits of TypeScript";
const research = await runAgent(researcher, `Research: ${topic}`);
const article = await runAgent(writer, `Write article based on: ${research.content}`);

console.log(article.content);
```

---

## 🚀 Quick Start Template

```typescript
// Complete working example - copy and run
import {
  createAISystem,
  type ProjectFile
} from "./ai-server-toolkit/mod.ts";

async function quickStart() {
  // 1. Setup AI system
  const ai = await createAISystem({
    vectorStore: { provider: 'lancedb', path: './ai-vectors' },
    embeddings: { provider: 'openai', apiKey: Deno.env.get("OPENAI_API_KEY")! },
    llm: { provider: 'claude', apiKey: Deno.env.get("CLAUDE_API_KEY")! },
  });

  // 2. Add knowledge
  await ai.addDocuments([
    { id: "1", content: "Your domain knowledge here..." }
  ]);

  // 3. Create specialized agent
  const agent = ai.createAgent({
    name: "domain-expert",
    description: "Expert in your domain",
    systemPrompt: "You are an expert. Use search to find relevant information.",
    tools: [/* your custom tools */],
  });

  // 4. Use the system
  const result = await ai.search("query");
  const response = await ai.generateResponse([
    { role: 'user', content: 'Question' }
  ]);

  console.log("Search results:", result.length);
  console.log("LLM response:", response.content);
}

if (import.meta.main) quickStart();
```

---

**🎯 Ready to implement? All examples are production-ready and fully functional!**
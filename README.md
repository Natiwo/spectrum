<div align="center">

# Spectrum

**Persistent semantic memory for AI.**

Give your AI agents memory that survives between sessions.\
Local-first. SQLite. Embeddings. Zero cloud dependency.

[![CI](https://github.com/Natiwo/spectrum/actions/workflows/ci.yml/badge.svg)](https://github.com/Natiwo/spectrum/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/@natiwo/spectrum)](https://www.npmjs.com/package/@natiwo/spectrum)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

```
Your AI remembers nothing between sessions.
Spectrum fixes that.
```

</div>

---

## The Problem

Every AI session starts from zero. Your agent does not know what happened yesterday, what you prefer, or what it already solved. Context windows are volatile. Chat history is not memory.

**Spectrum** gives AI persistent, searchable, semantic memory. It runs on your machine, stores everything in SQLite, and finds relevant memories using embeddings (384-dimensional vectors, all-MiniLM-L6-v2). No API keys. No cloud. No latency.

## Packages

| Package | Description | npm |
|---------|-------------|-----|
| [`@natiwo/spectrum`](packages/core) | Core library (storage, embeddings, search) | [![npm](https://img.shields.io/npm/v/@natiwo/spectrum)](https://www.npmjs.com/package/@natiwo/spectrum) |
| [`@natiwo/spectrum-cli`](packages/cli) | CLI tool (`spm`) | [![npm](https://img.shields.io/npm/v/@natiwo/spectrum-cli)](https://www.npmjs.com/package/@natiwo/spectrum-cli) |
| [`@natiwo/spectrum-mcp`](packages/mcp) | MCP server for Claude, Gemini, Codex | [![npm](https://img.shields.io/npm/v/@natiwo/spectrum-mcp)](https://www.npmjs.com/package/@natiwo/spectrum-mcp) |

## Quick Start

### As a Library

```bash
npm install @natiwo/spectrum
```

```typescript
import { Spectrum } from "@natiwo/spectrum"

const memory = new Spectrum()

// Save a memory
await memory.save({
  scope: "project:my-app",
  key: "architecture-decision",
  value: "We chose PostgreSQL over MongoDB because our data is relational and we need ACID transactions.",
  tags: ["architecture", "database"]
})

// Retrieve by key
const decision = memory.get("project:my-app", "architecture-decision")

// Search by keywords
const results = memory.search("database choice", "project:my-app")

// Search by meaning (semantic)
const similar = await memory.searchSemantic("which database did we pick and why?")
// Finds the architecture decision even though the words are completely different
```

### As a CLI

```bash
npm install -g @natiwo/spectrum-cli

# Save
spm save project:my-app/db-decision "PostgreSQL for ACID compliance"

# Search
spm search "database" --scope project:my-app

# Semantic search (finds by meaning, not just keywords)
spm search --semantic "which database and why?"

# List all scopes
spm scopes
```

### As an MCP Server (Claude Code, Gemini CLI, Codex)

```bash
npm install -g @natiwo/spectrum-mcp

# Add to your MCP config
spectrum-mcp
```

Claude Code (`~/.claude.json`):
```json
{
  "mcpServers": {
    "spectrum": {
      "command": "spectrum-mcp",
      "args": []
    }
  }
}
```

Now your AI can save and recall memories across sessions:
```
You: "Remember that we use Tailwind 4 with the Catalyst preset in this project"
AI: [saves to spectrum]

--- next day, new session ---

You: "What CSS framework do we use?"
AI: [searches spectrum] "You use Tailwind 4 with the Catalyst preset."
```

## How It Works

### Scopes

Scopes are namespaces that organize memories. Use them to separate concerns:

```
user:preferences     -- personal settings
project:my-app       -- project-specific context
session:2026-03-13   -- session logs
team:backend         -- shared team knowledge
```

### Embeddings

When you save a memory, Spectrum generates a 384-dimensional vector using [all-MiniLM-L6-v2](https://huggingface.co/Xenova/all-MiniLM-L6-v2). This vector captures the *meaning* of the text, not just the words.

```
"We use PostgreSQL" → [0.023, -0.041, 0.087, ..., 0.012]  (384 numbers)
```

When you search semantically, Spectrum converts your query to a vector and finds the closest matches using cosine similarity. This means:

- "which database?" matches "We use PostgreSQL" (same meaning, different words)
- "relational DB choice" matches "PostgreSQL for ACID" (related concepts)
- Typos, synonyms, and paraphrasing all work naturally

The model runs **locally via ONNX**. No API calls. No internet required.

### SQLite

All data lives in a single SQLite file (`~/.spectrum/spectrum.db`). WAL mode for concurrent reads. Embeddings stored as BLOB (Float32Array). No external database to install or manage.

**Why SQLite?** Because memory should be portable, simple, and yours. One file. Copy it, back it up, move it. Zero ops.

**Want something else?** The storage layer is pluggable. Implement the `StorageProvider` interface and use whatever you want:

```typescript
import { Spectrum } from "@natiwo/spectrum"
import { PgVectorStorage } from "./my-pgvector-adapter"

const memory = new Spectrum({
  storage: new PgVectorStorage("postgresql://..."),
})
```

Community adapters we would love to see:
- pgvector (PostgreSQL)
- Cloudflare Vectorize + D1
- Pinecone / Qdrant / Weaviate
- DynamoDB + OpenSearch
- libSQL (Turso)

## API Reference

### `Spectrum`

```typescript
import { Spectrum } from "@natiwo/spectrum"

const memory = new Spectrum({
  dbPath?: string,             // default: ~/.spectrum/spectrum.db
  storage?: StorageProvider,   // custom storage backend
  embeddings?: EmbeddingProvider, // custom embedding model
  semantic?: boolean,          // default: true (set false to disable embeddings)
})
```

#### Methods

| Method | Returns | Description |
|--------|---------|-------------|
| `save(input)` | `Promise<Memory>` | Save or update a memory (upsert by scope+key) |
| `get(scope, key)` | `Memory \| undefined` | Retrieve a specific memory |
| `list(scope, options?)` | `Memory[]` | List memories in a scope |
| `delete(scope, key)` | `boolean` | Delete a memory |
| `search(query, scope?, limit?)` | `SearchResult[]` | Keyword search (key + value) |
| `searchSemantic(query, scope?, limit?, threshold?)` | `Promise<SearchResult[]>` | Semantic search using embeddings |
| `listScopes()` | `ScopeInfo[]` | List all scopes with memory count |
| `stats()` | `Stats` | Database statistics |
| `close()` | `void` | Close the database connection |

#### Types

```typescript
interface MemoryInput {
  scope: string
  key: string
  value: string
  tags?: string[]
}

interface Memory {
  scope: string
  key: string
  value: string
  tags: string[]
  created_at: string
  updated_at: string
}

interface SearchResult {
  memory: Memory
  score: number
  match_type: "keyword" | "semantic" | "hybrid"
}
```

### Custom Providers

```typescript
interface StorageProvider {
  save(input: MemoryInput, embedding?: number[]): Memory
  get(scope: string, key: string): Memory | undefined
  list(scope: string, options?: ListOptions): Memory[]
  delete(scope: string, key: string): boolean
  search(options: SearchOptions): SearchResult[]
  searchSemantic(embedding: number[], options: SemanticSearchOptions): SearchResult[]
  listScopes(): ScopeInfo[]
  stats(): Stats
  close(): void
}

interface EmbeddingProvider {
  embed(text: string): Promise<number[]>
  embedBatch(texts: string[]): Promise<number[][]>
  dimensions(): number
}
```

## Architecture

```
@natiwo/spectrum (core)
├── Spectrum          Main class (orchestrator)
├── SqliteStorage     SQLite + WAL + BLOB embeddings
├── LocalEmbedding    all-MiniLM-L6-v2, 384D, ONNX local
├── NoopEmbedding     Keyword-only mode (no model download)
└── Types             Memory, SearchResult, providers

@natiwo/spectrum-cli
└── spm               CLI interface (save, get, search, list, scopes, stats)

@natiwo/spectrum-mcp
└── MCP Server        Model Context Protocol for AI tools
```

Dependency graph:
```
spectrum-cli ──depends──> spectrum (core)
spectrum-mcp ──depends──> spectrum (core)
```

## Guardrails

Spectrum is a memory system. Memory without guardrails is a liability. Here is what you should think about when giving AI persistent memory:

**Scope isolation.** Do not dump everything in one scope. Separate `user:*`, `project:*`, `session:*`. When an AI searches for "database config", it should not accidentally pull your personal notes.

**Sensitive data.** Spectrum stores plain text in SQLite. Do not save secrets, tokens, passwords, or PII without encryption. If you need to store sensitive data, encrypt before saving or use a dedicated secrets manager.

**Memory hygiene.** Old memories can mislead. If your architecture changed from MongoDB to PostgreSQL, the old "we use MongoDB" memory will confuse your AI. Update or delete stale entries.

**Least privilege.** The MCP server exposes read and write operations. If you are running Spectrum in a shared environment, consider who can access the database file and the MCP endpoint.

**Your data, your machine.** Spectrum is local-first by design. Your memories never leave your machine unless you explicitly configure a remote storage provider.

## Use Cases

| Use Case | How |
|----------|-----|
| **AI remembers preferences** | `scope: "user"` -- coding style, tools, conventions |
| **Project context** | `scope: "project:name"` -- architecture, decisions, patterns |
| **Session continuity** | `scope: "session"` -- what happened, what was decided |
| **Team knowledge** | `scope: "team:backend"` -- shared standards, runbooks |
| **Skills and procedures** | `scope: "skills"` -- reusable instructions, how-tos |
| **Debug history** | `scope: "debug"` -- what failed, what fixed it, root causes |

## Contributing

Contributions are welcome. Issues, PRs, new storage adapters, embedding providers, documentation.

```bash
# Clone and install
git clone https://github.com/Natiwo/spectrum.git
cd spectrum
pnpm install

# Build
pnpm build

# Run tests
pnpm test

# Lint + typecheck
pnpm check

# Run all quality gates
pnpm lint && pnpm typecheck && pnpm build && pnpm test
```

### Quality Gate

| Check | Command |
|-------|---------|
| Format | `pnpm format` |
| Lint | `pnpm lint` |
| Type Check | `pnpm typecheck` |
| Test | `pnpm test` |
| Dead Code | `pnpm knip` |
| Deps Audit | `pnpm audit:deps` |
| Licenses | `pnpm audit:licenses` |
| Secrets | `pnpm audit:secrets` |

## Enterprise

Spectrum is a professional commercial project. The open source version (MIT) gives you everything you need for personal and team use.

If you need multi-tenant isolation, managed infrastructure, custom embedding models, SLA, or integration support for your organization, reach out:

**[Claudiomar Estevam](https://www.linkedin.com/in/claudioeestevam/)** -- Natiwo Sistemas

## About

Built by [Natiwo](https://natiwo.com.br). Designed with neurodivergent minds in mind, built for everyone.

Spectrum was born from a real need: after thousands of AI sessions, starting from zero every time was not an option anymore. What began as a personal tool evolved into a production system and now an open source project.

## License

[MIT](LICENSE) -- Use it, modify it, share it, ship it.

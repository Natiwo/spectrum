<div align="center">

# Spectrum

**Persistent semantic memory for AI.**

Give your AI agents memory that survives between sessions.\
Local-first. SQLite. Embeddings. Zero cloud dependency.

[![npm](https://img.shields.io/npm/v/@natiwo/spectrum-memory)](https://www.npmjs.com/package/@natiwo/spectrum-memory)
[![PyPI](https://img.shields.io/pypi/v/spectrum-memory)](https://pypi.org/project/spectrum-memory/)
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

## Install

**Node:**
```bash
npm install -g @natiwo/spectrum-memory
```

**Python:**
```bash
pip install spectrum-memory
```

One package. Includes the core library, CLI (`spm`), and MCP server (`spectrum-mcp`). Both read and write the same SQLite database (`~/.spectrum/spectrum.db`).

## Quick Start

### As a Library

```typescript
import { Spectrum } from "@natiwo/spectrum-memory"

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

Claude Code (`~/.claude.json`):
```json
{
  "mcpServers": {
    "spectrum": {
      "command": "spectrum-mcp"
    }
  }
}
```

Gemini CLI (`~/.gemini/settings.json`):
```json
{
  "mcpServers": {
    "spectrum": {
      "command": "spectrum-mcp"
    }
  }
}
```

Codex:
```toml
[mcp_servers.spectrum]
command = "spectrum-mcp"
```

Three agents, one memory. Claude saves, Gemini reads, Codex uses. Nobody forgets.

## How It Works

### Scopes

Scopes are namespaces that organize memories:

```
user/                    -- personal settings, preferences
project:my-app/          -- project-specific context
session/                 -- session logs and summaries
technical/               -- reusable technical knowledge
active/                  -- current work in progress
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
import { Spectrum } from "@natiwo/spectrum-memory"
import { PgVectorStorage } from "./my-pgvector-adapter"

const memory = new Spectrum({
  storage: new PgVectorStorage("postgresql://..."),
})
```

## API Reference

### `Spectrum`

```typescript
import { Spectrum } from "@natiwo/spectrum-memory"

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
@natiwo/spectrum-memory
├── Spectrum          Main class (orchestrator)
├── SqliteStorage     SQLite + WAL + BLOB embeddings
├── LocalEmbedding    all-MiniLM-L6-v2, 384D, ONNX local
├── NoopEmbedding     Keyword-only mode (no model download)
├── CLI (spm)         Terminal interface
├── MCP Server        Model Context Protocol for AI tools
└── Types             Memory, SearchResult, providers
```

## Guardrails

Spectrum is a memory system. Memory without guardrails is a liability. Here is what you should think about when giving AI persistent memory:

**Scope isolation.** Do not dump everything in one scope. Separate `user/`, `project:*/`, `session/`. When an AI searches for "database config", it should not accidentally pull your personal notes.

**Sensitive data.** Spectrum stores plain text in SQLite. Do not save secrets, tokens, passwords, or PII without encryption. If you need to store sensitive data, encrypt before saving or use a dedicated secrets manager.

**Memory hygiene.** Old memories can mislead. If your architecture changed from MongoDB to PostgreSQL, the old "we use MongoDB" memory will confuse your AI. Update or delete stale entries.

**Your data, your machine.** Spectrum is local-first by design. Your memories never leave your machine unless you explicitly configure a remote storage provider.

## Spectrum Cloud

The open source version runs 100% local with SQLite and 384D embeddings. For production applications that need to scale:

**Spectrum Cloud** offers:
- **REST API** with hybrid search (70% semantic + 30% keyword)
- **Embeddings 1024D** (`bge-large-en-v1.5`)
- **Multi-tenant** isolation
- Same API, scalable for teams and real applications

## Contributing

Contributions are welcome. Issues, PRs, new storage adapters, embedding providers, documentation.

```bash
git clone https://github.com/Natiwo/spectrum.git
cd spectrum
pnpm install
pnpm build
pnpm test
```

## Python

The Python package (`spectrum-memory` on PyPI) shares the same database and API. Install with `pip install spectrum-memory`. Source: [github.com/Natiwo/spectrum-memory](https://github.com/Natiwo/spectrum-memory).

## About

Built by [Natiwo](https://natiwo.com.br). Designed with neurodivergent minds in mind, built for everyone.

Spectrum was born from a real need: after thousands of AI sessions, starting from zero every time was not an option anymore.

**[Claudiomar Estevam](https://www.linkedin.com/in/claudioeestevam/)** -- Natiwo Sistemas

## License

[MIT](LICENSE) -- Use it, modify it, share it, ship it.

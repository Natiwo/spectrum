<div align="center">

# @natiwo/spectrum

**Persistent semantic memory for AI agents.**

Give your AI memory that survives between sessions.\
Local-first. SQLite. Embeddings. Zero cloud dependency.

[![npm](https://img.shields.io/npm/v/@natiwo/spectrum)](https://www.npmjs.com/package/@natiwo/spectrum)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://github.com/Natiwo/spectrum/blob/main/LICENSE)

</div>

---

## Install

```bash
npm install @natiwo/spectrum
```

For semantic search (optional):

```bash
npm install @huggingface/transformers
```

## Usage

```typescript
import { Spectrum } from "@natiwo/spectrum"

const memory = new Spectrum()

// save
await memory.save({
  scope: "project:my-app",
  key: "architecture",
  value: "PostgreSQL for ACID compliance. Redis for caching. Next.js 15 frontend.",
  tags: ["stack", "database"]
})

// retrieve
const arch = memory.get("project:my-app", "architecture")
// → { scope, key, value, tags, created_at, updated_at }

// keyword search
const results = memory.search("database", "project:my-app")
// → [{ memory, score, match_type: "keyword" }]

// semantic search (finds by meaning, not just words)
const similar = await memory.searchSemantic("which database did we pick?")
// → matches "PostgreSQL for ACID" even with different words

// list all memories in a scope
const all = memory.list("project:my-app")

// list all scopes
const scopes = memory.listScopes()
// → [{ scope: "project:my-app", count: 1 }]

// done
memory.close()
```

## How It Works

### Scopes

Namespaces that organize memories. Use them to separate concerns:

```
user                 → personal preferences, coding style
project:my-app       → architecture, decisions, patterns
session:2026-03-13   → what happened today
team:backend         → shared standards
```

### Embeddings

Every memory gets a 384-dimensional vector from [all-MiniLM-L6-v2](https://huggingface.co/Xenova/all-MiniLM-L6-v2), capturing its *meaning*:

```
"We use PostgreSQL" → [0.023, -0.041, 0.087, ..., 0.012]
```

Semantic search converts your query to a vector and finds closest matches via cosine similarity. Typos, synonyms, paraphrasing — all work naturally.

The model runs **locally via ONNX**. No API calls. No internet. No latency.

Without `@huggingface/transformers` installed, Spectrum falls back to keyword-only mode automatically.

### SQLite

Single file (`~/.spectrum/spectrum.db`). WAL mode for concurrent reads. Embeddings as BLOB (Float32Array). Zero ops.

## API

```typescript
const memory = new Spectrum({
  dbPath?: string,              // default: ~/.spectrum/spectrum.db
  storage?: StorageProvider,    // custom storage backend
  embeddings?: EmbeddingProvider, // custom embedding model
  semantic?: boolean,           // default: true (false = no embeddings)
})
```

| Method | Returns | Description |
|--------|---------|-------------|
| `save(input)` | `Promise<Memory>` | Upsert by scope+key |
| `get(scope, key)` | `Memory \| undefined` | Retrieve by key |
| `list(scope, opts?)` | `Memory[]` | List with optional prefix/limit |
| `delete(scope, key)` | `boolean` | Delete a memory |
| `search(query, scope?, limit?)` | `SearchResult[]` | Keyword search |
| `searchSemantic(query, scope?, limit?, threshold?)` | `Promise<SearchResult[]>` | Semantic search |
| `listScopes()` | `ScopeInfo[]` | All scopes with count |
| `stats()` | `Stats` | DB statistics |
| `close()` | `void` | Close connection |

## Pluggable Storage

Implement `StorageProvider` to use any backend:

```typescript
import { Spectrum } from "@natiwo/spectrum"
import { PgVectorStorage } from "./my-adapter"

const memory = new Spectrum({
  storage: new PgVectorStorage("postgresql://...")
})
```

## Ecosystem

| Package | What |
|---------|------|
| **@natiwo/spectrum** | Core library (you are here) |
| [@natiwo/spectrum-cli](https://www.npmjs.com/package/@natiwo/spectrum-cli) | CLI tool (`spm`) |
| [@natiwo/spectrum-mcp](https://www.npmjs.com/package/@natiwo/spectrum-mcp) | MCP server for Claude, Gemini, Codex |

## Documentation

Full documentation, architecture, and contribution guide: [github.com/Natiwo/spectrum](https://github.com/Natiwo/spectrum)

## License

[MIT](https://github.com/Natiwo/spectrum/blob/main/LICENSE)

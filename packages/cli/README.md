<div align="center">

# @natiwo/spectrum-cli

**CLI for Spectrum — persistent semantic memory for AI.**

Save, search, and manage memories from the terminal.

[![npm](https://img.shields.io/npm/v/@natiwo/spectrum-cli)](https://www.npmjs.com/package/@natiwo/spectrum-cli)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://github.com/Natiwo/spectrum/blob/main/LICENSE)

</div>

---

## Install

```bash
npm install -g @natiwo/spectrum-cli
```

Or use with `npx`:

```bash
npx @natiwo/spectrum-cli help
```

## Commands

```
spm save <scope/key> <value> [--tags tag1,tag2]   Save a memory
spm get <scope/key>                                Retrieve a memory
spm delete <scope/key>                             Delete a memory
spm list <scope> [--prefix prefix] [--limit n]     List memories in a scope
spm search <query> [--scope s] [--semantic]        Search memories
spm scopes                                         List all scopes
spm stats                                          Database statistics
spm help                                           Show help
```

## Usage

### Save memories

```bash
# Simple
spm save user/name "Claudio"

# With tags
spm save project:app/stack "Next.js 15, PostgreSQL, Redis" --tags stack,frontend

# Multi-word values (quote them)
spm save project:app/decision "We chose PostgreSQL over MongoDB because our data is relational"
```

### Retrieve

```bash
spm get project:app/stack
# → Next.js 15, PostgreSQL, Redis
# → Tags: stack, frontend
# → Updated: 2026-03-13T09:30:00Z
```

### Search

```bash
# Keyword search (matches text in key and value)
spm search "database"

# Scoped search
spm search "database" --scope project:app

# Semantic search (finds by meaning, not just words)
spm search "which database did we pick?" --semantic

# Limit results
spm search "config" --limit 5
```

### List and organize

```bash
# List all memories in a scope
spm list project:app

# Filter by key prefix
spm list project:app --prefix config

# See all scopes
spm scopes
# → project:app (3)
# → user (2)
# → Total: 2 scopes

# Database stats
spm stats
# → Memories: 5
# → Scopes: 2
# → DB: 48.0 KB
```

## Scopes

Scopes are namespaces. Use `/` to separate scope from key:

```
user/name               → scope: "user",         key: "name"
project:app/stack       → scope: "project:app",  key: "stack"
session:2026-03-13/log  → scope: "session:2026-03-13", key: "log"
```

Use colons for scope hierarchy. Use `/` to delimit key. The last `/` in the path splits scope from key.

## Semantic Search

To enable `--semantic`, install the optional dependency:

```bash
npm install -g @huggingface/transformers
```

The model (`all-MiniLM-L6-v2`, 384D) downloads on first use and runs locally via ONNX. No API. No cloud.

## Custom DB Path

```bash
SPECTRUM_DB_PATH=/path/to/my.db spm list user
```

Default: `~/.spectrum/spectrum.db`

## Ecosystem

| Package | What |
|---------|------|
| [@natiwo/spectrum](https://www.npmjs.com/package/@natiwo/spectrum) | Core library |
| **@natiwo/spectrum-cli** | CLI tool (you are here) |
| [@natiwo/spectrum-mcp](https://www.npmjs.com/package/@natiwo/spectrum-mcp) | MCP server for Claude, Gemini, Codex |

## Documentation

Full documentation: [github.com/Natiwo/spectrum](https://github.com/Natiwo/spectrum)

## License

[MIT](https://github.com/Natiwo/spectrum/blob/main/LICENSE)

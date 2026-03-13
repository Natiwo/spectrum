<div align="center">

# @natiwo/spectrum-mcp

**MCP server for Spectrum — give your AI persistent memory.**

Works with Claude, Gemini, Codex, and any MCP-compatible client.

[![npm](https://img.shields.io/npm/v/@natiwo/spectrum-mcp)](https://www.npmjs.com/package/@natiwo/spectrum-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://github.com/Natiwo/spectrum/blob/main/LICENSE)

</div>

---

## What This Does

Your AI forgets everything between sessions. This MCP server connects it to Spectrum, a local SQLite-based semantic memory system. Your AI can save context, recall decisions, and search by meaning across sessions.

```
You: "Remember that we use Tailwind 4 with the Catalyst preset"
AI:  [saves to Spectrum]

--- next day, new session ---

You: "What CSS framework do we use?"
AI:  [searches Spectrum] "You use Tailwind 4 with the Catalyst preset."
```

No cloud. No API keys. Everything on your machine.

## Setup

### Claude Code

Add to `~/.claude.json`:

```json
{
  "mcpServers": {
    "spectrum": {
      "command": "npx",
      "args": ["-y", "@natiwo/spectrum-mcp"]
    }
  }
}
```

### Claude Desktop

Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "spectrum": {
      "command": "npx",
      "args": ["-y", "@natiwo/spectrum-mcp"]
    }
  }
}
```

### Global install (faster startup)

```bash
npm install -g @natiwo/spectrum-mcp
```

Then use `spectrum-mcp` instead of `npx`:

```json
{
  "mcpServers": {
    "spectrum": {
      "command": "spectrum-mcp"
    }
  }
}
```

### Any MCP client

Spectrum MCP uses stdio transport. Point your client to the `spectrum-mcp` binary or `npx @natiwo/spectrum-mcp`.

## Tools

The server exposes 7 tools:

| Tool | Description |
|------|-------------|
| `memory_save` | Save or update a memory (scope, key, value, optional tags) |
| `memory_get` | Retrieve a specific memory by scope and key |
| `memory_list` | List memories in a scope (with optional prefix filter) |
| `memory_delete` | Delete a specific memory |
| `memory_search` | Keyword search across keys and values |
| `memory_search_semantic` | Search by meaning using embeddings |
| `memory_list_scopes` | List all scopes with memory count |

### Example tool calls

```
memory_save(scope: "project:my-app", key: "stack", value: "Next.js 15, PostgreSQL, Redis", tags: ["architecture"])
memory_get(scope: "project:my-app", key: "stack")
memory_search(query: "database", scope: "project:my-app")
memory_search_semantic(query: "which database did we choose?")
memory_list(scope: "project:my-app", prefix: "config")
memory_list_scopes()
memory_delete(scope: "project:my-app", key: "old-decision")
```

## Scopes

Organize memories by context:

| Scope pattern | Use |
|---------------|-----|
| `user` | Personal preferences, coding style |
| `project:<name>` | Project-specific architecture, decisions |
| `session` | Session summaries, continuity |
| `team:<name>` | Shared team knowledge |
| `debug` | What broke, what fixed it |

## Semantic Search

For search by meaning (not just keywords), install the optional dependency:

```bash
npm install -g @huggingface/transformers
```

The embedding model (`all-MiniLM-L6-v2`, 384D, ONNX) downloads on first use and runs locally. No API. No cloud. No latency.

Without it, `memory_search_semantic` falls back to keyword search.

## Storage

All data in `~/.spectrum/spectrum.db` (SQLite, WAL mode). One file. Copy it, back it up, sync it between machines.

Custom path:

```json
{
  "mcpServers": {
    "spectrum": {
      "command": "spectrum-mcp",
      "env": {
        "SPECTRUM_DB_PATH": "/path/to/custom.db"
      }
    }
  }
}
```

## Ecosystem

| Package | What |
|---------|------|
| [@natiwo/spectrum](https://www.npmjs.com/package/@natiwo/spectrum) | Core library |
| [@natiwo/spectrum-cli](https://www.npmjs.com/package/@natiwo/spectrum-cli) | CLI tool (`spm`) |
| **@natiwo/spectrum-mcp** | MCP server (you are here) |

## Documentation

Full documentation, API reference, and architecture: [github.com/Natiwo/spectrum](https://github.com/Natiwo/spectrum)

## License

[MIT](https://github.com/Natiwo/spectrum/blob/main/LICENSE)

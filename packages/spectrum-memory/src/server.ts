import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import { z } from "zod"
import { Spectrum } from "./spectrum.js"

const memory = new Spectrum()

const server = new McpServer({
	name: "spectrum-memory",
	version: "0.2.0",
})

server.tool(
	"memory_save",
	"Save or update a memory in Spectrum",
	{
		scope: z.string().describe("Namespace (e.g. project:my-app, user, session)"),
		key: z.string().describe("Unique key within the scope"),
		value: z.string().describe("Content to store"),
		tags: z.array(z.string()).optional().describe("Optional tags for categorization"),
	},
	async ({ scope, key, value, tags }) => {
		const result = await memory.save({ scope, key, value, tags })
		return {
			content: [
				{
					type: "text" as const,
					text: `Saved: ${result.scope}/${result.key} (${result.updated_at})`,
				},
			],
		}
	},
)

server.tool(
	"memory_get",
	"Retrieve a specific memory by scope and key",
	{
		scope: z.string().describe("Namespace"),
		key: z.string().describe("Key within the scope"),
	},
	async ({ scope, key }) => {
		const result = memory.get(scope, key)
		if (!result) {
			return { content: [{ type: "text" as const, text: "Not found" }] }
		}
		const tags = result.tags.length > 0 ? `\nTags: ${result.tags.join(", ")}` : ""
		return {
			content: [
				{ type: "text" as const, text: `${result.value}${tags}\n\nUpdated: ${result.updated_at}` },
			],
		}
	},
)

server.tool(
	"memory_list",
	"List memories in a scope",
	{
		scope: z.string().describe("Namespace to list"),
		prefix: z.string().optional().describe("Filter by key prefix"),
		limit: z.number().optional().describe("Max results (default 100)"),
	},
	async ({ scope, prefix, limit }) => {
		const results = memory.list(scope, { prefix, limit })
		if (results.length === 0) {
			return { content: [{ type: "text" as const, text: "No memories in this scope" }] }
		}
		const lines = results.map((m) => {
			const tags = m.tags.length > 0 ? ` [${m.tags.join(", ")}]` : ""
			return `${m.key}${tags}: ${m.value.slice(0, 200)}${m.value.length > 200 ? "..." : ""}`
		})
		return {
			content: [
				{
					type: "text" as const,
					text: `${scope} (${results.length} memories):\n\n${lines.join("\n\n")}`,
				},
			],
		}
	},
)

server.tool(
	"memory_delete",
	"Delete a specific memory",
	{
		scope: z.string().describe("Namespace"),
		key: z.string().describe("Key to delete"),
	},
	async ({ scope, key }) => {
		const deleted = memory.delete(scope, key)
		return {
			content: [
				{ type: "text" as const, text: deleted ? `Deleted: ${scope}/${key}` : "Not found" },
			],
		}
	},
)

server.tool(
	"memory_search",
	"Search memories by keyword (matches key and value text)",
	{
		query: z.string().describe("Search query"),
		scope: z.string().optional().describe("Limit search to a specific scope"),
		limit: z.number().optional().describe("Max results (default 20)"),
	},
	async ({ query, scope, limit }) => {
		const results = memory.search(query, scope, limit)
		if (results.length === 0) {
			return { content: [{ type: "text" as const, text: "No results" }] }
		}
		const lines = results.map((r) => {
			return `[${r.score.toFixed(2)}] ${r.memory.scope}/${r.memory.key}: ${r.memory.value.slice(0, 200)}${r.memory.value.length > 200 ? "..." : ""}`
		})
		return {
			content: [
				{
					type: "text" as const,
					text: `Found ${results.length} results:\n\n${lines.join("\n\n")}`,
				},
			],
		}
	},
)

server.tool(
	"memory_search_semantic",
	"Search memories by meaning using embeddings (finds related content even with different words)",
	{
		query: z.string().describe("Natural language query"),
		scope: z.string().optional().describe("Limit search to a specific scope"),
		limit: z.number().optional().describe("Max results (default 20)"),
		threshold: z.number().optional().describe("Minimum similarity score 0-1 (default 0.3)"),
	},
	async ({ query, scope, limit, threshold }) => {
		const results = await memory.searchSemantic(query, scope, limit, threshold)
		if (results.length === 0) {
			return { content: [{ type: "text" as const, text: "No results" }] }
		}
		const lines = results.map((r) => {
			return `[${r.score.toFixed(2)}] ${r.memory.scope}/${r.memory.key} (${r.match_type}): ${r.memory.value.slice(0, 200)}${r.memory.value.length > 200 ? "..." : ""}`
		})
		return {
			content: [
				{
					type: "text" as const,
					text: `Found ${results.length} results:\n\n${lines.join("\n\n")}`,
				},
			],
		}
	},
)

server.tool("memory_list_scopes", "List all scopes with memory count", {}, async () => {
	const scopes = memory.listScopes()
	if (scopes.length === 0) {
		return { content: [{ type: "text" as const, text: "No scopes" }] }
	}
	const lines = scopes.map((s) => `${s.scope} (${s.count})`)
	return {
		content: [{ type: "text" as const, text: `${scopes.length} scopes:\n\n${lines.join("\n")}` }],
	}
})

async function main(): Promise<void> {
	const transport = new StdioServerTransport()
	await server.connect(transport)
}

main().catch((err) => {
	console.error(err)
	process.exit(1)
})

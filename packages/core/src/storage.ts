import { existsSync, mkdirSync } from "node:fs"
import { homedir } from "node:os"
import { dirname, join } from "node:path"
import Database from "better-sqlite3"
import type {
	ListOptions,
	Memory,
	MemoryInput,
	ScopeInfo,
	SearchOptions,
	SearchResult,
	SemanticSearchOptions,
	Stats,
	StorageProvider,
} from "./types.js"

const DEFAULT_DB_PATH = join(homedir(), ".spectrum", "spectrum.db")

function cosineSimilarity(a: number[], b: number[]): number {
	let dot = 0
	let normA = 0
	let normB = 0
	for (let i = 0; i < a.length; i++) {
		dot += (a[i] ?? 0) * (b[i] ?? 0)
		normA += (a[i] ?? 0) ** 2
		normB += (b[i] ?? 0) ** 2
	}
	const denom = Math.sqrt(normA) * Math.sqrt(normB)
	return denom === 0 ? 0 : dot / denom
}

export class SqliteStorage implements StorageProvider {
	private db: Database.Database

	constructor(dbPath?: string) {
		const path = dbPath ?? DEFAULT_DB_PATH
		const dir = dirname(path)
		if (!existsSync(dir)) {
			mkdirSync(dir, { recursive: true })
		}

		this.db = new Database(path)
		this.db.pragma("journal_mode = WAL")
		this.db.pragma("busy_timeout = 5000")
		this.db.pragma("synchronous = NORMAL")
		this.db.pragma("foreign_keys = ON")
		this.initialize()
	}

	private initialize(): void {
		this.db.exec(`
			CREATE TABLE IF NOT EXISTS memories (
				scope TEXT NOT NULL,
				key TEXT NOT NULL,
				value TEXT NOT NULL,
				tags TEXT NOT NULL DEFAULT '[]',
				embedding BLOB,
				created_at TEXT NOT NULL DEFAULT (datetime('now')),
				updated_at TEXT NOT NULL DEFAULT (datetime('now')),
				PRIMARY KEY (scope, key)
			);

			CREATE INDEX IF NOT EXISTS idx_memories_scope ON memories(scope);
			CREATE INDEX IF NOT EXISTS idx_memories_updated ON memories(updated_at);
		`)
	}

	save(input: MemoryInput, embedding?: number[]): Memory {
		const now = new Date().toISOString()
		const tags = JSON.stringify(input.tags ?? [])
		const embeddingBlob = embedding ? Buffer.from(new Float32Array(embedding).buffer) : null

		const stmt = this.db.prepare(`
			INSERT INTO memories (scope, key, value, tags, embedding, created_at, updated_at)
			VALUES (?, ?, ?, ?, ?, ?, ?)
			ON CONFLICT(scope, key) DO UPDATE SET
				value = excluded.value,
				tags = excluded.tags,
				embedding = excluded.embedding,
				updated_at = excluded.updated_at
		`)

		stmt.run(input.scope, input.key, input.value, tags, embeddingBlob, now, now)

		return {
			scope: input.scope,
			key: input.key,
			value: input.value,
			tags: input.tags ?? [],
			embedding,
			created_at: now,
			updated_at: now,
		}
	}

	get(scope: string, key: string): Memory | undefined {
		const row = this.db
			.prepare("SELECT * FROM memories WHERE scope = ? AND key = ?")
			.get(scope, key) as MemoryRow | undefined

		return row ? rowToMemory(row) : undefined
	}

	list(scope: string, options?: ListOptions): Memory[] {
		const limit = options?.limit ?? 100
		const offset = options?.offset ?? 0

		let query = "SELECT * FROM memories WHERE scope = ?"
		const params: (string | number)[] = [scope]

		if (options?.prefix) {
			query += " AND key LIKE ?"
			params.push(`${options.prefix}%`)
		}

		query += " ORDER BY updated_at DESC LIMIT ? OFFSET ?"
		params.push(limit, offset)

		const rows = this.db.prepare(query).all(...params) as MemoryRow[]
		return rows.map(rowToMemory)
	}

	delete(scope: string, key: string): boolean {
		const result = this.db
			.prepare("DELETE FROM memories WHERE scope = ? AND key = ?")
			.run(scope, key)
		return result.changes > 0
	}

	search(options: SearchOptions): SearchResult[] {
		const limit = options.limit ?? 20
		const terms = options.query
			.toLowerCase()
			.split(/\s+/)
			.filter((t) => t.length > 0)

		if (terms.length === 0) return []

		let query = "SELECT * FROM memories WHERE "
		const conditions: string[] = []
		const params: (string | number)[] = []

		if (options.scope) {
			conditions.push("scope = ?")
			params.push(options.scope)
		}

		const termConditions = terms.map(() => "(LOWER(value) LIKE ? OR LOWER(key) LIKE ?)")
		conditions.push(`(${termConditions.join(" AND ")})`)
		for (const term of terms) {
			params.push(`%${term}%`, `%${term}%`)
		}

		query += conditions.join(" AND ")
		query += " ORDER BY updated_at DESC LIMIT ?"
		params.push(limit)

		const rows = this.db.prepare(query).all(...params) as MemoryRow[]
		return rows.map((row) => ({
			memory: rowToMemory(row),
			score: 1.0,
			match_type: "keyword" as const,
		}))
	}

	searchSemantic(embedding: number[], options: SemanticSearchOptions): SearchResult[] {
		const limit = options.limit ?? 20
		const threshold = options.threshold ?? 0.3

		let query = "SELECT * FROM memories WHERE embedding IS NOT NULL"
		const params: string[] = []

		if (options.scope) {
			query += " AND scope = ?"
			params.push(options.scope)
		}

		const rows = this.db.prepare(query).all(...params) as MemoryRow[]

		const scored = rows
			.map((row) => {
				const stored = rowToEmbedding(row)
				if (!stored) return null
				const score = cosineSimilarity(embedding, stored)
				return { row, score }
			})
			.filter((r): r is { row: MemoryRow; score: number } => r !== null && r.score >= threshold)
			.sort((a, b) => b.score - a.score)
			.slice(0, limit)

		return scored.map(({ row, score }) => ({
			memory: rowToMemory(row),
			score,
			match_type: "semantic" as const,
		}))
	}

	listScopes(): ScopeInfo[] {
		const rows = this.db
			.prepare("SELECT scope, COUNT(*) as count FROM memories GROUP BY scope ORDER BY scope")
			.all() as { scope: string; count: number }[]

		return rows
	}

	stats(): Stats {
		const countRow = this.db.prepare("SELECT COUNT(*) as total FROM memories").get() as {
			total: number
		}

		const scopeRow = this.db
			.prepare("SELECT COUNT(DISTINCT scope) as total FROM memories")
			.get() as { total: number }

		const sizeRow = this.db
			.prepare("SELECT page_count * page_size as size FROM pragma_page_count(), pragma_page_size()")
			.get() as { size: number }

		return {
			total_memories: countRow.total,
			total_scopes: scopeRow.total,
			db_size_bytes: sizeRow.size,
		}
	}

	close(): void {
		this.db.close()
	}
}

interface MemoryRow {
	scope: string
	key: string
	value: string
	tags: string
	embedding: Buffer | null
	created_at: string
	updated_at: string
}

function rowToMemory(row: MemoryRow): Memory {
	return {
		scope: row.scope,
		key: row.key,
		value: row.value,
		tags: JSON.parse(row.tags) as string[],
		created_at: row.created_at,
		updated_at: row.updated_at,
	}
}

function rowToEmbedding(row: MemoryRow): number[] | null {
	if (!row.embedding) return null
	return Array.from(
		new Float32Array(row.embedding.buffer, row.embedding.byteOffset, row.embedding.byteLength / 4),
	)
}

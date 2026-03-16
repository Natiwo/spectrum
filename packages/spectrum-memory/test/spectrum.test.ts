import { existsSync, unlinkSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { Spectrum } from "../src/index.js"

function tmpDb(): string {
	return join(tmpdir(), `spectrum-test-${Date.now()}-${Math.random().toString(36).slice(2)}.db`)
}

describe("Spectrum", () => {
	let db: string
	let spectrum: Spectrum

	beforeEach(() => {
		db = tmpDb()
		spectrum = new Spectrum({ dbPath: db, semantic: false })
	})

	afterEach(() => {
		spectrum.close()
		if (existsSync(db)) unlinkSync(db)
		const wal = `${db}-wal`
		const shm = `${db}-shm`
		if (existsSync(wal)) unlinkSync(wal)
		if (existsSync(shm)) unlinkSync(shm)
	})

	describe("save and get", () => {
		it("saves and retrieves a memory", async () => {
			await spectrum.save({ scope: "test", key: "hello", value: "world" })
			const result = spectrum.get("test", "hello")
			expect(result).toBeDefined()
			expect(result?.value).toBe("world")
			expect(result?.scope).toBe("test")
			expect(result?.key).toBe("hello")
			expect(result?.tags).toEqual([])
		})

		it("saves with tags", async () => {
			await spectrum.save({ scope: "test", key: "tagged", value: "data", tags: ["a", "b"] })
			const result = spectrum.get("test", "tagged")
			expect(result?.tags).toEqual(["a", "b"])
		})

		it("upserts on same scope+key", async () => {
			await spectrum.save({ scope: "test", key: "item", value: "v1" })
			await spectrum.save({ scope: "test", key: "item", value: "v2" })
			const result = spectrum.get("test", "item")
			expect(result?.value).toBe("v2")
		})

		it("returns undefined for missing key", () => {
			const result = spectrum.get("nope", "nada")
			expect(result).toBeUndefined()
		})
	})

	describe("list", () => {
		it("lists memories in a scope", async () => {
			await spectrum.save({ scope: "proj", key: "a", value: "1" })
			await spectrum.save({ scope: "proj", key: "b", value: "2" })
			await spectrum.save({ scope: "other", key: "c", value: "3" })

			const results = spectrum.list("proj")
			expect(results).toHaveLength(2)
		})

		it("filters by prefix", async () => {
			await spectrum.save({ scope: "proj", key: "config-db", value: "pg" })
			await spectrum.save({ scope: "proj", key: "config-cache", value: "redis" })
			await spectrum.save({ scope: "proj", key: "decision-orm", value: "drizzle" })

			const results = spectrum.list("proj", { prefix: "config" })
			expect(results).toHaveLength(2)
		})

		it("respects limit", async () => {
			for (let i = 0; i < 10; i++) {
				await spectrum.save({ scope: "bulk", key: `item-${i}`, value: `val-${i}` })
			}
			const results = spectrum.list("bulk", { limit: 3 })
			expect(results).toHaveLength(3)
		})
	})

	describe("delete", () => {
		it("deletes an existing memory", async () => {
			await spectrum.save({ scope: "test", key: "del", value: "bye" })
			expect(spectrum.delete("test", "del")).toBe(true)
			expect(spectrum.get("test", "del")).toBeUndefined()
		})

		it("returns false for missing memory", () => {
			expect(spectrum.delete("nope", "nada")).toBe(false)
		})
	})

	describe("search (keyword)", () => {
		it("finds by value content", async () => {
			await spectrum.save({ scope: "proj", key: "stack", value: "Next.js PostgreSQL Redis" })
			await spectrum.save({ scope: "proj", key: "orm", value: "Drizzle over Prisma" })

			const results = spectrum.search("postgresql")
			expect(results).toHaveLength(1)
			expect(results[0]?.memory.key).toBe("stack")
		})

		it("finds by key content", async () => {
			await spectrum.save({ scope: "proj", key: "database-config", value: "some value" })

			const results = spectrum.search("database")
			expect(results).toHaveLength(1)
		})

		it("scopes search results", async () => {
			await spectrum.save({ scope: "a", key: "item", value: "found" })
			await spectrum.save({ scope: "b", key: "item", value: "found" })

			const results = spectrum.search("found", "a")
			expect(results).toHaveLength(1)
			expect(results[0]?.memory.scope).toBe("a")
		})

		it("returns empty for no match", () => {
			expect(spectrum.search("xyznonexistent")).toEqual([])
		})
	})

	describe("listScopes", () => {
		it("lists all scopes with counts", async () => {
			await spectrum.save({ scope: "user", key: "a", value: "1" })
			await spectrum.save({ scope: "user", key: "b", value: "2" })
			await spectrum.save({ scope: "project:app", key: "c", value: "3" })

			const scopes = spectrum.listScopes()
			expect(scopes).toHaveLength(2)

			const user = scopes.find((s) => s.scope === "user")
			expect(user?.count).toBe(2)

			const proj = scopes.find((s) => s.scope === "project:app")
			expect(proj?.count).toBe(1)
		})
	})

	describe("stats", () => {
		it("returns database statistics", async () => {
			await spectrum.save({ scope: "test", key: "a", value: "1" })
			await spectrum.save({ scope: "test", key: "b", value: "2" })

			const stats = spectrum.stats()
			expect(stats.total_memories).toBe(2)
			expect(stats.total_scopes).toBe(1)
			expect(stats.db_size_bytes).toBeGreaterThan(0)
		})
	})
})

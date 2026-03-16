import { LocalEmbeddingProvider, NoopEmbeddingProvider } from "./embeddings.js"
import { SqliteStorage } from "./storage.js"
import type {
	EmbeddingProvider,
	ListOptions,
	Memory,
	MemoryInput,
	ScopeInfo,
	SearchResult,
	Stats,
	StorageProvider,
} from "./types.js"

export interface SpectrumOptions {
	dbPath?: string
	storage?: StorageProvider
	embeddings?: EmbeddingProvider
	semantic?: boolean
}

export class Spectrum {
	private storage: StorageProvider
	private embeddings: EmbeddingProvider

	constructor(options: SpectrumOptions = {}) {
		this.storage = options.storage ?? new SqliteStorage(options.dbPath)
		const semantic = options.semantic ?? true
		this.embeddings =
			options.embeddings ?? (semantic ? new LocalEmbeddingProvider() : new NoopEmbeddingProvider())
	}

	async save(input: MemoryInput): Promise<Memory> {
		let embedding: number[] | undefined
		if (this.embeddings.dimensions() > 0) {
			embedding = await this.embeddings.embed(input.value)
		}
		return this.storage.save(input, embedding)
	}

	get(scope: string, key: string): Memory | undefined {
		return this.storage.get(scope, key)
	}

	list(scope: string, options?: ListOptions): Memory[] {
		return this.storage.list(scope, options)
	}

	delete(scope: string, key: string): boolean {
		return this.storage.delete(scope, key)
	}

	search(query: string, scope?: string, limit?: number): SearchResult[] {
		return this.storage.search({ query, scope, limit })
	}

	async searchSemantic(
		query: string,
		scope?: string,
		limit?: number,
		threshold?: number,
	): Promise<SearchResult[]> {
		if (this.embeddings.dimensions() === 0) {
			return this.search(query, scope, limit)
		}
		const embedding = await this.embeddings.embed(query)
		return this.storage.searchSemantic(embedding, { query, scope, limit, threshold })
	}

	listScopes(): ScopeInfo[] {
		return this.storage.listScopes()
	}

	stats(): Stats {
		return this.storage.stats()
	}

	close(): void {
		this.storage.close()
	}
}

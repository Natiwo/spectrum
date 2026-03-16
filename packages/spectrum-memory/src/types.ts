export interface Memory {
	scope: string
	key: string
	value: string
	tags: string[]
	embedding?: number[]
	created_at: string
	updated_at: string
}

export interface MemoryInput {
	scope: string
	key: string
	value: string
	tags?: string[]
}

export interface SearchResult {
	memory: Memory
	score: number
	match_type: "keyword" | "semantic" | "hybrid"
}

export interface ListOptions {
	prefix?: string
	limit?: number
	offset?: number
}

export interface SearchOptions {
	query: string
	scope?: string
	limit?: number
}

export interface SemanticSearchOptions extends SearchOptions {
	threshold?: number
}

export interface ScopeInfo {
	scope: string
	count: number
}

export interface Stats {
	total_memories: number
	total_scopes: number
	db_size_bytes: number
}

export interface EmbeddingProvider {
	embed(text: string): Promise<number[]>
	embedBatch(texts: string[]): Promise<number[][]>
	dimensions(): number
}

export interface StorageProvider {
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

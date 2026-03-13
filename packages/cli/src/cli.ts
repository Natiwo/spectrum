import { Spectrum } from "@natiwo/spectrum"

const dbPath = process.env.SPECTRUM_DB_PATH || undefined
const memory = new Spectrum({ semantic: false, dbPath })

const [command, ...args] = process.argv.slice(2)

function printUsage(): void {
	console.log(`spm - Spectrum Memory CLI

Uso:
  spm save <scope/key> <value> [--tags tag1,tag2]
  spm get <scope/key>
  spm delete <scope/key>
  spm list <scope> [--prefix prefix] [--limit n]
  spm search <query> [--scope scope] [--semantic] [--limit n]
  spm scopes
  spm stats
  spm help

Exemplos:
  spm save user/nome "Meu nome é Claudio"
  spm save project:app/stack "Next.js 15, PostgreSQL" --tags stack,frontend
  spm get project:app/stack
  spm search "qual banco" --semantic
  spm list project:app
  spm scopes
  spm stats`)
}

function parseScopeKey(input: string): { scope: string; key: string } | null {
	const sep = input.lastIndexOf("/")
	if (sep === -1) return null
	return { scope: input.slice(0, sep), key: input.slice(sep + 1) }
}

function parseFlag(flagArgs: string[], flag: string): string | undefined {
	const idx = flagArgs.indexOf(flag)
	if (idx === -1 || idx + 1 >= flagArgs.length) return undefined
	return flagArgs[idx + 1]
}

function requireScopeKey(path: string | undefined, cmd: string): { scope: string; key: string } {
	if (!path) {
		console.error(`Erro: spm ${cmd} <scope/key>`)
		process.exit(1)
	}
	const parsed = parseScopeKey(path)
	if (!parsed) {
		console.error("Erro: formato deve ser scope/key (ex: user/nome)")
		process.exit(1)
	}
	return parsed
}

async function cmdSave(): Promise<void> {
	const parsed = requireScopeKey(args[0], "save")
	const value = args[1]
	if (!value) {
		console.error("Erro: spm save <scope/key> <value>")
		process.exit(1)
	}
	const tagsRaw = parseFlag(args, "--tags")
	const tags = tagsRaw ? tagsRaw.split(",").map((t) => t.trim()) : undefined
	const result = await memory.save({ ...parsed, value, tags })
	console.log(`Salvo: ${result.scope}/${result.key}`)
}

function cmdGet(): void {
	const parsed = requireScopeKey(args[0], "get")
	const result = memory.get(parsed.scope, parsed.key)
	if (!result) {
		console.error("Não encontrado")
		process.exit(1)
	}
	console.log(result.value)
	if (result.tags.length > 0) {
		console.log(`\nTags: ${result.tags.join(", ")}`)
	}
	console.log(`\nAtualizado: ${result.updated_at}`)
}

function cmdDelete(): void {
	const parsed = requireScopeKey(args[0], "delete")
	const deleted = memory.delete(parsed.scope, parsed.key)
	console.log(deleted ? "Deletado" : "Não encontrado")
}

function cmdList(): void {
	const scope = args[0]
	if (!scope) {
		console.error("Erro: spm list <scope>")
		process.exit(1)
	}
	const prefix = parseFlag(args, "--prefix")
	const limitStr = parseFlag(args, "--limit")
	const limit = limitStr ? Number.parseInt(limitStr, 10) : undefined
	const results = memory.list(scope, { prefix, limit })
	if (results.length === 0) {
		console.log("Nenhuma memória nesse scope")
		return
	}
	for (const m of results) {
		const tags = m.tags.length > 0 ? ` [${m.tags.join(", ")}]` : ""
		console.log(`${m.scope}/${m.key}${tags}`)
		console.log(`  ${m.value.slice(0, 120)}${m.value.length > 120 ? "..." : ""}`)
		console.log()
	}
	console.log(`Total: ${results.length}`)
}

async function cmdSearch(): Promise<void> {
	const query = args[0]
	if (!query) {
		console.error("Erro: spm search <query>")
		process.exit(1)
	}
	const scope = parseFlag(args, "--scope")
	const limitStr = parseFlag(args, "--limit")
	const limit = limitStr ? Number.parseInt(limitStr, 10) : undefined
	const isSemantic = args.includes("--semantic")

	const results = isSemantic
		? await memory.searchSemantic(query, scope, limit)
		: memory.search(query, scope, limit)

	if (results.length === 0) {
		console.log("Nenhum resultado")
		return
	}
	for (const r of results) {
		const score = r.score.toFixed(2)
		console.log(`[${score}] ${r.memory.scope}/${r.memory.key} (${r.match_type})`)
		console.log(`  ${r.memory.value.slice(0, 120)}${r.memory.value.length > 120 ? "..." : ""}`)
		console.log()
	}
	console.log(`Total: ${results.length}`)
}

function cmdScopes(): void {
	const scopes = memory.listScopes()
	if (scopes.length === 0) {
		console.log("Nenhum scope")
		return
	}
	for (const s of scopes) {
		console.log(`${s.scope} (${s.count})`)
	}
	console.log(`\nTotal: ${scopes.length} scopes`)
}

function cmdStats(): void {
	const stats = memory.stats()
	console.log(`Memórias: ${stats.total_memories}`)
	console.log(`Scopes: ${stats.total_scopes}`)
	console.log(`Banco: ${(stats.db_size_bytes / 1024).toFixed(1)} KB`)
}

const commands: Record<string, () => void | Promise<void>> = {
	save: cmdSave,
	get: cmdGet,
	delete: cmdDelete,
	list: cmdList,
	search: cmdSearch,
	scopes: cmdScopes,
	stats: cmdStats,
}

async function main(): Promise<void> {
	if (!command || command === "help" || command === "--help" || command === "-h") {
		printUsage()
		process.exit(0)
	}

	const handler = commands[command]
	if (!handler) {
		console.error(`Comando desconhecido: ${command}`)
		printUsage()
		process.exit(1)
	}

	await handler()
	memory.close()
}

main().catch((err) => {
	console.error(err)
	process.exit(1)
})

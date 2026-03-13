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

function parseFlag(args: string[], flag: string): string | undefined {
	const idx = args.indexOf(flag)
	if (idx === -1 || idx + 1 >= args.length) return undefined
	return args[idx + 1]
}

function hasFlag(args: string[], flag: string): boolean {
	return args.includes(flag)
}

async function main(): Promise<void> {
	if (!command || command === "help" || command === "--help" || command === "-h") {
		printUsage()
		process.exit(0)
	}

	switch (command) {
		case "save": {
			const path = args[0]
			const value = args[1]
			if (!path || !value) {
				console.error("Erro: spm save <scope/key> <value>")
				process.exit(1)
			}
			const parsed = parseScopeKey(path)
			if (!parsed) {
				console.error("Erro: formato deve ser scope/key (ex: user/nome)")
				process.exit(1)
			}
			const tagsRaw = parseFlag(args, "--tags")
			const tags = tagsRaw ? tagsRaw.split(",").map((t) => t.trim()) : undefined
			const result = await memory.save({ ...parsed, value, tags })
			console.log(`Salvo: ${result.scope}/${result.key}`)
			break
		}

		case "get": {
			const path = args[0]
			if (!path) {
				console.error("Erro: spm get <scope/key>")
				process.exit(1)
			}
			const parsed = parseScopeKey(path)
			if (!parsed) {
				console.error("Erro: formato deve ser scope/key")
				process.exit(1)
			}
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
			break
		}

		case "delete": {
			const path = args[0]
			if (!path) {
				console.error("Erro: spm delete <scope/key>")
				process.exit(1)
			}
			const parsed = parseScopeKey(path)
			if (!parsed) {
				console.error("Erro: formato deve ser scope/key")
				process.exit(1)
			}
			const deleted = memory.delete(parsed.scope, parsed.key)
			console.log(deleted ? "Deletado" : "Não encontrado")
			break
		}

		case "list": {
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
				break
			}
			for (const m of results) {
				const tags = m.tags.length > 0 ? ` [${m.tags.join(", ")}]` : ""
				console.log(`${m.scope}/${m.key}${tags}`)
				console.log(`  ${m.value.slice(0, 120)}${m.value.length > 120 ? "..." : ""}`)
				console.log()
			}
			console.log(`Total: ${results.length}`)
			break
		}

		case "search": {
			const query = args[0]
			if (!query) {
				console.error("Erro: spm search <query>")
				process.exit(1)
			}
			const scope = parseFlag(args, "--scope")
			const limitStr = parseFlag(args, "--limit")
			const limit = limitStr ? Number.parseInt(limitStr, 10) : undefined
			const isSemantic = hasFlag(args, "--semantic")

			const results = isSemantic
				? await memory.searchSemantic(query, scope, limit)
				: memory.search(query, scope, limit)

			if (results.length === 0) {
				console.log("Nenhum resultado")
				break
			}
			for (const r of results) {
				const score = r.score.toFixed(2)
				console.log(`[${score}] ${r.memory.scope}/${r.memory.key} (${r.match_type})`)
				console.log(`  ${r.memory.value.slice(0, 120)}${r.memory.value.length > 120 ? "..." : ""}`)
				console.log()
			}
			console.log(`Total: ${results.length}`)
			break
		}

		case "scopes": {
			const scopes = memory.listScopes()
			if (scopes.length === 0) {
				console.log("Nenhum scope")
				break
			}
			for (const s of scopes) {
				console.log(`${s.scope} (${s.count})`)
			}
			console.log(`\nTotal: ${scopes.length} scopes`)
			break
		}

		case "stats": {
			const stats = memory.stats()
			console.log(`Memórias: ${stats.total_memories}`)
			console.log(`Scopes: ${stats.total_scopes}`)
			console.log(`Banco: ${(stats.db_size_bytes / 1024).toFixed(1)} KB`)
			break
		}

		default:
			console.error(`Comando desconhecido: ${command}`)
			printUsage()
			process.exit(1)
	}

	memory.close()
}

main().catch((err) => {
	console.error(err)
	process.exit(1)
})

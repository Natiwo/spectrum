import type { EmbeddingProvider } from "./types.js"

let pipelineInstance: unknown = null

async function getPipeline(): Promise<unknown> {
	if (pipelineInstance) return pipelineInstance
	const { pipeline } = await import("@huggingface/transformers")
	pipelineInstance = await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2", {
		dtype: "fp32",
	})
	return pipelineInstance
}

export class LocalEmbeddingProvider implements EmbeddingProvider {
	dimensions(): number {
		return 384
	}

	async embed(text: string): Promise<number[]> {
		const pipe = (await getPipeline()) as (
			input: string,
			options: { pooling: string; normalize: boolean },
		) => Promise<{ tolist(): number[][] }>

		const result = await pipe(text, { pooling: "mean", normalize: true })
		const vectors = result.tolist()
		return vectors[0] ?? []
	}

	async embedBatch(texts: string[]): Promise<number[][]> {
		const results: number[][] = []
		for (const text of texts) {
			results.push(await this.embed(text))
		}
		return results
	}
}

export class NoopEmbeddingProvider implements EmbeddingProvider {
	dimensions(): number {
		return 0
	}

	async embed(_text: string): Promise<number[]> {
		return []
	}

	async embedBatch(texts: string[]): Promise<number[][]> {
		return texts.map(() => [])
	}
}

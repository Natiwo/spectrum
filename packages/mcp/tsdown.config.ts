import { defineConfig } from "tsdown"

export default defineConfig({
	entry: ["src/server.ts"],
	format: ["esm"],
	clean: true,
	external: ["@huggingface/transformers"],
	outputOptions: {
		banner: "#!/usr/bin/env node",
	},
})

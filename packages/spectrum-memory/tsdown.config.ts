import { defineConfig } from "tsdown"

export default defineConfig({
	entry: {
		index: "src/index.ts",
		cli: "src/cli.ts",
		server: "src/server.ts",
	},
	format: ["esm", "cjs"],
	dts: { entry: "src/index.ts" },
	clean: true,
	hash: false,
	external: ["@huggingface/transformers"],
})

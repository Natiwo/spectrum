import { defineConfig } from "tsdown"

export default defineConfig({
	entry: ["src/server.ts"],
	format: ["esm"],
	clean: true,
	banner: { js: "#!/usr/bin/env node" },
	external: ["@huggingface/transformers"],
})

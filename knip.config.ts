import type { KnipConfig } from "knip"

const config: KnipConfig = {
	ignoreBinaries: ["gitleaks"],
	ignoreDependencies: ["@vitest/coverage-v8"],
	workspaces: {
		"packages/core": {
			project: ["src/**/*.ts"],
		},
		"packages/cli": {
			project: ["src/**/*.ts"],
		},
		"packages/mcp": {
			project: ["src/**/*.ts"],
		},
	},
}

export default config

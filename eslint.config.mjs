// ESLint flat config using the official Obsidian plugin guidelines
// (https://github.com/obsidianmd/eslint-plugin) plus typescript-eslint's
// strict-type-checked preset (adopted 2026-08-10)
import { defineConfig } from "eslint/config";
import obsidianmd from "eslint-plugin-obsidianmd";
import tseslint from "typescript-eslint";

export default defineConfig([
	...obsidianmd.configs.recommended,
	...tseslint.configs.strictTypeChecked,
	{
		files: ["**/*.ts"],
		languageOptions: {
			parser: tseslint.parser,
			parserOptions: { project: "./tsconfig.json" },
		},
		rules: {
			// numbers interpolate losslessly; everything else stays strict
			"@typescript-eslint/restrict-template-expressions": [
				"error",
				{ allowNumber: true },
			],
		},
	},
	{
		ignores: ["node_modules/**", "main.js", "scripts/**", "tests/**"],
	},
]);

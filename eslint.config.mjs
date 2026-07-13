// ESLint flat config using the official Obsidian plugin guidelines
// (https://github.com/obsidianmd/eslint-plugin)
import tsparser from "@typescript-eslint/parser";
import { defineConfig } from "eslint/config";
import obsidianmd from "eslint-plugin-obsidianmd";

export default defineConfig([
	...obsidianmd.configs.recommended,
	{
		files: ["**/*.ts"],
		languageOptions: {
			parser: tsparser,
			parserOptions: { project: "./tsconfig.json" },
		},
	},
	{
		ignores: ["node_modules/**", "main.js", "scripts/**", "tests/**"],
	},
]);

// Runtime stand-in for the types-only `obsidian` package (its package.json
// has `"main": ""`), aliased in vitest.config.ts so unit tests can import
// modules that pull it in. Only names touched at module scope need real
// values; the editor-driving code paths are covered by the smoke tests, not
// unit tests, so these stubs are never exercised beyond existing.
export class Plugin {}
export class MarkdownView {}
export class PluginSettingTab {}
export class Setting {}
export class Notice {}
export function addIcon() {}

// Runtime stand-in for the types-only `obsidian` package (its package.json
// has `"main": ""`), aliased in vitest.config.ts so unit tests can import
// modules that pull it in. Only names touched at module scope need real
// values; the editor-driving code paths are covered by the smoke tests, not
// unit tests, so these stubs are never exercised beyond existing.
export class Plugin {}
export class Modal {}
export class MarkdownView {}
export class PluginSettingTab {}
export class Setting {}
// Self-recording: tests assert on toasts via `noticeCalls` instead of
// vi.mock("obsidian") — module mocking breaks under `isolate: false`
// (vitest.config.ts), because modules already imported by earlier test
// files in the worker keep their reference to the ORIGINAL Notice, so a
// per-file mock is never wired in. Call noticeCalls.length = 0 before
// asserting.
export const noticeCalls: unknown[][] = [];
export class Notice {
    constructor(...args: unknown[]) {
        noticeCalls.push(args);
    }
    hide() {}
}
export function addIcon() {}

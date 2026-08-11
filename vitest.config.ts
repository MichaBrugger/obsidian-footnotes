import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
    resolve: {
        alias: {
            // the obsidian package is type definitions only; unit tests get
            // a minimal runtime stub instead (see test/mocks/obsidian.ts)
            obsidian: fileURLToPath(new URL("test/mocks/obsidian.ts", import.meta.url)),
        },
    },
    test: {
        include: ["test/**/*.test.ts"],
        // fresh-worker isolation per test file cost 5.5x wall time
        // (17.6s → 3.2s measured 2026-08-10) and buys nothing here: the
        // suite tests pure functions. Caveat to remember: module-level
        // state (footnote-popup's activePopup, linter's hookedVim) now
        // persists across test FILES in a worker — a test that leaves such
        // state dirty can bleed into another file; reset it in the test.
        isolate: false,
    },
});

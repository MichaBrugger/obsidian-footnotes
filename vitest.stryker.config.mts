import { defineConfig, mergeConfig } from "vitest/config";

import base from "./vitest.config.mjs";

// Stryker's perTest coverage analysis attributes coverage per test via
// worker-level bookkeeping that shared workers corrupt: under the main
// config's `isolate: false` a verification run reported phantom
// no-coverage and zero kills (observed 2026-08-10). Mutation runs pay for
// isolation; the interactive suite keeps its 5.5x speedup.
// test/perf/ holds timing pins (masking linear on long lines, the append
// above an unclosed opener): instrumented code runs several times slower
// than plain vitest and failed them in the dry run, aborting the audit
// (2026-09-09) - the behavioral halves of those pins live in test/hunt/.
export default mergeConfig(
    base,
    defineConfig({ test: { isolate: true, exclude: ["**/node_modules/**", "test/perf/**"] } }),
);

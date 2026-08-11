import { defineConfig, mergeConfig } from "vitest/config";

import base from "./vitest.config";

// Stryker's perTest coverage analysis attributes coverage per test via
// worker-level bookkeeping that shared workers corrupt: under the main
// config's `isolate: false` a verification run reported phantom
// no-coverage and zero kills (observed 2026-08-10). Mutation runs pay for
// isolation; the interactive suite keeps its 5.5x speedup.
export default mergeConfig(
    base,
    defineConfig({ test: { isolate: true } }),
);

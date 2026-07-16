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
    },
});

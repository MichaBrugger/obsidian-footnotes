import { App } from "obsidian";
import { describe, expect, it } from "vitest";

import { ensureTextPropertyType } from "../src/obsidian-internals";

// Reported 2026-08-12: the vault registered footnote-prefix as a NUMBER
// property — Obsidian infers an unassigned property's type from its
// occurrences, and numeric-looking prefixes like "2." taught it wrong,
// after which the Properties panel coerced edits numerically. The plugin
// pins the type to "text" explicitly (modal write + layout-ready while the
// prefix feature is on) through the undocumented metadataTypeManager,
// degrading to a no-op when the registry is missing or throws.

function fakeApp(widget: string | undefined) {
    const setCalls: [string, string][] = [];
    const app = {
        metadataTypeManager: {
            getPropertyInfo: (name: string) =>
                widget === undefined ? undefined : { name, widget },
            setType: (name: string, type: string) => {
                setCalls.push([name, type]);
            },
        },
    } as unknown as App;
    return { app, setCalls };
}

describe("ensureTextPropertyType", () => {
    it("assigns text when the property was inferred as a number", () => {
        const { app, setCalls } = fakeApp("number");
        ensureTextPropertyType(app, "footnote-prefix");
        expect(setCalls).toEqual([["footnote-prefix", "text"]]);
    });

    it("assigns text when the property has no registered type yet", () => {
        const { app, setCalls } = fakeApp(undefined);
        ensureTextPropertyType(app, "footnote-prefix");
        expect(setCalls).toEqual([["footnote-prefix", "text"]]);
    });

    it("does nothing when the type is already text", () => {
        const { app, setCalls } = fakeApp("text");
        ensureTextPropertyType(app, "footnote-prefix");
        expect(setCalls).toEqual([]);
    });

    it("survives a missing registry", () => {
        expect(() =>
            ensureTextPropertyType({} as unknown as App, "footnote-prefix"),
        ).not.toThrow();
    });

    it("survives a registry whose setType throws", () => {
        const app = {
            metadataTypeManager: {
                setType: () => {
                    throw new Error("shape changed");
                },
            },
        } as unknown as App;
        expect(() =>
            ensureTextPropertyType(app, "footnote-prefix"),
        ).not.toThrow();
    });
});

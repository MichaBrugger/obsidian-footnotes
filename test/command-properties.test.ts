import { Editor, EditorChange, EditorPosition } from "obsidian";
import fc from "fast-check";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { docArb } from "./arbitraries";
import FootnotePlugin from "../src/main";
import {
    insertAutonumFootnote,
    insertInlineFootnote,
    insertNamedFootnote,
    pasteInlineFootnote,
} from "../src/insert-or-navigate-footnotes";
import { orphanedFootnoteDefinitionNames } from "../src/linting/rules/remove-orphaned-definitions";
import { orphanedFootnoteReferenceNames } from "../src/linting/rules/remove-orphaned-references";
import { normalizeEol, scanDocument } from "../src/markdown-scan";

// Property tests for the CREATION COMMANDS (2026-08-12, Jason's ask):
// the same document generator that fuzzes the lint transforms drives the
// four real command entry points against a transaction-APPLYING fake
// editor, at randomly generated caret positions and settings. What the
// transform properties are to the rules, these are to the press cascade.
// Out of scope by construction (smoke territory): the popup editor, table
// cell sub-editors, and Reading view — the fake has no `cm` and no modes.

fc.configureGlobal({ numRuns: Number(process.env.FC_NUM_RUNS ?? 200) });
const SOAK_TIMEOUT = Math.max(30_000, Number(process.env.FC_NUM_RUNS ?? 200) * 60);
const soakIt = (name: string, fn: () => Promise<void>) =>
    it(name, fn, SOAK_TIMEOUT);

// ---------- a fake editor that APPLIES its transactions ----------

interface PressDoc extends Editor {
    lines: string[];
    cursor: EditorPosition;
}

// every change in one transaction addresses the ORIGINAL document
// (CodeMirror semantics — the commands rely on this for the
// reference+definition+prepend bundles), so apply back-to-front
function applyChanges(lines: string[], changes: EditorChange[]): string[] {
    const text = lines.join("\n");
    const offsetOf = (pos: EditorPosition): number => {
        let offset = 0;
        for (let i = 0; i < pos.line && i < lines.length; i++) {
            offset += lines[i].length + 1;
        }
        return offset + pos.ch;
    };
    const resolved = changes
        .map((change, index) => ({
            from: offsetOf(change.from),
            to: change.to ? offsetOf(change.to) : offsetOf(change.from),
            text: change.text ?? "",
            index,
        }))
        // same-position insertions concatenate in change order (CodeMirror
        // semantics), so back-to-front ties apply the later change first
        .sort((a, b) => b.from - a.from || b.index - a.index);
    let out = text;
    for (const change of resolved) {
        out = out.slice(0, change.from) + change.text + out.slice(change.to);
    }
    return out.split("\n");
}

function pressEditor(lines: string[], cursor: EditorPosition): PressDoc {
    const doc = {
        lines: lines.slice(),
        cursor,
        getCursor: () => doc.cursor,
        getLine: (n: number) => doc.lines[n],
        getValue: () => doc.lines.join("\n"),
        lineCount: () => doc.lines.length,
        lastLine: () => doc.lines.length - 1,
        setCursor(pos: EditorPosition) {
            doc.cursor = pos;
        },
        // the end-of-word setting reads Editor.wordAt — a word-char run
        // around the caret, or null (unit harnesses kept the setting off
        // and never needed it; the press generator varies it)
        wordAt(pos: EditorPosition) {
            const line = doc.lines[pos.line] ?? "";
            const isWord = (c: string | undefined) =>
                !!c && /[\p{L}\p{N}_]/u.test(c);
            let start = pos.ch;
            if (!isWord(line[start]) && isWord(line[start - 1])) start--;
            if (!isWord(line[start])) return null;
            let end = start;
            while (isWord(line[start - 1])) start--;
            while (isWord(line[end])) end++;
            return {
                from: { line: pos.line, ch: start },
                to: { line: pos.line, ch: end },
            };
        },
        scrollIntoView() {},
        transaction(spec: {
            changes?: EditorChange[];
            selection?: { from: EditorPosition };
        }) {
            if (spec.changes) doc.lines = applyChanges(doc.lines, spec.changes);
            if (spec.selection) doc.cursor = spec.selection.from;
        },
    };
    return doc as unknown as PressDoc;
}

interface PressSettings {
    insertAtEndOfWord: boolean;
    enableFootnoteSectionHeading: boolean;
    enableRemoveBlankLastLines: boolean;
}

function fakePlugin(doc: PressDoc, settings: PressSettings): FootnotePlugin {
    return {
        app: {
            workspace: { getActiveViewOfType: () => ({ editor: doc }) },
            vault: {},
        },
        settings: {
            ...settings,
            footnoteSectionHeading: "# Footnotes",
            enablePopupEditor: false,
            enableFootnotePrefix: false,
            lintOnFootnoteCreation: false,
        },
    } as unknown as FootnotePlugin;
}

// ---------- the generated press ----------

const COMMANDS = {
    autonum: insertAutonumFootnote,
    named: insertNamedFootnote,
    inline: insertInlineFootnote,
    paste: pasteInlineFootnote,
} as const;
type CommandName = keyof typeof COMMANDS;

const settingsArb: fc.Arbitrary<PressSettings> = fc.record({
    insertAtEndOfWord: fc.boolean(),
    enableFootnoteSectionHeading: fc.boolean(),
    enableRemoveBlankLastLines: fc.boolean(),
});

// a doc, a caret somewhere inside it (line/ch picked by modulo so shrinking
// stays meaningful), a command, and the settings that shape insertion
const pressArb = fc
    .tuple(
        docArb,
        fc.nat(1000),
        fc.nat(1000),
        fc.constantFrom<CommandName>("autonum", "named", "inline", "paste"),
        settingsArb,
    )
    .map(([doc, linePick, chPick, command, settings]) => {
        // the editor layer is always LF — EOL round-tripping belongs to the
        // file layer the transform properties cover
        const lines = normalizeEol(doc).text.split("\n");
        const line = linePick % lines.length;
        const ch = chPick % (lines[line].length + 1);
        return { lines, cursor: { line, ch }, command, settings };
    });

async function press(
    lines: string[],
    cursor: EditorPosition,
    command: CommandName,
    settings: PressSettings,
): Promise<PressDoc> {
    const doc = pressEditor(lines, cursor);
    await COMMANDS[command](fakePlugin(doc, settings));
    return doc;
}

// ---------- counting helpers ----------

// RAW reference-shaped substrings ("[^name]", labels included), counted
// context-free: a press can legitimately RECLASSIFY surrounding markdown
// exactly like typing would (inserting at a heading's column 0 demotes it,
// filling the blank line above an indented chunk makes the chunk a lazy
// continuation), so masked counts can jump in ways no contract can bound —
// but the raw shapes the press physically ADDS to the text are exact.
const RawReferenceShape = /\[\^[^[\]\n]+\]/g;

function rawShapeCount(lines: string[]): number {
    return lines.join("\n").match(RawReferenceShape)?.length ?? 0;
}

/** Every reference-shaped name in the raw text, folded — live, masked, escaped, or label. */
function rawNamesFolded(lines: string[]): Set<string> {
    const names = new Set<string>();
    for (const match of lines.join("\n").matchAll(RawReferenceShape)) {
        names.add(match[0].slice(2, -1).toLowerCase());
    }
    return names;
}

// raw shapes each command's cascade may physically add: nothing (guard/
// toast/hop/navigation), a definition label for a definition-less
// reference (every command via its navigate step), or — autonum only — a
// reference AND its label together
const ALLOWED_SHAPE_DELTAS: Record<CommandName, number[]> = {
    autonum: [0, 1, 2],
    named: [0, 1],
    inline: [0, 1],
    paste: [0, 1],
};

beforeAll(() => {
    vi.stubGlobal("navigator", {
        clipboard: { readText: async () => "generated clipboard text" },
    });
});
afterAll(() => {
    vi.unstubAllGlobals();
});

describe("creation-command invariants over random documents", () => {
    soakIt("a press never throws and never loses a protected line", async () => {
        await fc.assert(
            fc.asyncProperty(pressArb, async ({ lines, cursor, command, settings }) => {
                const protectedBefore = scanDocument(lines).isProtected;
                const doc = await press(lines, cursor, command, settings);
                // multiset conservation, like the lint property: protected
                // text is never edited, only ever shifted whole
                const counts = new Map<string, number>();
                for (const line of doc.lines) {
                    counts.set(line, (counts.get(line) ?? 0) + 1);
                }
                for (let i = 0; i < lines.length; i++) {
                    if (!protectedBefore[i]) continue;
                    const left = counts.get(lines[i]) ?? 0;
                    expect(
                        left,
                        `protected line lost: ${JSON.stringify(lines[i])}`,
                    ).toBeGreaterThan(0);
                    counts.set(lines[i], left - 1);
                }
            }),
        );
    });

    soakIt("a press with the caret on a protected line edits nothing", async () => {
        await fc.assert(
            fc.asyncProperty(pressArb, async ({ lines, cursor, command, settings }) => {
                if (!scanDocument(lines).isProtected[cursor.line]) return;
                const doc = await press(lines, cursor, command, settings);
                // the CURSOR may still move: a protected math/comment
                // interior can be a definition block's continuation, and
                // jumping back to the reference from there is by design
                expect(doc.lines.join("\n")).toBe(lines.join("\n"));
            }),
        );
    });

    soakIt("raw-shape deltas stay inside each command's contract", async () => {
        await fc.assert(
            fc.asyncProperty(pressArb, async ({ lines, cursor, command, settings }) => {
                const shapesBefore = rawShapeCount(lines);
                // a caret strictly inside an existing raw shape (an escaped
                // "\[^80]" is lifeless text no guard owns) lets the
                // insertion SPLIT that shape — one extra allowed -1
                let insideShape = false;
                for (const match of lines[cursor.line].matchAll(RawReferenceShape)) {
                    const start = match.index;
                    if (cursor.ch > start && cursor.ch < start + match[0].length) {
                        insideShape = true;
                    }
                }
                const doc = await press(lines, cursor, command, settings);
                const delta = rawShapeCount(doc.lines) - shapesBefore;
                const allowed = insideShape
                    ? [
                          ...ALLOWED_SHAPE_DELTAS[command],
                          ...ALLOWED_SHAPE_DELTAS[command].map((d) => d - 1),
                      ]
                    : ALLOWED_SHAPE_DELTAS[command];
                expect(
                    allowed,
                    `${command} produced raw-shape delta ${delta}`,
                ).toContain(delta);
            }),
        );
    });

    soakIt("a press never mints an orphan of ITS OWN making", async () => {
        // reclassifying pre-existing text is a text editor's reality (see
        // rawShapeCount) — but any orphaned reference or definition whose
        // name did not exist ANYWHERE in the raw before-text must have been
        // created dead by the press itself (the escaped-"[^N]" and
        // "^"-swallowed insertion bugs this suite caught)
        await fc.assert(
            fc.asyncProperty(pressArb, async ({ lines, cursor, command, settings }) => {
                const namesBefore = rawNamesFolded(lines);
                const doc = await press(lines, cursor, command, settings);
                const after = doc.lines.join("\n");
                for (const name of orphanedFootnoteReferenceNames(after)) {
                    expect(
                        namesBefore.has(name.toLowerCase()),
                        `press minted dead reference [^${name}]`,
                    ).toBe(true);
                }
                for (const name of orphanedFootnoteDefinitionNames(after)) {
                    expect(
                        namesBefore.has(name.toLowerCase()),
                        `press minted orphaned definition [^${name}]:`,
                    ).toBe(true);
                }
            }),
        );
    });

    soakIt("two consecutive presses never nest footnote brackets", async () => {
        await fc.assert(
            fc.asyncProperty(
                pressArb,
                fc.constantFrom<CommandName>("autonum", "named", "inline", "paste"),
                async ({ lines, cursor, command, settings }, secondCommand) => {
                    const cleanBefore = !lines.join("\n").includes("[^[^");
                    const doc = await press(lines, cursor, command, settings);
                    // the second press continues from wherever the first
                    // left the caret — the rapid-double-press shape that
                    // produced "[^[^]]" nesting historically
                    await COMMANDS[secondCommand](fakePlugin(doc, settings));
                    if (cleanBefore) {
                        expect(doc.lines.join("\n")).not.toContain("[^[^");
                    }
                },
            ),
        );
    });
});

import { Editor, EditorChange, EditorPosition } from "obsidian";
import fc from "fast-check";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { docArb } from "./arbitraries";
import { noticeCalls } from "./mocks/obsidian";
import { resetNotices } from "./helpers/notices";
import { fakePlugin as sharedFakePlugin } from "./helpers/fake-plugin";
import FootnotePlugin from "../src/main";
import {
    indentDefinitionBody,
    InlineSelectionNotice,
    SelectionCommandNotice,
    SelectionSpanNotice,
    trimSelectionEdges,
} from "../src/commands/selection-footnote";
import { footnoteNameProblem } from "../src/parsing/footnote-grammar";
import {
    inlineFootnoteSpanAt,
    sanitizeInlineFootnoteContent,
} from "../src/commands/inline-footnotes";
import {
    insertAutonumFootnote,
    insertInlineFootnote,
    insertNamedFootnote,
    pasteInlineFootnote,
} from "../src/commands/insert-or-navigate-footnotes";
import { orphanedFootnoteDefinitionNames } from "../src/linting/rules/remove-orphaned-definitions";
import { orphanedFootnoteReferenceNames } from "../src/linting/rules/remove-orphaned-references";
import {
    findDefinitionBlocks,
    normalizeEol,
    scanDocument,
} from "../src/parsing/markdown-scan";

// Property tests for the CREATION COMMANDS (2026-08-12, Jason's ask):
// the same document generator that fuzzes the lint transforms drives the
// four real command entry points against a transaction-APPLYING fake
// editor, at randomly generated caret positions and settings. What the
// transform properties are to the rules, these are to the press cascade.
// Out of scope by construction (smoke territory): the popup editor, table
// cell sub-editors, and Reading view - the fake has no `cm` and no modes.

fc.configureGlobal({ numRuns: Number(process.env.FC_NUM_RUNS ?? 200) });
const SOAK_TIMEOUT = Math.max(30_000, Number(process.env.FC_NUM_RUNS ?? 200) * 60);
const soakIt = (name: string, fn: () => Promise<void>) =>
    { it(name, fn, SOAK_TIMEOUT); };

// ---------- a fake editor that APPLIES its transactions ----------

interface PressDoc extends Editor {
    lines: string[];
    cursor: EditorPosition;
}

// every change in one transaction addresses the ORIGINAL document
// (CodeMirror semantics - the commands rely on this for the
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
            text: change.text,
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

function pressEditor(
    lines: string[],
    cursor: EditorPosition,
    // a live selection for the conversion properties (issue #35); the
    // caret-press properties leave it collapsed
    selection?: { anchor: EditorPosition; head: EditorPosition },
): PressDoc {
    const doc = {
        lines: lines.slice(),
        cursor,
        getCursor: () => doc.cursor,
        listSelections: () =>
            selection ? [selection] : [{ anchor: doc.cursor, head: doc.cursor }],
        getLine: (n: number) => doc.lines[n],
        getValue: () => doc.lines.join("\n"),
        lineCount: () => doc.lines.length,
        lastLine: () => doc.lines.length - 1,
        setCursor(pos: EditorPosition) {
            doc.cursor = pos;
        },
        // the end-of-word setting reads Editor.wordAt - a word-char run
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
    return sharedFakePlugin(
        {
            ...settings,
            footnoteSectionHeading: "# Footnotes",
            enablePopupEditor: false,
            enableFootnotePrefix: false,
            lintOnFootnoteCreation: false,
        },
        doc,
    );
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
        // the editor layer is always LF - EOL round-tripping belongs to the
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
// continuation), so masked counts can jump in ways no contract can bound -
// but the raw shapes the press physically ADDS to the text are exact.
const RawReferenceShape = /\[\^[^[\]\n]+\]/g;

function rawShapeCount(lines: string[]): number {
    return lines.join("\n").match(RawReferenceShape)?.length ?? 0;
}

/** Every reference-shaped name in the raw text, folded - live, masked, escaped, or label. */
function rawNamesFolded(lines: string[]): Set<string> {
    const names = new Set<string>();
    for (const match of lines.join("\n").matchAll(RawReferenceShape)) {
        names.add(match[0].slice(2, -1).toLowerCase());
    }
    return names;
}

// raw shapes each command's cascade may physically add: nothing (guard/
// toast/hop/navigation), a definition label for a definition-less
// reference (every command via its navigate step), or - autonum only - a
// reference AND its label together
const ALLOWED_SHAPE_DELTAS: Record<CommandName, number[]> = {
    autonum: [0, 1, 2],
    named: [0, 1],
    inline: [0, 1],
    paste: [0, 1],
};

// the paste command reads THIS on every press - the invariant properties
// keep the benign default so their contracts stay tight, and the dedicated
// hostile-clipboard property swaps in generated strings per run
let clipboardText = "generated clipboard text";
beforeAll(() => {
    vi.stubGlobal("navigator", {
        clipboard: { readText: () => Promise.resolve(clipboardText) },
    });
});
afterAll(() => {
    vi.unstubAllGlobals();
});

// ---------- typed content (Jason's ask 2026-08-12: fuzz the INSIDES) ----------

/** Splice `text` at the caret, exactly like typing - the caret rides to the end of it. */
function typeText(doc: PressDoc, text: string) {
    const { line, ch } = doc.cursor;
    const current = doc.lines[line];
    doc.lines[line] = current.slice(0, ch) + text + current.slice(ch);
    doc.cursor = { line, ch: ch + text.length };
}

/** Whether the press just planted `placeholder` with the caret sitting one short of its closing bracket ("[^]" for named, "^[]" for inline). */
function plantedPlaceholder(doc: PressDoc, placeholder: string): boolean {
    const line = doc.lines[doc.cursor.line] ?? "";
    return (
        line.slice(doc.cursor.ch - 2, doc.cursor.ch + 1) === placeholder
    );
}

function definitionNamesFolded(lines: string[]): Set<string> {
    const scan = scanDocument(lines);
    return new Set(
        findDefinitionBlocks(lines, scan.isProtected, scan).map((block) =>
            block.name.toLowerCase(),
        ),
    );
}

// names a user might type into the "[^]" placeholder: pool names that
// collide with the generator's own definitions (case variants included),
// fresh names the document has never seen, deliberately INVALID names
// (spaces, backticks - warned about, never created), and random word-ish
// strings
const typedNameArb = fc.oneof(
    fc.constantFrom("note", "Note", "9", "a$1", "ch-2", "x"),
    fc.constantFrom("fresh", "Fresh-Name", "注釈", "x.y", "$start"),
    fc.constantFrom("bad name", "tick`name", "#tag", "a#b"),
    fc
        .string({ minLength: 1, maxLength: 12 })
        .map((s) => s.replace(/[[\]\s`\\^$\n\r]/g, ""))
        .filter((s) => s.length > 0),
);

// bodies a user might type after the label / between inline brackets -
// bracketless random text plus a few deliberate balanced-bracket shapes
// (dollars and backslashes excluded here: a stray "$" pairing with later
// line text or a trailing "\" changes the SURROUNDING structure, which is
// the swallow-guards' territory, not the typing flow's)
const typedBodyArb = fc.oneof(
    fc.constantFrom(
        "a quick aside",
        "see [link](https://example.org) for more",
        "中文注释内容",
        "",
    ),
    fc
        .string({ maxLength: 24 })
        .map((s) => s.replace(/[[\]`\\^$\n\r]/g, " ").trim()),
);

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
                // insertion SPLIT that shape - one extra allowed -1
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
        // rawShapeCount) - but any orphaned reference or definition whose
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

    soakIt("the FULL NAMED FLOW: plant, type a name, re-press, type the definition", async () => {
        await fc.assert(
            fc.asyncProperty(
                pressArb,
                typedNameArb,
                typedBodyArb,
                async ({ lines, cursor, settings }, name, body) => {
                    const doc = pressEditor(lines, cursor);
                    const plugin = fakePlugin(doc, settings);
                    await insertNamedFootnote(plugin);
                    // the press may have warned/hopped/navigated instead -
                    // only a planted "[^]" starts the typing flow
                    if (!plantedPlaceholder(doc, "[^]")) return;

                    typeText(doc, name);
                    const definitionsBefore = definitionNamesFolded(doc.lines);
                    await insertNamedFootnote(plugin);
                    const folded = name.toLowerCase();
                    const definitionsAfter = definitionNamesFolded(doc.lines);

                    if (footnoteNameProblem(name) !== null) {
                        // spaces/backticks/"#": warned about, nothing
                        // created (the creation rule, stricter than the
                        // render rule - "#" renders but is refused,
                        // 2026-09-05)
                        expect([...definitionsAfter].sort()).toEqual(
                            [...definitionsBefore].sort(),
                        );
                        return;
                    }
                    if (definitionsBefore.has(folded)) {
                        // an existing definition (any casing) means the
                        // second press NAVIGATES - no duplicate is created
                        expect([...definitionsAfter].sort()).toEqual(
                            [...definitionsBefore].sort(),
                        );
                        return;
                    }
                    // fresh valid name: its definition now exists, and the
                    // caret sits at the label's end - type the body there
                    expect(definitionsAfter.has(folded)).toBe(true);
                    typeText(doc, body);
                    const after = doc.lines.join("\n");
                    expect(after).toContain(`[^${name}]: ${body}`);
                    // the flow ends with a WHOLE footnote: reference and
                    // definition alive, neither orphaned
                    const fold = (n: string) => n.toLowerCase();
                    expect(
                        orphanedFootnoteReferenceNames(after).map(fold),
                    ).not.toContain(folded);
                    expect(
                        orphanedFootnoteDefinitionNames(after).map(fold),
                    ).not.toContain(folded);
                },
            ),
        );
    });

    soakIt("the FULL INLINE FLOW: plant, type the body, re-press hops out (or warns while empty)", async () => {
        await fc.assert(
            fc.asyncProperty(
                pressArb,
                typedBodyArb,
                async ({ lines, cursor, settings }, body) => {
                    const doc = pressEditor(lines, cursor);
                    const plugin = fakePlugin(doc, settings);
                    await insertInlineFootnote(plugin);
                    if (!plantedPlaceholder(doc, "^[]")) return;

                    typeText(doc, body);
                    const afterTyping = doc.lines.join("\n");
                    const caretAfterTyping = { ...doc.cursor };
                    await insertInlineFootnote(plugin);
                    // the second press never edits - it hops (filled) or
                    // warns and stays (empty)
                    expect(doc.lines.join("\n")).toBe(afterTyping);
                    if (body === "") {
                        expect(doc.cursor).toEqual(caretAfterTyping);
                    } else {
                        // hop lands just past the closing bracket:
                        // "^[" + body + "]" ends one past the typed text
                        expect(doc.cursor).toEqual({
                            line: caretAfterTyping.line,
                            ch: caretAfterTyping.ch + 1,
                        });
                        expect(
                            doc.lines[caretAfterTyping.line],
                        ).toContain(`^[${body}]`);
                    }
                },
            ),
        );
    });

    soakIt("paste survives ARBITRARY clipboard content end to end", async () => {
        await fc.assert(
            fc.asyncProperty(
                pressArb,
                fc.string({ maxLength: 40 }),
                async ({ lines, cursor, settings }, clip) => {
                    clipboardText = clip;
                    try {
                        const doc = await press(lines, cursor, "paste", settings);
                        const before = lines.join("\n");
                        const after = doc.lines.join("\n");
                        if (after === before) return; // guard/warn/empty path
                        const content = sanitizeInlineFootnoteContent(clip);
                        const inserted = `^[${content}]`;
                        const count = (text: string) =>
                            text.split(inserted).length - 1;
                        if (content !== "" && count(after) === count(before) + 1) {
                            // the pasted inline footnote must CLOSE where the
                            // sanitizer promised - an unbalanced clipboard
                            // that escaped sanitizing would run away here
                            const line = doc.lines.find(
                                (l, i) => l !== lines[i] && l.includes(inserted),
                            );
                            expect(line).toBeDefined();
                            const start = (line as string).indexOf(inserted);
                            const span = inlineFootnoteSpanAt(
                                line as string,
                                start + 2,
                            );
                            expect(span).not.toBeNull();
                            if (span?.open === start) {
                                expect(span.close).toBe(
                                    start + inserted.length - 1,
                                );
                            }
                        } else {
                            // the only other edit paste makes: creating the
                            // definition for a definition-less reference
                            // under the caret (navigate step)
                            expect(
                                definitionNamesFolded(doc.lines).size,
                            ).toBeGreaterThan(
                                definitionNamesFolded(lines).size,
                            );
                        }
                    } finally {
                        clipboardText = "generated clipboard text";
                    }
                },
            ),
        );
    });

    // ---------- selection conversion (issue #35 / multi-line 2026-08-19) ----------

    // a random selection: single-line half the time, spanning up to four
    // lines otherwise, possibly reversed, possibly empty or whitespace-only
    // (both fall through to the caret cascade)
    const selectionPressArb = fc
        .tuple(
            docArb,
            fc.nat(1000),
            fc.nat(1000),
            fc.nat(30),
            fc.nat(1000),
            fc.nat(4),
            fc.boolean(),
            settingsArb,
        )
        .map(
            ([doc, linePick, chPick, lenPick, chPick2, linesDown, reversed, settings]) => {
                const lines = normalizeEol(doc).text.split("\n");
                const line = linePick % lines.length;
                const a = chPick % (lines[line].length + 1);
                const toLine = Math.min(line + linesDown, lines.length - 1);
                const b =
                    toLine === line
                        ? Math.min(a + (lenPick % 25), lines[line].length)
                        : chPick2 % (lines[toLine].length + 1);
                const from = { line, ch: a };
                const to = { line: toLine, ch: b };
                const [anchor, head] = reversed ? [to, from] : [from, to];
                return {
                    lines,
                    span: { from, to },
                    selection: { anchor, head },
                    settings,
                };
            },
        );

    /** The trimmed core of the span, exactly as the conversion shrinks it (the shared production trim over a lines-array shim). */
    function trimmedSpan(
        lines: string[],
        from: EditorPosition,
        to: EditorPosition,
    ): { from: EditorPosition; to: EditorPosition } | null {
        return trimSelectionEdges(
            { getLine: (n: number) => lines[n] } as unknown as Editor,
            from,
            to,
        );
    }

    /** The LF-joined text of `[from, to)`. */
    function spanText(
        lines: string[],
        from: EditorPosition,
        to: EditorPosition,
    ): string {
        if (from.line === to.line) {
            return lines[from.line].slice(from.ch, to.ch);
        }
        return [
            lines[from.line].slice(from.ch),
            ...lines.slice(from.line + 1, to.line),
            lines[to.line].slice(0, to.ch),
        ].join("\n");
    }

    soakIt("converting a selection moves EXACTLY the selected text", async () => {
        await fc.assert(
            fc.asyncProperty(
                selectionPressArb,
                fc.constantFrom<CommandName>("autonum", "inline"),
                async ({ lines, span, selection, settings }, command) => {
                    const trimmed = trimmedSpan(lines, span.from, span.to);
                    const protectedBefore = scanDocument(lines).isProtected;
                    resetNotices();
                    const doc = pressEditor(lines, span.from, selection);
                    await COMMANDS[command](fakePlugin(doc, settings));
                    const unchanged =
                        doc.lines.join("\n") === lines.join("\n");
                    // the inline key never converts a line-spanning
                    // selection (Jason's revert of the flatten, 2026-08-20)
                    // - it refuses with its own notice and edits nothing
                    if (
                        command === "inline" &&
                        trimmed !== null &&
                        trimmed.from.line !== trimmed.to.line
                    ) {
                        expect(unchanged).toBe(true);
                        expect(
                            noticeCalls.some(
                                (args) => args[0] === InlineSelectionNotice,
                            ),
                        ).toBe(true);
                        return;
                    }
                    // protected text is never LOST, converted or not: a
                    // refusal (or fallthrough) conserves every protected
                    // line verbatim; an autonum conversion may carry
                    // protected lines the selection contained WHOLE into
                    // the definition body, four-space-indented (2026-08-19).
                    // (The inline key is single-line-only, so it can never
                    // legitimately move a protected line - a regression
                    // would fail the exact-conservation branch.)
                    const strictlyInside = (i: number) =>
                        trimmed !== null &&
                        (i > trimmed.from.line ||
                            (i === trimmed.from.line && trimmed.from.ch === 0)) &&
                        (i < trimmed.to.line ||
                            (i === trimmed.to.line &&
                                trimmed.to.ch === lines[i].length));
                    const counts = new Map<string, number>();
                    for (const line of doc.lines) {
                        counts.set(line, (counts.get(line) ?? 0) + 1);
                    }
                    for (let i = 0; i < lines.length; i++) {
                        if (!protectedBefore[i]) continue;
                        if (
                            !unchanged &&
                            trimmed !== null &&
                            command !== "inline" &&
                            strictlyInside(i)
                        ) {
                            const carried =
                                i === trimmed.from.line
                                    ? lines[i].slice(trimmed.from.ch)
                                    : `    ${lines[i]}`;
                            expect(
                                doc.lines.join("\n"),
                                `contained protected line lost: ${JSON.stringify(lines[i])}`,
                            ).toContain(carried);
                            continue;
                        }
                        const left = counts.get(lines[i]) ?? 0;
                        expect(
                            left,
                            `protected line lost: ${JSON.stringify(lines[i])}`,
                        ).toBeGreaterThan(0);
                        counts.set(lines[i], left - 1);
                    }
                    // an empty/whitespace-only selection falls through to
                    // the caret cascade - the other properties own that
                    if (trimmed === null) return;
                    if (unchanged) {
                        // a refusal always explains itself
                        expect(noticeCalls.length).toBeGreaterThan(0);
                        return;
                    }
                    // converted: the boundary lines keep their prefix and
                    // suffix (stitched onto ONE line), and ONLY the trimmed
                    // span became the footnote. Lines inserted ABOVE the
                    // selection (a definition appended after a mid-document
                    // block, the phantom-frontmatter prepend) shift the
                    // converted line down - search the whole possible shift
                    // window, and require the middle to PARSE as the
                    // conversion (an empty prefix+suffix would otherwise
                    // let any line match).
                    const prefix = lines[trimmed.from.line].slice(0, trimmed.from.ch);
                    const suffix = lines[trimmed.to.line].slice(trimmed.to.ch);
                    const selText = spanText(lines, trimmed.from, trimmed.to);
                    const removedLines = trimmed.to.line - trimmed.from.line;
                    const shiftWindow =
                        doc.lines.length - lines.length + removedLines;
                    const converted = (l: string | undefined) => {
                        if (
                            l === undefined ||
                            !l.startsWith(prefix) ||
                            !l.endsWith(suffix) ||
                            l.length < prefix.length + suffix.length
                        ) {
                            return null;
                        }
                        const middle = l.slice(prefix.length, l.length - suffix.length);
                        if (command === "inline") {
                            return middle ===
                                `^[${sanitizeInlineFootnoteContent(selText)}]`
                                ? middle
                                : null;
                        }
                        return /^\[\^([^\]]+)\]$/.test(middle) ? middle : null;
                    };
                    // a candidate line only counts when its OWN definition
                    // carries the seeded body - with an empty prefix and
                    // suffix, a pre-existing bare "[^1]" line sliding into
                    // the window would otherwise satisfy the shape check
                    // (30k-soak oracle bug, 2026-08-20)
                    let found = false;
                    for (let shift = 0; shift <= shiftWindow && !found; shift++) {
                        const middle = converted(doc.lines[trimmed.from.line + shift]);
                        if (middle === null) continue;
                        if (command === "inline") {
                            found = true;
                            break;
                        }
                        const reference = /^\[\^([^\]]+)\]$/.exec(middle);
                        found =
                            reference !== null &&
                            doc.lines
                                .join("\n")
                                .includes(
                                    `[^${reference[1]}]: ${indentDefinitionBody(selText)}`,
                                );
                    }
                    expect(
                        found,
                        `no line in the shift window converted ${JSON.stringify(selText)}`,
                    ).toBe(true);
                },
            ),
        );
    });

    soakIt("on a selection, paste REDIRECTS and named DEFERS to its modal - neither edits", async () => {
        await fc.assert(
            fc.asyncProperty(
                selectionPressArb,
                fc.constantFrom<CommandName>("named", "paste"),
                async ({ lines, span, selection, settings }, command) => {
                    if (trimmedSpan(lines, span.from, span.to) === null) {
                        return; // falls through to the cascade
                    }
                    resetNotices();
                    const doc = pressEditor(lines, span.from, selection);
                    await COMMANDS[command](fakePlugin(doc, settings));
                    // the press itself never edits: paste explains itself,
                    // named hands off to the name modal (whose submit is
                    // covered by the deterministic pins - units can't
                    // render it)
                    expect(doc.lines.join("\n")).toBe(lines.join("\n"));
                    if (command === "paste") {
                        expect(
                            noticeCalls.some(
                                (args) => args[0] === SelectionCommandNotice,
                            ),
                        ).toBe(true);
                    } else {
                        expect(
                            noticeCalls.some(
                                (args) => args[0] === SelectionCommandNotice,
                            ),
                        ).toBe(false);
                    }
                },
            ),
        );
    });

    soakIt("multiple selection ranges warn and edit nothing (all four keys)", async () => {
        await fc.assert(
            fc.asyncProperty(
                pressArb,
                fc.nat(1000),
                fc.nat(1000),
                async ({ lines, cursor, command, settings }, linePick, chPick) => {
                    // two disjoint non-empty ranges - a stray multi-cursor:
                    // one footnote can't stand in for both, whatever the key
                    const line = linePick % lines.length;
                    const lineText = lines[line];
                    if (lineText.length < 2) return;
                    const cut = 1 + (chPick % (lineText.length - 1));
                    const doc = pressEditor(lines, cursor);
                    (doc as unknown as { listSelections: () => unknown }).listSelections =
                        () => [
                            { anchor: { line, ch: 0 }, head: { line, ch: cut } },
                            {
                                anchor: { line, ch: cut },
                                head: { line, ch: lineText.length },
                            },
                        ];
                    resetNotices();
                    await COMMANDS[command](fakePlugin(doc, settings));
                    expect(doc.lines.join("\n")).toBe(lines.join("\n"));
                    // the paste key never converts a selection, so it gives
                    // its own redirect even here (A9 report 2026-09-08);
                    // the converting keys ask for one stretch
                    const expected =
                        command === "paste" ? SelectionCommandNotice : SelectionSpanNotice;
                    expect(noticeCalls.some((args) => args[0] === expected)).toBe(true);
                },
            ),
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
                    // left the caret - the rapid-double-press shape that
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

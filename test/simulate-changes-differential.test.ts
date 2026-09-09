import { ChangeSet, Text } from "@codemirror/state";
import { EditorChange, EditorPosition } from "obsidian";
import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { simulateChanges, simulatedAnchor } from "../src/editor/insertion-liveness";

// Differential spec (review D5, 2026-09-09): simulateChanges is the
// plugin's model of how CodeMirror applies one transaction's changes, and
// every liveness verdict, every anchor, and the multi-change unit tests
// rest on it. Until now nothing could disagree with it - the shared fake
// editor applies transactions THROUGH it, so the 2026-08-25 tie bug (a
// tied replace's `to` resolved against the already-mutated string) was
// found by hand. Here a real @codemirror/state ChangeSet referees random
// change sets over random documents, the way micromark referees the lint.

fc.configureGlobal({ numRuns: Number(process.env.FC_NUM_RUNS ?? 200) });

const lineArb = fc.string({ maxLength: 12, unit: fc.constantFrom("a", "b", " ", "[", "^", "]", ":", "x", "中") });
const docArb = fc.array(lineArb, { minLength: 1, maxLength: 6 });
const insertArb = fc.string({ maxLength: 8, unit: fc.constantFrom("q", "\n", " ", "[^1]", "z") });

interface Span {
    from: number;
    to: number;
    text: string;
}

/** Non-overlapping spans in document order (CodeMirror refuses overlaps); zero-width inserts may share an offset, and may sit at a replace's start. */
function spansArb(length: number): fc.Arbitrary<Span[]> {
    return fc
        .array(
            fc.tuple(fc.nat(length), fc.nat(6), fc.boolean(), insertArb),
            { minLength: 1, maxLength: 4 },
        )
        .map((raw) => {
            const spans: Span[] = [];
            let cursor = 0;
            for (const [offsetPick, lenPick, isInsert, text] of raw.sort((a, b) => a[0] - b[0])) {
                const from = Math.max(cursor, Math.min(offsetPick, length));
                const to = isInsert ? from : Math.min(from + lenPick, length);
                if (from > length) break;
                spans.push({ from, to, text });
                cursor = to;
            }
            return spans;
        });
}

function positionOf(lines: string[], offset: number): EditorPosition {
    let line = 0;
    let rest = offset;
    while (line < lines.length - 1 && rest > lines[line].length) {
        rest -= lines[line].length + 1;
        line++;
    }
    return { line, ch: rest };
}

function toEditorChanges(lines: string[], spans: Span[]): EditorChange[] {
    return spans.map((span) => ({
        from: positionOf(lines, span.from),
        to: span.to === span.from ? undefined : positionOf(lines, span.to),
        text: span.text,
    }));
}

describe("simulateChanges against a real CodeMirror ChangeSet", () => {
    it("applies random non-overlapping change sets identically", () => {
        fc.assert(
            fc.property(
                docArb.chain((lines) => fc.tuple(fc.constant(lines), spansArb(lines.join("\n").length))),
                ([lines, spans]) => {
                    const original = Text.of(lines);
                    const changeSet = ChangeSet.of(
                        spans.map((s) => ({ from: s.from, to: s.to, insert: s.text })),
                        original.length,
                    );
                    const expected = changeSet.apply(original).toString();
                    const actual = simulateChanges(lines, toEditorChanges(lines, spans)).join("\n");
                    expect(actual).toBe(expected);
                },
            ),
        );
    });

    it("lands every change where CodeMirror maps its start", () => {
        fc.assert(
            fc.property(
                docArb.chain((lines) => fc.tuple(fc.constant(lines), spansArb(lines.join("\n").length))),
                ([lines, spans]) => {
                    const original = Text.of(lines);
                    const changeSet = ChangeSet.of(
                        spans.map((s) => ({ from: s.from, to: s.to, insert: s.text })),
                        original.length,
                    );
                    const changes = toEditorChanges(lines, spans);
                    const simulated = simulateChanges(lines, changes);
                    const applied = changeSet.apply(original);
                    // stacked inserts at one offset: CodeMirror keeps array
                    // order, so the k-th insert at an offset starts after the
                    // ones before it - its start is the mapped offset plus
                    // the earlier siblings' lengths
                    spans.forEach((span, index) => {
                        const anchor = simulatedAnchor(lines, changes, index, simulated);
                        const anchorOffset = applied.line(anchor.line + 1).from + anchor.ch;
                        const siblingsBefore = spans
                            .slice(0, index)
                            .filter((s) => s.from === span.from && s.to === s.from);
                        const expectedStart =
                            changeSet.mapPos(span.from, -1) +
                            siblingsBefore.reduce((sum, s) => sum + s.text.length, 0);
                        expect(anchorOffset).toBe(expectedStart);
                    });
                },
            ),
        );
    });

    it("pins the tie that was found by hand: an insert at a replace's start goes first", () => {
        const lines = ["....AAAAA"];
        // a replace of the tail and an insert at the same offset, in the
        // array order the plugin's own bundles use (reference first)
        const changes: EditorChange[] = [
            { from: { line: 0, ch: 4 }, to: { line: 0, ch: 9 }, text: "BBBBB" },
            { from: { line: 0, ch: 4 }, text: "CC" },
        ];
        const expected = ChangeSet.of(
            [
                { from: 4, to: 9, insert: "BBBBB" },
                { from: 4, insert: "CC" },
            ],
            9,
        )
            .apply(Text.of(lines))
            .toString();
        expect(simulateChanges(lines, changes).join("\n")).toBe(expected);
    });
});

// The smallest set of line-range edits that turns one version of a note
// into another.
//
// Why it exists (Jason's report, sheet 20, 2026-09-11): the lint used to
// write its result back as ONE edit, from the first changed character to
// the last. Everything between those two points was replaced wholesale,
// even the lines that had not changed at all. That threw away every folded
// heading and list in the span, and the caret, if it sat anywhere inside,
// was pushed to the span's start. Editing only the lines that really
// changed leaves folds alone and lets the editor carry the caret through
// untouched text unchanged.
//
// How it works: lines that match at the start and at the end are skipped
// first. What is left in the middle goes through a longest-common-
// subsequence comparison on whole lines, and each run of lines that does
// not match becomes one edit. A very large middle (millions of line pairs
// to compare) falls back to one edit for the whole middle, so a giant note
// never stalls the app.

/** One edit, as character offsets into the BEFORE text: replace [from, to) with `text`. Edits come back in document order and never overlap. */
export interface OffsetChange {
    from: number;
    to: number;
    text: string;
}

/** Above this many line pairs the middle is replaced as one edit instead of compared line by line. */
const MaxComparedPairs = 4_000_000;

export function lineDiffChanges(before: string, after: string): OffsetChange[] {
    if (before === after) return [];
    const a = before.split("\n");
    const b = after.split("\n");
    let head = 0;
    while (head < a.length && head < b.length && a[head] === b[head]) head++;
    let aTail = a.length;
    let bTail = b.length;
    while (aTail > head && bTail > head && a[aTail - 1] === b[bTail - 1]) {
        aTail--;
        bTail--;
    }
    const middleA = a.slice(head, aTail);
    const middleB = b.slice(head, bTail);
    const hunks =
        middleA.length * middleB.length <= MaxComparedPairs
            ? unmatchedRuns(middleA, middleB)
            : [{ aStart: 0, aEnd: middleA.length, bStart: 0, bEnd: middleB.length }];

    // where each line of `before` starts
    const starts: number[] = [0];
    for (let i = 0; i < a.length; i++) starts.push(starts[i] + a[i].length + 1);

    const changes: OffsetChange[] = [];
    for (const hunk of hunks) {
        const s = head + hunk.aStart;
        const e = head + hunk.aEnd;
        const inserted = b.slice(head + hunk.bStart, head + hunk.bEnd);
        if (e < a.length) {
            if (s === e) {
                // lines inserted BEFORE line e: they bring their own newlines
                changes.push({ from: starts[s], to: starts[s], text: inserted.join("\n") + "\n" });
            } else if (inserted.length === 0) {
                // lines deleted, newlines and all
                changes.push({ from: starts[s], to: starts[e], text: "" });
            } else {
                // lines replaced: their text swaps, the newline after the
                // last one stays where it is, so the edit stops at the end
                // of that line and never touches the line below
                changes.push({ from: starts[s], to: starts[e] - 1, text: inserted.join("\n") });
            }
        } else if (s < a.length) {
            // the replaced range reaches the end of the note, where the last
            // line has no newline after it; a pure deletion here must also
            // eat the newline BEFORE the range, or one would be left dangling
            const from = inserted.length === 0 && s > 0 ? starts[s] - 1 : starts[s];
            changes.push({ from, to: before.length, text: inserted.join("\n") });
        } else {
            // a pure insertion after the last line: the last line has no
            // newline after it, so one is opened first
            changes.push({ from: before.length, to: before.length, text: "\n" + inserted.join("\n") });
        }
    }
    // Within each edit, the characters that match at its start and end are
    // left out: a caret sitting after the changed characters on a changed
    // line then keeps its column, since only the differing characters are
    // rewritten (Jason's report: the caret went to the line's start).
    return changes.map((change) => trimCommonEdges(before, change));
}

/** `change` with the characters it shares with the text it replaces removed from both ends. */
function trimCommonEdges(before: string, change: OffsetChange): OffsetChange {
    const old = before.slice(change.from, change.to);
    let head = 0;
    const maxHead = Math.min(old.length, change.text.length);
    while (head < maxHead && old[head] === change.text[head]) head++;
    let tail = 0;
    const maxTail = maxHead - head;
    while (tail < maxTail && old[old.length - 1 - tail] === change.text[change.text.length - 1 - tail]) tail++;
    return {
        from: change.from + head,
        to: change.to - tail,
        text: change.text.slice(head, change.text.length - tail),
    };
}

/** The runs of lines in `a` and `b` that do not match, from a longest-common-subsequence comparison; each run is one edit. */
function unmatchedRuns(
    a: string[],
    b: string[],
): { aStart: number; aEnd: number; bStart: number; bEnd: number }[] {
    const n = a.length;
    const m = b.length;
    if (n === 0 || m === 0) return n === 0 && m === 0 ? [] : [{ aStart: 0, aEnd: n, bStart: 0, bEnd: m }];
    // lcs[i][j] = length of the longest common subsequence of a[i..] and b[j..]
    const width = m + 1;
    const lcs = new Int32Array((n + 1) * width);
    for (let i = n - 1; i >= 0; i--) {
        for (let j = m - 1; j >= 0; j--) {
            lcs[i * width + j] =
                a[i] === b[j]
                    ? lcs[(i + 1) * width + j + 1] + 1
                    : Math.max(lcs[(i + 1) * width + j], lcs[i * width + j + 1]);
        }
    }
    const runs: { aStart: number; aEnd: number; bStart: number; bEnd: number }[] = [];
    let i = 0;
    let j = 0;
    let open: { aStart: number; aEnd: number; bStart: number; bEnd: number } | null = null;
    const closeRun = () => {
        if (open) runs.push(open);
        open = null;
    };
    while (i < n || j < m) {
        if (i < n && j < m && a[i] === b[j]) {
            closeRun();
            i++;
            j++;
            continue;
        }
        if (!open) open = { aStart: i, aEnd: i, bStart: j, bEnd: j };
        // take from whichever side keeps the longer common subsequence ahead
        if (j >= m || (i < n && lcs[(i + 1) * width + j] >= lcs[i * width + j + 1])) {
            i++;
            open.aEnd = i;
        } else {
            j++;
            open.bEnd = j;
        }
    }
    closeRun();
    return runs;
}

/** A fold as Obsidian's view reports it: the heading (or list item) line and the last folded line, both 0-based. */
export interface FoldRange {
    from: number;
    to: number;
}

/**
 * `folds` with their line numbers carried through `changes` (lineDiffChanges
 * of `before` to the new text).
 *
 * Obsidian drops a heading's fold on any edit inside it, even a single
 * character (probed live, 2026-09-11), so after a lint the plugin puts the
 * folds back itself, and this works out where each one now lives. Every
 * fold line is mapped by its start offset, the way an editor maps a
 * position through edits: text before an edit stays, text after it shifts,
 * whole lines inserted at a line's start push that line down. A fold whose
 * heading line the edits removed is dropped; a fold whose last line was
 * removed ends on the line before the removal.
 */
export function mapFoldLines(folds: FoldRange[], changes: OffsetChange[], before: string): FoldRange[] {
    if (changes.length === 0) return folds;
    const after = applyOffsetChanges(before, changes);
    const starts = [0];
    for (let i = 0; i < before.length; i++) if (before.charCodeAt(i) === 10) starts.push(i + 1);
    const removed = (line: number) =>
        changes.some(
            (c) =>
                c.from <= starts[line] &&
                (line + 1 < starts.length ? c.to >= starts[line + 1] : c.to >= before.length) &&
                c.to > c.from,
        );
    const mapOffset = (offset: number): number => {
        let mapped = offset;
        for (const c of changes) {
            if (offset < c.from) break;
            const shift = c.text.length - (c.to - c.from);
            if (c.from === c.to) {
                // whole lines inserted at this very offset push it down
                mapped += shift;
                continue;
            }
            if (offset >= c.to) {
                mapped += shift;
                continue;
            }
            // the edit starts at this offset or covers it: the position
            // collapses to where the edit starts
            mapped = mapped - offset + c.from;
            break;
        }
        return mapped;
    };
    const lineAt = (offset: number) => {
        let line = 0;
        for (let i = 0; i < offset && i < after.length; i++) if (after.charCodeAt(i) === 10) line++;
        return line;
    };
    const out: FoldRange[] = [];
    for (const fold of folds) {
        if (fold.from >= starts.length || fold.to >= starts.length || removed(fold.from)) continue;
        const from = lineAt(mapOffset(starts[fold.from]));
        // a removed last line: the fold now ends where the removal begins,
        // on the line before it
        const to = removed(fold.to) ? lineAt(Math.max(0, mapOffset(starts[fold.to]) - 1)) : lineAt(mapOffset(starts[fold.to]));
        if (to > from) out.push({ from, to });
    }
    return out;
}

/** `before` with `changes` (offsets into `before`, in order, non-overlapping) applied. */
function applyOffsetChanges(before: string, changes: OffsetChange[]): string {
    let out = "";
    let copied = 0;
    for (const change of changes) {
        out += before.slice(copied, change.from) + change.text;
        copied = change.to;
    }
    return out + before.slice(copied);
}

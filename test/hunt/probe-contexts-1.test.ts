import { Editor, EditorPosition } from "obsidian";
import { describe, expect, it } from "vitest";

import FootnotePlugin from "../../src/main";
import {
    maskInlineCode,
    maskProtectedLines,
    protectedLines,
} from "../../src/markdown-scan";
import {
    computeNextFootnoteNumber,
    shouldJumpFromDetailToMarker,
} from "../../src/insert-or-navigate-footnotes";
import { reindexFootnotes } from "../../src/reindex-footnotes";

// Hunt probes — contexts lens (protected regions). Mutations of the #41
// class: places where [^x]-shaped text is NOT a footnote to Obsidian but
// might still be visible (or invisible) to the scanners.

function fakeEditor(lines: string[]) {
    const cursorMoves: EditorPosition[] = [];
    const doc = {
        getLine: (n: number) => lines[n],
        lineCount: () => lines.length,
        lastLine: () => lines.length - 1,
        setCursor: (pos: EditorPosition) => cursorMoves.push(pos),
        scrollIntoView: () => {},
    } as unknown as Editor;
    return { doc, cursorMoves };
}

const fakePlugin = {
    settings: { enablePopupEditor: false },
    app: { vault: {} },
} as unknown as FootnotePlugin;

// ---------------------------------------------------------------- sanity
// (expected to pass — checklist items verifying the fence machinery)

describe("sanity: fence machinery", () => {
    it("a shorter backtick run does not close a longer fence", () => {
        // ````\n```\nfake[^7]\n````\nreal[^1]
        expect(
            computeNextFootnoteNumber("````\n```\nfake[^7]\n````\nreal[^1]"),
        ).toBe(2);
    });

    it("a backtick run does not close a tilde fence", () => {
        expect(
            computeNextFootnoteNumber("~~~\n```\nfake[^7]\n~~~\nreal[^1]"),
        ).toBe(2);
    });

    it("unclosed fence at EOF protects to the end", () => {
        expect(computeNextFootnoteNumber("real[^1]\n```\nfake[^7]")).toBe(2);
    });

    it("marker in a fence info string is protected", () => {
        expect(
            computeNextFootnoteNumber("```python [^7]\ncode\n```\nreal[^1]"),
        ).toBe(2);
    });

    it("closing-fence line with trailing text does not close the fence", () => {
        // "``` [^7]" inside the fence is code content per CommonMark
        expect(
            computeNextFootnoteNumber("real[^1]\n```\n``` [^7]\nstill code[^8]"),
        ).toBe(2);
    });

    it("double-backtick inline code with an inner backtick is masked", () => {
        expect(
            computeNextFootnoteNumber("``fake ` [^7]`` real[^1]"),
        ).toBe(2);
    });

    it("inline code span at the very start and end of a line is masked", () => {
        expect(maskInlineCode("`[^7]`")).toBe("\0".repeat(6));
        expect(computeNextFootnoteNumber("`[^7]`\nreal[^1]")).toBe(2);
    });

    it("reindex leaves markers inside a fence untouched", () => {
        const doc = "real[^2]\n```\n[^2] fake\n```\n\n[^2]: def";
        const out = reindexFootnotes(doc);
        expect(out).toBe("real[^1]\n```\n[^2] fake\n```\n\n[^1]: def");
    });

    it("reindex leaves an unclosed fence's definitions untouched", () => {
        const doc = "real[^2]\n\n[^2]: def\n```\n[^9]: fake";
        const out = reindexFootnotes(doc);
        expect(out).toBe("real[^1]\n\n[^1]: def\n```\n[^9]: fake");
    });
});

// ------------------------------------------------------- container blocks

describe("fences inside container blocks (blockquote / callout)", () => {
    it("a fenced block inside a blockquote is protected", () => {
        // In Obsidian, "> ```" opens a fence rendered as code inside the
        // blockquote; the [^7] inside it is plain text.
        expect(
            computeNextFootnoteNumber("> ```\n> fake[^7]\n> ```\nreal[^1]"),
        ).toBe(2);
    });

    it("a fenced block inside a callout is protected", () => {
        expect(
            computeNextFootnoteNumber(
                "> [!note]\n> ```\n> fake[^7]\n> ```\nreal[^1]",
            ),
        ).toBe(2);
    });
});

// --------------------------------------------------- CommonMark fine print

describe("CommonMark fence/inline-code fine print", () => {
    it("a backtick 'fence opener' whose info string contains backticks is inline code, not a fence", () => {
        // CommonMark: the info string of a backtick fence may not contain
        // backticks, so "```[^7]``` inline" is a paragraph with an inline
        // code span — real[^2] on the next line is a live marker.
        expect(
            computeNextFootnoteNumber("```[^7]``` inline\nreal[^2]"),
        ).toBe(3);
    });

    it("escaped backticks do not open an inline code span", () => {
        // "\`" is a literal backtick per CommonMark, so [^3] here is a real
        // marker, not code content.
        expect(computeNextFootnoteNumber("a \\` b [^3] c \\` d")).toBe(4);
    });

    it("an inline code span that wraps across lines is masked", () => {
        // CommonMark code spans may span a newline inside a paragraph, so
        // [^7] here renders as code in reading view.
        expect(
            computeNextFootnoteNumber("a `code\nspan[^7] more` b\nreal[^1]"),
        ).toBe(2);
    });

    it("four-space-indented code blocks are protected", () => {
        // documented as NOT detected in markdown-scan.ts (indentation is how
        // definition continuations work) — probe pins the tradeoff
        expect(
            computeNextFootnoteNumber("para\n\n    code[^7]\n\nreal[^1]"),
        ).toBe(2);
    });
});

// --------------------------------------------------------- other regions

describe("non-code protected regions", () => {
    it("markers inside HTML comments do not reserve numbers", () => {
        // an HTML comment renders as nothing; [^7] inside it is invisible
        expect(
            computeNextFootnoteNumber("<!-- old[^7] -->\nreal[^1]"),
        ).toBe(2);
    });

    it("markers inside inline math do not reserve numbers", () => {
        // $...$ is MathJax content; Obsidian does not parse footnotes there
        expect(computeNextFootnoteNumber("cost $[^7]$ real[^1]")).toBe(2);
    });

    it("markers inside display math ($$...$$) do not reserve numbers", () => {
        expect(
            computeNextFootnoteNumber("$$\nx[^7]\n$$\nreal[^1]"),
        ).toBe(2);
    });
});

// ----------------------------------------------------------------- CRLF

describe("CRLF line endings", () => {
    it("frontmatter is still protected when the document uses CRLF", () => {
        expect(
            computeNextFootnoteNumber("---\r\nnum: [^9]\r\n---\r\nreal[^1]"),
        ).toBe(2);
    });

    it("protectedLines marks CRLF frontmatter lines", () => {
        const flags = protectedLines(["---\r", "a: b\r", "---\r", "x[^1]\r"]);
        expect(flags).toEqual([true, true, true, false]);
    });

    it("fences are still protected when the document uses CRLF", () => {
        expect(
            computeNextFootnoteNumber("```\r\nfake[^7]\r\n```\r\nreal[^1]"),
        ).toBe(2);
    });
});

// -------------------------------------------- masked-scan callers (jump)

describe("shouldJumpFromDetailToMarker target search", () => {
    it("does not 'jump' to its own detail line when definitions sit above the markers", () => {
        const { doc, cursorMoves } = fakeEditor([
            "[^1]: detail",
            "text[^1] here",
        ]);
        const handled = shouldJumpFromDetailToMarker(
            "[^1]: detail",
            { line: 0, ch: 3 },
            doc,
            fakePlugin,
        );
        expect(handled).toBe(true);
        // first real MARKER use is line 1; the detail line itself is not a
        // marker (AllMarkers excludes "[^1]:") and must not be the target
        expect(cursorMoves).toEqual([{ line: 1, ch: 8 }]);
    });

    it("does not land inside [^12] when searching for the marker of [^1]", () => {
        const { doc, cursorMoves } = fakeEditor([
            "see[^12] a[^1] end",
            "",
            "[^1]: one",
            "[^12]: twelve",
        ]);
        const handled = shouldJumpFromDetailToMarker(
            "[^1]: one",
            { line: 2, ch: 3 },
            doc,
            fakePlugin,
        );
        expect(handled).toBe(true);
        // "[^1]" is a substring of "[^12]" — the jump must go to the real
        // [^1] at ch 10..14, landing after it (ch 14)
        expect(cursorMoves).toEqual([{ line: 0, ch: 14 }]);
    });
});

// --------------------------------------------- maskProtectedLines shape

describe("maskProtectedLines index preservation", () => {
    it("masked lines keep their original lengths", () => {
        const lines = ["---", "k: v", "---", "a `b` c", "```", "x", "```"];
        const masked = maskProtectedLines(lines);
        expect(masked.map((l) => l.length)).toEqual(
            lines.map((l) => l.length),
        );
    });
});

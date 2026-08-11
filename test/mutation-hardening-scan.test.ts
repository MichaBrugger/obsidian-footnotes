import { describe, expect, it } from "vitest";

import {
    definitionLabelIn,
    findDefinitionBlocks,
    maskLineRegions,
    maskedLineAt,
    normalizeEol,
    protectedLines,
    removeLineRanges,
    restoreEol,
    scanDocument,
} from "../src/markdown-scan";

// These tests exist to kill Stryker survivors from the 2026-08-10 baseline
// listed in survivors-markdown-scan.json (144 mutants against
// src/markdown-scan.ts). Organized by scanner region, in file order, so a
// mutant's line number maps to the `describe` block that targets it.

const NUL = (n: number) => "\0".repeat(n);

describe("normalizeEol / restoreEol", () => {
    // line 51: the LF branch's eol tag must be exactly "\n" — a mutant that
    // blanks it would make restoreEol a no-op forever, silently keeping
    // stray CRLF fragments that should have round-tripped.
    it("tags an LF-only document with eol \"\\n\", not empty", () => {
        const { text, eol } = normalizeEol("a\nb\nc");
        expect(text).toBe("a\nb\nc");
        expect(eol).toBe("\n");
    });

    it("restoreEol with eol \"\\n\" leaves the text untouched", () => {
        expect(restoreEol("a\nb", "\n")).toBe("a\nb");
    });

    it("tags a CRLF document with eol \"\\r\\n\" and flattens to LF", () => {
        const { text, eol } = normalizeEol("a\r\nb");
        expect(text).toBe("a\nb");
        expect(eol).toBe("\r\n");
    });
});

describe("blockquoteDepth (via scanDocument's container-depth reach)", () => {
    // lines 75-77: the marker scan may skip 0-3 leading spaces before a
    // ">" — a 4th space is one too many and the ">" stays literal text
    // instead of opening a nested quote. Proven through a fence: a nested
    // quote's fence at depth 2 must protect its body; text that fails to
    // nest never opens that fence.
    it("three leading spaces still let a nested quote marker open a fence", () => {
        // "> " (marker+optional space) then exactly 3 more spaces then the
        // nested ">" — the legal CommonMark maximum
        const doc = [">    > ```", "> > body", "> > ```", "after"].join("\n");
        expect(protectedLines(doc.split("\n"))).toEqual([
            true,
            true,
            true,
            false,
        ]);
    });

    it("a fourth leading space keeps the nested \">\" as literal text, not a marker", () => {
        const doc = [">     > ```", "after"].join("\n");
        // depth stays 1; rest is "    > ```" (leading spaces + literal ">"),
        // which is not a fence opener — nothing is protected
        expect(protectedLines(doc.split("\n"))).toEqual([false, false]);
    });

    // line 81: the ONE optional space after a ">" marker belongs to the
    // marker and must not appear in `rest` — proven via fence-opener
    // detection, which is sensitive to leading whitespace inside `rest`.
    it("a marker with no trailing space consumes nothing extra past the \">\"", () => {
        // no space between ">" and the fence delimiter: correct code takes
        // "```" as rest and opens a fence; consuming one extra char would
        // leave only "``" (two backticks), which is not a fence
        const doc = [">```", "after"].join("\n");
        expect(protectedLines(doc.split("\n"))).toEqual([true, false]);
    });

    it("a marker's single trailing space is swallowed by the marker, not left in rest", () => {
        const doc = ["> ```", "> content", ">     ```", "> next"].join("\n");
        // closer is indented 4 columns past the marker's own content
        // column (contentIndent 0 + 3 max == 3) — it must NOT close, so
        // everything through "> next" stays inside the open fence
        expect(protectedLines(doc.split("\n"))).toEqual([
            true,
            true,
            true,
            true,
        ]);
    });
});

describe("definitionLabelIn", () => {
    // line 106: nameEnd is prefix + 2 + the captured name's length — a
    // mutant that subtracts the label length instead of adding it would
    // make nameEnd walk backward for any name longer than 2 chars.
    it("nameEnd advances past a multi-character name, not backward", () => {
        const label = definitionLabelIn("[^long-name]: text");
        expect(label).not.toBeNull();
        expect(label!.nameStart).toBe(2);
        expect(label!.nameEnd).toBe(2 + "long-name".length);
        expect(label!.labelEnd).toBe("[^long-name]:".length);
    });

    it("a blockquoted definition's name positions shift by the prefix length", () => {
        const line = "> [^abc]: text";
        const label = definitionLabelIn(line);
        const prefix = "> ".length;
        expect(label).toEqual({
            nameStart: prefix + 2,
            nameEnd: prefix + 2 + "abc".length,
            labelEnd: prefix + "[^abc]:".length,
        });
    });
});

describe("isFenceOpener", () => {
    // line 118: a backtick fence's info string may not itself contain a
    // backtick (CommonMark) — such a line is an inline code span in a
    // paragraph, not a fence opener, so it must NOT protect the lines
    // after it. A tilde fence has no such restriction.
    it("a backtick fence whose info string contains a backtick never opens", () => {
        const doc = ["```info`with`backtick", "still prose[^1]"].join("\n");
        expect(protectedLines(doc.split("\n"))).toEqual([false, false]);
    });

    it("a tilde fence with a backtick in its info string still opens", () => {
        const doc = ["~~~info`x`", "code", "~~~"].join("\n");
        expect(protectedLines(doc.split("\n"))).toEqual([true, true, true]);
    });
});

// dollarInsideReference is an internal (unexported) helper, so it is pinned
// indirectly through maskLineRegions, which is the only way its result is
// observable through the public API.
describe("dollarInsideReference (observed through maskLineRegions)", () => {
    // line 147: the backward scan uses "j >= 0", so it must still inspect
    // index 0 itself — a mutant stopping at "j > 0" would skip the very
    // first character and miss a "[^" that starts the line, wrongly
    // treating BOTH id-internal dollars below as math openers/closers.
    it("recognizes a reference bracket that starts the line (index 0)", () => {
        const line = "[^a$b$c]";
        // both dollars are footnote-id characters; neither opens math
        expect(maskLineRegions(line).masked).toBe(line);
    });

    // line 150: a "[" found while walking back only counts as a reference
    // opener when immediately followed by "^" — a mutant that returns
    // `true` unconditionally would treat this plain "[...]" bracket as a
    // reference too, suppressing a math span that should otherwise mask.
    it("a bracket without a caret does not suppress math scanning", () => {
        const { masked } = maskLineRegions("[x$y$ done");
        expect(masked).toBe("[x" + NUL(3) + " done");
    });
});

describe("maskLineRegions: multi-line comment continuation (startInComment)", () => {
    // line 180: when no "-->" closes the comment on this line, the WHOLE
    // line must stay masked and endsInComment must stay true. Both the
    // "always false" and the "close === 1" mutants would fall through
    // instead, since indexOf never actually returns 1 here (-1 is real).
    it("an interior line with no closer stays fully masked and open", () => {
        const { masked, endsInComment, endsInMath } = maskLineRegions(
            "no closer on this line",
            true,
        );
        expect(masked).toBe(NUL("no closer on this line".length));
        expect(endsInComment).toBe(true);
        expect(endsInMath).toBe(false);
    });

    // line 188: `i` must resume scanning exactly AFTER the "-->" closer —
    // resuming 6 chars too early re-exposes an already-blotted opener
    // region to a fresh code-span scan, changing the final mask.
    it("resumes scanning exactly after the comment closer, not before it", () => {
        const line = "`ab--> cd`e";
        const { masked } = maskLineRegions(line, true);
        // close+3 correctly skips past "-->"; only "cd`" ... "`e" remain,
        // and the lone leftover backtick at index 9 never re-pairs with
        // the opener backtick at index 0 (that's already behind us)
        expect(masked).toBe(NUL(6) + " cd`e");
    });
});

describe("maskLineRegions: multi-line math continuation (startInMath)", () => {
    // line 192: same "no closer" shape as the comment branch, but for "$$".
    it("an interior math line with no closer stays fully masked and open", () => {
        const { masked, endsInMath, endsInComment } = maskLineRegions(
            "still inside the block",
            false,
            true,
        );
        expect(masked).toBe(NUL("still inside the block".length));
        expect(endsInMath).toBe(true);
        expect(endsInComment).toBe(false);
    });

    // line 199: `i` must resume exactly after "$$" (2 chars), not before.
    it("resumes scanning exactly after the math closer, not before it", () => {
        const line = "`ab$$ cd`e";
        const { masked } = maskLineRegions(line, false, true);
        expect(masked).toBe(NUL(5) + " cd`e");
    });
});

describe("maskLineRegions: main scan loop bounds and escapes", () => {
    // line 203: the while loop's bound is `i < line.length` — an off-by-one
    // that allows i === line.length would read past the string (undefined
    // char) instead of stopping; the escape-skip below proves the loop
    // still terminates cleanly right at the boundary.
    it("a trailing escape at the very end of the line does not overrun", () => {
        // "\\" as the last character: i+=2 would land past the end, and
        // the loop must simply stop there rather than throwing or looping
        expect(maskLineRegions("text\\").masked).toBe("text\\");
    });

    // line 217: the closing-backtick search loop bound, same shape as 203.
    it("an unmatched backtick run at EOL stays literal, scan terminates", () => {
        expect(maskLineRegions("a `unclosed").masked).toBe("a `unclosed");
    });

    // line 224: the closing run must match the OPENING run's exact length
    // — a mutant that always accepts (ConditionalExpression true) would
    // close a double-backtick span on the first single backtick it meets.
    it("a double-backtick opener is not closed by a lone single backtick", () => {
        const line = "``a`b``";
        // the run of 2 backticks only closes against another run of 2;
        // the lone backtick between "a" and "b" is span content
        expect(maskLineRegions(line).masked).toBe(NUL(line.length));
    });
    it("a single backtick between two double-backtick spans stays unmasked prose", () => {
        // here there is no closing double run at all, so nothing closes
        const line = "``a`b";
        expect(maskLineRegions(line).masked).toBe(line);
    });

    // line 230: after a successful match, scanning resumes at
    // close + runLength — a mutant that subtracts instead would rewind
    // into the JUST-CLOSED span, letting the scanner re-open a phantom
    // span there. Proven with two adjacent spans: the separating space
    // must survive as literal prose, not get swallowed into a
    // mis-rewound match.
    it("resumes scanning exactly after a closed code span, not back inside it", () => {
        const line = "`a` `b`";
        expect(maskLineRegions(line).masked).toBe(NUL(3) + " " + NUL(3));
    });
});

describe("maskLineRegions: short-form HTML comments", () => {
    // line 236: "<!-->" is a complete 5-character comment (CommonMark
    // §6.6) — advancing i by anything other than +5 would either re-scan
    // part of it or skip live content after it.
    it("consumes exactly the 5 characters of \"<!-->\" and resumes right after", () => {
        const { masked, endsInComment } = maskLineRegions("a<!-->`b`");
        expect(masked).toBe("a" + NUL(5) + NUL(3));
        expect(endsInComment).toBe(false);
    });

    // line 241: "<!--->" is 6 characters.
    it("consumes exactly the 6 characters of \"<!--->\" and resumes right after", () => {
        const { masked, endsInComment } = maskLineRegions("a<!--->`b`");
        expect(masked).toBe("a" + NUL(6) + NUL(3));
        expect(endsInComment).toBe(false);
    });

    // line 245: a genuine unclosed "<!--" (checked from i+4, so the short
    // forms above are excluded) blots to EOL and reports endsInComment.
    it("an ordinary unclosed comment blots to end of line", () => {
        const { masked, endsInComment } = maskLineRegions("x <!-- open");
        expect(masked).toBe("x " + NUL("<!-- open".length));
        expect(endsInComment).toBe(true);
    });

    // line 252: the unclosed-comment branch's endsInMath must report
    // false — a BooleanLiteral mutant flipping it to true would make a
    // plain unclosed HTML comment masquerade as an open math block on the
    // NEXT line (wrong continuation branch entirely).
    it("an unclosed comment does not also claim to be an open math block", () => {
        const { endsInMath } = maskLineRegions("x <!-- open");
        expect(endsInMath).toBe(false);
    });
});

describe("maskLineRegions: dollar / math scanning", () => {
    // line 259: the "$" branch's own conditional gate — flipping it to
    // "true" wouldn't change $-handling directly, but skipping it (dead
    // code around it) is exercised implicitly by every math test below;
    // pin the base case where a dollar opens ordinary inline math.
    it("a simple inline math span is masked end to end", () => {
        const { masked } = maskLineRegions("$x+y$ done");
        expect(masked).toBe(NUL("$x+y$".length) + " done");
    });

    // line 261: a dollar inside a footnote reference must be skipped
    // (i++, continue) rather than treated as an opener — an empty
    // BlockStatement mutant would fall through to the opener logic below
    // instead, and the ConditionalExpression "false" mutant would never
    // take this branch even when the guard is true.
    it("a dollar inside a footnote reference never opens math, even with a real $ later", () => {
        const line = "[^a$b] and $real$";
        const { masked } = maskLineRegions(line);
        // the reference's internal "$" stays literal; only the later
        // standalone "$real$" is math
        expect(masked).toBe("[^a$b] and " + NUL("$real$".length));
    });

    // line 267: display math "$$...$$" with no closer blots to EOL and
    // reports endsInMath — mirrors the comment case at line 245.
    it("an unclosed display-math opener blots to end of line", () => {
        const { masked, endsInMath, endsInComment } = maskLineRegions(
            "x $$ open",
        );
        expect(masked).toBe("x " + NUL("$$ open".length));
        expect(endsInMath).toBe(true);
        expect(endsInComment).toBe(false);
    });

    // line 284: the inline-math closing-dollar search loop bound.
    it("an unmatched single dollar with no closing partner stays literal", () => {
        expect(maskLineRegions("cost $5 no close").masked).toBe(
            "cost $5 no close",
        );
    });

    // line 285-286: a backslash inside the inline-math closing search must
    // skip the escaped character (j+=2) rather than treat it as a
    // potential closer or infinite-loop by never advancing.
    it("an escaped dollar inside candidate math content is not the closer", () => {
        // "\$" is not a valid close; the real closer is the LAST "$"
        const line = "$a\\$b$";
        const { masked } = maskLineRegions(line);
        expect(masked).toBe(NUL(line.length));
    });

    // line 295-299: the four-way guard that REJECTS a "$...$" candidate —
    // no closer found, empty content, leading space, or trailing space.
    // Each must independently veto math; only when none apply does it
    // mask. Reordering the guard as a chained AND/OR (LogicalOperator
    // mutants) or dropping any single clause changes which of these four
    // shapes gets (wrongly) treated as math.
    it("no closing dollar at all leaves both dollars as literal prose", () => {
        expect(maskLineRegions("a $b c").masked).toBe("a $b c");
    });
    // NOTE: "close === i + 1" (empty inline-math content) is unreachable in
    // practice — two adjacent unescaped dollars are always caught by the
    // "$$" display-math branch above this check first, so `close` can
    // never come back equal to `i + 1` here. The 296:17 (drop this OR
    // clause) and 296:27 (i+1 -> i-1) mutants are therefore equivalent:
    // no input reaches this comparison with a value that makes it matter.
    it("content starting with a space is not math (Obsidian's rule)", () => {
        const line = "$ x$ prose";
        expect(maskLineRegions(line).masked).toBe(line);
    });
    it("content ending with a space is not math (Obsidian's rule)", () => {
        const line = "$x $ prose";
        expect(maskLineRegions(line).masked).toBe(line);
    });
    it("content with no leading or trailing space IS math", () => {
        const line = "$x y$ prose";
        expect(maskLineRegions(line).masked).toBe(NUL("$x y$".length) + " prose");
    });

    // line 304: on a successful inline-math match, `i` resumes exactly
    // after the closing "$" (close+1) — off by one either re-scans the
    // dollar or skips the character right after it.
    it("resumes scanning exactly after the closing dollar of inline math", () => {
        const line = "$a$`b`";
        const { masked } = maskLineRegions(line);
        expect(masked).toBe(NUL("$a$".length) + NUL("`b`".length));
    });
});

describe("scanDocument: YAML frontmatter", () => {
    // line 354: the closing-scan loop bound `j < src.length` — an off-by-
    // one would either miss the last line as a possible closer or read
    // past the array.
    it("a closing \"---\" on the very last line still closes frontmatter", () => {
        const doc = "---\nkey: 1\n---";
        expect(protectedLines(doc.split("\n"))).toEqual([true, true, true]);
    });

    // line 355: the closer regex accepts "---" or "..." with only
    // trailing whitespace — anchoring differently (no "^", or requiring
    // nothing but the delimiter with \S*) changes which lines close it.
    it("a bare \"...\" line closes frontmatter, matching YAML's document-end marker", () => {
        const doc = "---\nkey: 1\n...\nafter[^1]";
        expect(protectedLines(doc.split("\n"))).toEqual([
            true,
            true,
            true,
            false,
        ]);
    });
    it("trailing whitespace after the closing delimiter is still a valid closer", () => {
        const doc = "---\nkey: 1\n---   \nafter";
        expect(protectedLines(doc.split("\n"))).toEqual([
            true,
            true,
            true,
            false,
        ]);
    });
    it("a line with extra non-space text after \"---\" does not close frontmatter", () => {
        const doc = "---\n--- not a closer\nkey: 1\n---";
        expect(protectedLines(doc.split("\n"))).toEqual([
            true,
            true,
            true,
            true,
        ]);
    });

    // line 357: every line from 0 through the closer (inclusive) is
    // protected — `k <= j`, not `k < j`, so the closer line itself is
    // included.
    it("protects every line through the closing delimiter, inclusive", () => {
        const doc = "---\na: 1\nb: 2\n---";
        expect(protectedLines(doc.split("\n"))).toEqual([
            true,
            true,
            true,
            true,
        ]);
    });
});

describe("scanDocument: comment/math region container depth", () => {
    // line 413/417: `startsInComment[i]`/`startsInMath[i]` must be set
    // true for every interior line of an OPEN region — a BooleanLiteral
    // "true" mutant on the else-branch initial value would falsely mark
    // ordinary lines as region-interior too, but since these arrays start
    // false by default we pin the positive case directly per region.
    it("marks every interior line of an open comment region", () => {
        const doc = "<!-- open\nline one\nline two\n-->";
        const scan = scanDocument(doc.split("\n"));
        expect(scan.startsInComment).toEqual([false, true, true, true]);
    });
    it("marks every interior line of an open math region", () => {
        const doc = "$$\nline one\nline two\n$$";
        const scan = scanDocument(doc.split("\n"));
        expect(scan.startsInMath).toEqual([false, true, true, true]);
    });

    // line 430: the closer-line's live suffix can reopen EITHER kind of
    // region — pin that a comment closer whose suffix opens MATH is
    // tracked as math, not comment (rules out the "&&"/bare-inMath
    // mutants that garble which flag gets set).
    it("a comment closer's live suffix can open a NEW math region", () => {
        const doc = "<!-- x\n--> $$\nstill math\n$$\nafter[^1]";
        const scan = scanDocument(doc.split("\n"));
        expect(scan.startsInMath).toEqual([false, false, true, true, false]);
        // opener/closer boundary lines keep their live suffix scannable
        // and are NOT whole-line protected; only the pure interior line
        // ("still math") is
        expect(scan.isProtected).toEqual([false, false, true, false, false]);
    });

    // line 434/436: a BARE closer (nothing live left after trimming NULs)
    // ends a BLOCK — an indented chunk may open on the very next line.
    // A mutant that never sets blockBoundary here would treat the next
    // indented line as a paragraph continuation instead of code.
    it("a bare comment closer ends its block, letting indented code open right after", () => {
        const doc = "<!--\nhidden\n-->\n    code";
        const scan = scanDocument(doc.split("\n"));
        expect(scan.isProtected).toEqual([false, true, false, true]);
    });
    it("a comment closer with live trailing text does NOT end the block (no code opens after)", () => {
        const doc = "<!--\nhidden\n--> tail\n    cont";
        const scan = scanDocument(doc.split("\n"));
        // "tail" is live prose, so the next indented line is a lazy/
        // paragraph continuation, not code
        expect(scan.isProtected).toEqual([false, true, false, false]);
    });

    // line 446: same startsInMath shape as 413/417 but through the math
    // branch's own local check.
    it("interior math lines are protected whole-line", () => {
        const doc = "$$\nprotected content\n$$";
        const scan = scanDocument(doc.split("\n"));
        expect(scan.isProtected).toEqual([false, true, false]);
    });

    // line 456: mirrors 430 — a math closer's live suffix can reopen a
    // COMMENT region.
    it("a math closer's live suffix can open a NEW comment region", () => {
        const doc = "$$\nx\n$$ <!--\nstill comment\n-->\nafter[^1]";
        const scan = scanDocument(doc.split("\n"));
        expect(scan.startsInComment).toEqual([
            false,
            false,
            false,
            true,
            true,
            false,
        ]);
        expect(scan.isProtected).toEqual([
            false,
            true,
            false,
            true,
            false,
            false,
        ]);
    });

    // line 459/461: same bare-closer block-boundary shape as 434/436, for
    // the math branch — including the trim/replace mechanics that decide
    // "bare" (461's MethodExpression/StringLiteral mutants would judge
    // bareness on the wrong string).
    it("a bare math closer ends its block, letting indented code open right after", () => {
        const doc = "$$\nhidden\n$$\n    code";
        const scan = scanDocument(doc.split("\n"));
        expect(scan.isProtected).toEqual([false, true, false, true]);
    });
    it("a math closer with live trailing text does NOT end the block", () => {
        const doc = "$$\nhidden\n$$ tail\n    cont";
        const scan = scanDocument(doc.split("\n"));
        expect(scan.isProtected).toEqual([false, true, false, false]);
    });

    // line 430: a reopened region must record ITS OWN (closer line's)
    // container depth, not the depth the original region opened at. Pin
    // this with a depth CHANGE across the reopen: comment opens at depth
    // 1, its closer reopens math one level DEEPER (depth 2). A shallower
    // depth-1 line right after must then end the (new) region — which
    // only happens if regionDepth was updated to 2, not left at 1.
    it("a comment-to-math reopen at a deeper depth updates regionDepth to the new depth", () => {
        const doc = "> <!--\n> > --> $$\n> after\nplain";
        const scan = scanDocument(doc.split("\n"));
        // "> after" (depth 1) is shallower than the reopened region's
        // depth (2), so the math region has already ended by the time we
        // reach it — it is ordinary live quoted text, not math interior
        expect(scan.isProtected).toEqual([false, false, false, false]);
    });

    // line 456: the same regionDepth-update requirement, for a math region
    // whose closer reopens a COMMENT one level deeper.
    it("a math-to-comment reopen at a deeper depth updates regionDepth to the new depth", () => {
        const doc = "> $$\n> > $$ <!--\n> after\nplain";
        const scan = scanDocument(doc.split("\n"));
        expect(scan.isProtected).toEqual([false, false, false, false]);
    });
});

describe("scanDocument: fence container depth and closer indent", () => {
    // line 476/478: a fence dies when its blockquote ends — pin via a
    // subsequent SAME-depth line staying live (proves inIndentedCode and
    // inDefinition both got reset, not just one of them).
    it("a blockquoted fence's death resets both indented-code and definition state", () => {
        const doc = [
            "> ```",
            "> code",
            "[^1]: def",
            "    cont",
        ].join("\n");
        const scan = scanDocument(doc.split("\n"));
        // the fence dies at line 2 (depth drops to 0); "[^1]: def" is a
        // live definition and "    cont" is its live continuation, not
        // orphaned indented code
        expect(scan.isProtected).toEqual([true, true, false, false]);
    });

    // line 488/490: the closer's indent is measured against the fence's
    // OWN container (`rest`, after stripping blockquote markers) up to
    // contentIndent+3 — pin the exact boundary for a document-level fence
    // (contentIndent 0): 3 spaces closes, 4 does not.
    it("a document-level fence closes with exactly 3 leading spaces", () => {
        const doc = "```\ncode\n   ```\nafter";
        expect(protectedLines(doc.split("\n"))).toEqual([
            true,
            true,
            true,
            false,
        ]);
    });
    it("a document-level fence does NOT close with 4 leading spaces", () => {
        const doc = "```\ncode\n    ```\nswallowed";
        expect(protectedLines(doc.split("\n"))).toEqual([
            true,
            true,
            true,
            true,
        ]);
    });

    // line 491: the closer regex requires 3-or-more of the SAME fence
    // character, anchored, with only trailing whitespace after — pin
    // both the character-run-length requirement and that trailing prose
    // after the delimiter disqualifies it as a closer.
    it("a two-character run does not close a three-character fence", () => {
        const doc = "```\ncode\n``\nstill code\n```\nafter";
        expect(protectedLines(doc.split("\n"))).toEqual([
            true,
            true,
            true,
            true,
            true,
            false,
        ]);
    });
    it("trailing text after the closer's backticks disqualifies it as a closer", () => {
        const doc = "```\ncode\n``` not a closer\nstill code\n```\nafter";
        expect(protectedLines(doc.split("\n"))).toEqual([
            true,
            true,
            true,
            true,
            true,
            false,
        ]);
    });

    // line 495/496: the closer must match the SAME fence character and be
    // at least as long as the opener — a "~~~" never closes a "```" fence
    // (even though both count as valid fence syntax), and a shorter run
    // of the SAME character never closes a longer opener.
    it("a tilde run never closes a backtick fence", () => {
        const doc = "```\ncode\n~~~~\nstill code\n```\nafter";
        expect(protectedLines(doc.split("\n"))).toEqual([
            true,
            true,
            true,
            true,
            true,
            false,
        ]);
    });
    it("a shorter run of the same character never closes a longer opener", () => {
        const doc = "````\ncode\n```\nstill code\n````\nafter";
        expect(protectedLines(doc.split("\n"))).toEqual([
            true,
            true,
            true,
            true,
            true,
            false,
        ]);
    });
});

describe("scanDocument: indented code vs. definition/list continuation", () => {
    // line 540/542: an indented chunk continuing an ALREADY-open indented
    // code block stays protected and blockBoundary stays false — proven
    // by a THIRD consecutive indented-code line staying protected too
    // (only the second line's branch is exercised by a 2-line block).
    it("a third consecutive indented-code line is still protected", () => {
        const doc = "para\n\n    one\n    two\n    three";
        expect(protectedLines(doc.split("\n"))).toEqual([
            false,
            false,
            true,
            true,
            true,
        ]);
    });

    // line 565/566: the list stack pop loop — items are popped only while
    // shallower than the current line's indent; the boundary is
    // STRICTLY-less-than on BOTH the length guard and the indent compare.
    it("a line indented exactly to the list item's content column keeps the item open", () => {
        // content indent for "- " is 2; a line at column 2 continues it,
        // so an 8-space block below (content indent 2 + 4 = 6) is code,
        // not document-level code (would need 4)
        const doc = "- item\n\n  cont[^1]\n\n        code";
        expect(protectedLines(doc.split("\n"))).toEqual([
            false,
            false,
            false,
            false,
            true,
        ]);
    });
    it("a shallower line closes the list item, restoring the document code threshold", () => {
        const doc = "- item\n\n  cont\n\npara\n\n    code";
        // "para" at column 0 is shallower than the item's content column
        // (2), so it pops the list; the later 4-space block is ordinary
        // document-level code again
        expect(protectedLines(doc.split("\n"))).toEqual([
            false,
            false,
            false,
            false,
            false,
            false,
            true,
        ]);
    });

    // line 571: the gap-width rule — 0 or 5+ spaces after the marker
    // count as a gap of 1 (not the literal count); 1-4 spaces count as
    // their literal width. Pin both edges: a huge gap collapses to 1,
    // and a normal 1-space gap is NOT force-collapsed to something else.
    it("five or more spaces after the marker collapse the content indent to marker+1", () => {
        // "-     item" : marker "-" (1 char) + 5 spaces + "item" — content
        // indent collapses to 1+1=2, so a 6-space line is code (2+4)
        const doc = "-     item\n\n      code";
        expect(protectedLines(doc.split("\n"))).toEqual([false, false, true]);
    });
    it("a normal single-space gap uses its literal width, not the collapse rule", () => {
        // "- item": content indent 1+1=2; a 5-space continuation (< 2+4)
        // stays live, matching the ordinary single-space-gap case
        const doc = "- item\n\n     cont[^1]";
        expect(protectedLines(doc.split("\n"))).toEqual([
            false,
            false,
            false,
        ]);
    });
});

describe("scanDocument: fence opener detection on list-item lines", () => {
    // line 598: the fence-open regex, tried a second time against the
    // text AFTER a stripped list marker — anchoring must still require
    // the delimiter at the very start of what remains, and both fence
    // characters must still be accepted (not narrowed to "~" alone).
    it("a fence opens after a list marker is stripped, for both fence characters", () => {
        const doc1 = "- ```\n  code\n  ```\nafter";
        expect(protectedLines(doc1.split("\n"))).toEqual([
            true,
            true,
            true,
            false,
        ]);
        const doc2 = "- ~~~\n  code\n  ~~~\nafter";
        expect(protectedLines(doc2.split("\n"))).toEqual([
            true,
            true,
            true,
            false,
        ]);
    });

    // line 608: contentIndent for a list-marker-hosted fence is the
    // marker's own width PLUS the opener's leading spaces — pin the exact
    // closer boundary this produces (marker width 2 → contentIndent 2,
    // closer accepted up to column 5, rejected at column 6).
    it("a list-item fence's contentIndent accepts a closer up to its content column + 3", () => {
        const doc = "- ```\n  code\n     ```\nafter";
        // "- " content column is 2; closer indented 5 (2+3) still closes
        expect(protectedLines(doc.split("\n"))).toEqual([
            true,
            true,
            true,
            false,
        ]);
    });
    it("a list-item fence's closer one column past content+3 does not close", () => {
        const doc = "- ```\n  code\n      ```\nswallowed";
        expect(protectedLines(doc.split("\n"))).toEqual([
            true,
            true,
            true,
            true,
        ]);
    });
});

describe("scanDocument: region opener trigger and endsProtected", () => {
    // line 622: an opener line's OWN scan for "<!--"/"$$" must run for
    // BOTH constructs, independently — pin that a math opener alone
    // (no "<!--" present) still starts a region.
    it("a display-math opener with no comment token still opens a region", () => {
        const doc = "$$\nbody\n$$";
        const scan = scanDocument(doc.split("\n"));
        expect(scan.startsInMath).toEqual([false, true, true]);
    });

    // line 633: endsProtected is true for a document-level unclosed
    // fence too, not only comment/math — pin the fence half of that OR.
    it("an unclosed document-level fence makes an EOF append protected", () => {
        const scan = scanDocument("```\ncode".split("\n"));
        expect(scan.endsProtected).toBe(true);
    });
    it("a CLOSED fence does not make an EOF append protected", () => {
        const scan = scanDocument("```\ncode\n```".split("\n"));
        expect(scan.endsProtected).toBe(false);
    });
});

describe("maskedLineAt: out-of-range guard", () => {
    // line 680: the range check must reject i >= lines.length, not accept
    // it — a ConditionalExpression "false" mutant would fall through to
    // read lines[i] (undefined) instead of returning "".
    it("returns empty string for an index exactly at lines.length", () => {
        expect(maskedLineAt(["only"], 1)).toBe("");
    });
});

describe("removeLineRanges", () => {
    // line 711: a blank line arriving right after a cut is swallowed when
    // `out` is still empty (document start) OR its last line is already
    // blank — a mutant flipping "out.length === 0" to "!== 0" would stop
    // swallowing the blank exactly when out IS empty, leaving a stray
    // leading blank line that should have merged away to nothing.
    it("swallows a leading blank line after a cut at document start", () => {
        const lines = ["cut1", "", "after"];
        const out = removeLineRanges(lines, [{ start: 0, end: 0 }]);
        expect(out).toEqual(["after"]);
    });

    // line 722/723: the setext-residue guard fires only when `out` is
    // NON-empty and its last line is non-blank — pin the exact case
    // (out empty, "---" survives text) that must NOT get a guard blank,
    // versus the case that must.
    it("does not guard against a stranded \"---\" when it is the very first output line", () => {
        const lines = ["cut1", "---"];
        const out = removeLineRanges(lines, [{ start: 0, end: 0 }]);
        // out is empty when "---" arrives — the setext guard (722/723) is
        // for non-empty out; the SEPARATE start-of-document rule (733)
        // handles this case by inserting a leading blank instead
        expect(out).toEqual(["", "---"]);
    });
    it("guards a stranded \"---\" from becoming a setext heading underline", () => {
        const lines = ["para", "cut1", "---"];
        const out = removeLineRanges(lines, [{ start: 1, end: 1 }]);
        expect(out).toEqual(["para", "", "---"]);
    });

    // line 724: the setext-residue regex — anchored both ends, allows
    // 0-3 leading spaces, and the underline is ALL "-" or ALL "=" (mixed
    // characters, or a non-underline trailing character, must NOT match).
    it("a stray dash-string that is not a valid setext underline is not guarded", () => {
        const lines = ["para", "cut1", "-- not --"];
        const out = removeLineRanges(lines, [{ start: 1, end: 1 }]);
        expect(out).toEqual(["para", "-- not --"]);
    });
    it("a blockquoted setext underline is still recognized behind its prefix", () => {
        const lines = ["> para", "> cut1", "> ---"];
        const out = removeLineRanges(lines, [{ start: 1, end: 1 }]);
        expect(out).toEqual(["> para", "", "> ---"]);
    });

    // line 733/734: a cut landing "---" at document start (out still
    // empty) must not let it parse as a frontmatter opener — a leading
    // blank line is inserted instead.
    it("promotes a document-start \"---\" survivor with a leading blank guard", () => {
        const lines = ["cut1", "---", "body"];
        const out = removeLineRanges(lines, [{ start: 0, end: 0 }]);
        expect(out).toEqual(["", "---", "body"]);
    });
    it("does not add the document-start guard when the surviving line is not exactly \"---\"", () => {
        const lines = ["cut1", "--- not exactly"];
        const out = removeLineRanges(lines, [{ start: 0, end: 0 }]);
        expect(out).toEqual(["--- not exactly"]);
    });
});

describe("findDefinitionBlocks", () => {
    // line 757: a protected line that does NOT start a comment/math region
    // (ordinary fenced/indented-code protection) must BREAK the block, not
    // be silently absorbed — an empty-BlockStatement mutant on the
    // absorption branch wouldn't affect this at all, but a
    // ConditionalExpression "true" mutant on the guard would wrongly
    // absorb it.
    it("stops the block at a protected fence line, not a comment/math region", () => {
        const doc = "x[^1]\n\n[^1]: a\n    cont\n```\nfence\n```";
        const lines = doc.split("\n");
        const scan = scanDocument(lines);
        expect(findDefinitionBlocks(lines, scan.isProtected, scan)).toEqual([
            { name: "1", start: 2, end: 3 },
        ]);
    });

    // line 763: absorption requires the scan object AND one of its two
    // flags — pin that with NO scan argument at all, a protected
    // continuation still correctly breaks the block (the caller-optional
    // path), proving the function doesn't crash or wrongly absorb without
    // scan data.
    it("without a scan argument, a protected line always ends the block", () => {
        const doc = "x[^1]\n\n[^1]: a\n    cont\n```\nfence\n```";
        const lines = doc.split("\n");
        const isProtected = scanDocument(lines).isProtected;
        expect(findDefinitionBlocks(lines, isProtected)).toEqual([
            { name: "1", start: 2, end: 3 },
        ]);
    });

    // line 773: a blank run continues the block only when it's followed
    // by indented content — pin that IndentedContent is tested against
    // `lines[k]` (the line AFTER the blank run), not the blank line
    // itself (which would never match \s+\S and always break).
    it("a blank run followed by indented content continues the block", () => {
        const doc = "[^1]: a\n\n    more";
        const lines = doc.split("\n");
        const isProtected = scanDocument(lines).isProtected;
        expect(findDefinitionBlocks(lines, isProtected)).toEqual([
            { name: "1", start: 0, end: 2 },
        ]);
    });
    it("a blank run followed by a column-0 line ends the block at the blank", () => {
        const doc = "[^1]: a\n\nnot indented";
        const lines = doc.split("\n");
        const isProtected = scanDocument(lines).isProtected;
        expect(findDefinitionBlocks(lines, isProtected)).toEqual([
            { name: "1", start: 0, end: 0 },
        ]);
    });

    // line 777/779: the inner "how far does the blank run extend" walk,
    // and the guard that the line found after it is both unprotected AND
    // indented — pin a PROTECTED indented line after the blank (fenced
    // code) does NOT continue the block.
    it("indented content after a blank run does not continue the block when it is protected code", () => {
        const doc = "[^1]: a\n\n```\n    fenced\n```";
        const lines = doc.split("\n");
        const scan = scanDocument(lines);
        expect(findDefinitionBlocks(lines, scan.isProtected, scan)).toEqual([
            { name: "1", start: 0, end: 0 },
        ]);
    });
    it("a multi-line blank run is walked past correctly to find the next content", () => {
        const doc = "[^1]: a\n\n\n\n    more";
        const lines = doc.split("\n");
        const isProtected = scanDocument(lines).isProtected;
        expect(findDefinitionBlocks(lines, isProtected)).toEqual([
            { name: "1", start: 0, end: 4 },
        ]);
    });
});

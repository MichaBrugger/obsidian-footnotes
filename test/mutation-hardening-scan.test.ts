import { describe, expect, it } from "vitest";

import { referenceOccurrences } from "../src/parsing/footnote-grammar";

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
} from "../src/parsing/markdown-scan";

// These tests exist to kill Stryker survivors from the 2026-08-10 baseline
// listed in survivors-markdown-scan.json (144 mutants against
// src/markdown-scan.ts). Organized by scanner region, in file order, so a
// mutant's line number maps to the `describe` block that targets it.

const NUL = (n: number) => "\0".repeat(n);

describe("normalizeEol / restoreEol", () => {
    // line 51: the LF branch's eol tag must be exactly "\n" - a mutant that
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
    // ">" - a 4th space is one too many and the ">" stays literal text
    // instead of opening a nested quote. Proven through a fence: a nested
    // quote's fence at depth 2 must protect its body; text that fails to
    // nest never opens that fence.
    it("three leading spaces still let a nested quote marker open a fence", () => {
        // "> " (marker+optional space) then exactly 3 more spaces then the
        // nested ">" - the legal CommonMark maximum
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
        // which never opens a fence - since bug-blockquote-indented-code
        // (2026-08-11, ground-truth probe P10) it is quote-relative
        // INDENTED CODE instead, so the line is protected as code and the
        // next line is live (a fence would have swallowed it)
        expect(protectedLines(doc.split("\n"))).toEqual([true, false]);
    });

    // line 81: the ONE optional space after a ">" marker belongs to the
    // marker and must not appear in `rest` - proven via fence-opener
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
        // column (contentIndent 0 + 3 max == 3) - it must NOT close, so
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
    // line 106: nameEnd is prefix + 2 + the captured name's length - a
    // mutant that subtracts the label length instead of adding it would
    // make nameEnd walk backward for any name longer than 2 chars.
    it("nameEnd advances past a multi-character name, not backward", () => {
        const label = definitionLabelIn("[^long-name]: text");
        expect(label).not.toBeNull();
        expect(label?.nameStart).toBe(2);
        expect(label?.nameEnd).toBe(2 + "long-name".length);
        expect(label?.labelEnd).toBe("[^long-name]:".length);
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
    // backtick (CommonMark) - such a line is an inline code span in a
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

// insideReferenceShape is an internal (unexported) helper, so it is pinned
// indirectly through maskLineRegions, which is the only way its result is
// observable through the public API.
describe("insideReferenceShape (observed through maskLineRegions)", () => {
    // line 147: the backward scan uses "j >= 0", so it must still inspect
    // index 0 itself - a mutant stopping at "j > 0" would skip the very
    // first character and miss a "[^" that starts the line, wrongly
    // treating BOTH id-internal dollars below as math openers/closers.
    it("recognizes a reference bracket that starts the line (index 0)", () => {
        const line = "[^a$b$c]";
        // both dollars are footnote-id characters; neither opens math
        expect(maskLineRegions(line).masked).toBe(line);
    });

    // line 150: a "[" found while walking back only counts as a reference
    // opener when immediately followed by "^" - a mutant that returns
    // `true` unconditionally would treat this plain "[...]" bracket as a
    // reference too, suppressing a math span that should otherwise mask.
    it("a bracket without a caret does not suppress math scanning", () => {
        const { masked } = maskLineRegions("[x$y$ done");
        expect(masked).toBe("[x" + NUL(3) + " done");
    });
});

// Backticks inside a footnote-reference shape are literal, like dollars
// (Jason's find 2026-09-08, verified live: Obsidian tokenizes "[^…]" before
// it pairs backticks - "[^aa`a] [^bb#b] [^cc`c]" renders no code span and
// "[^bb#b]" is a live footnote, while the scanner paired the two backticks
// into one span and reported ONE merged name). Validity is a separate
// question: a name with a backtick is still invalid; it is now FOUND so it
// can be reported.
describe("backticks inside a footnote reference are literal (2026-09-08)", () => {
    const line = "x [^aa`a] [^bb#b] [^cc`c] y";

    it("pairs no code span across two references", () => {
        expect(maskLineRegions(line).masked).toBe(line);
    });

    it("so the reference finder sees all three names", () => {
        expect(referenceOccurrences(line, maskLineRegions(line).masked).map((o) => o.name)).toEqual([
            "aa`a",
            "bb#b",
            "cc`c",
        ]);
    });

    it("a backtick inside a reference can't CLOSE a span opened outside it either", () => {
        // the closer guard: the real closer is the last backtick, so the
        // whole stretch is one code span (the dollar rule's twin)
        const spanned = "`code [^a`b] end` tail";
        expect(maskLineRegions(spanned).masked).toBe(NUL("`code [^a`b] end`".length) + " tail");
    });

    it("ordinary code spans still mask, reference-shaped content included", () => {
        expect(maskLineRegions("a `[^x]` b").masked).toBe("a " + NUL(6) + " b");
        expect(maskLineRegions("use `git log` and [^n`ote]").masked).toBe(
            "use " + NUL("`git log`".length) + " and [^n`ote]",
        );
    });

    it("a bracket without a caret does not protect its backtick", () => {
        expect(maskLineRegions("[x`y`] z").masked).toBe("[x" + NUL(3) + "] z");
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
            { comment: true },
        );
        expect(masked).toBe(NUL("no closer on this line".length));
        expect(endsInComment).toBe(true);
        expect(endsInMath).toBe(false);
    });

    // line 188: `i` must resume scanning exactly AFTER the "-->" closer -
    // resuming 6 chars too early re-exposes an already-blotted opener
    // region to a fresh code-span scan, changing the final mask.
    it("resumes scanning exactly after the comment closer, not before it", () => {
        const line = "`ab--> cd`e";
        const { masked } = maskLineRegions(line, { comment: true });
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
            { math: true },
        );
        expect(masked).toBe(NUL("still inside the block".length));
        expect(endsInMath).toBe(true);
        expect(endsInComment).toBe(false);
    });

    // line 199: `i` must resume exactly after "$$" (2 chars), not before.
    it("resumes scanning exactly after the math closer, not before it", () => {
        const line = "`ab$$ cd`e";
        const { masked } = maskLineRegions(line, { math: true });
        expect(masked).toBe(NUL(5) + " cd`e");
    });
});

describe("maskLineRegions: main scan loop bounds and escapes", () => {
    // line 203: the while loop's bound is `i < line.length` - an off-by-one
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
    // - a mutant that always accepts (ConditionalExpression true) would
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
    // close + runLength - a mutant that subtracts instead would rewind
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
    // §6.6) - advancing i by anything other than +5 would either re-scan
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
    // false - a BooleanLiteral mutant flipping it to true would make a
    // plain unclosed HTML comment masquerade as an open math block on the
    // NEXT line (wrong continuation branch entirely).
    it("an unclosed comment does not also claim to be an open math block", () => {
        const { endsInMath } = maskLineRegions("x <!-- open");
        expect(endsInMath).toBe(false);
    });
});

describe("maskLineRegions: dollar / math scanning", () => {
    // line 259: the "$" branch's own conditional gate - flipping it to
    // "true" wouldn't change $-handling directly, but skipping it (dead
    // code around it) is exercised implicitly by every math test below;
    // pin the base case where a dollar opens ordinary inline math.
    it("a simple inline math span is masked end to end", () => {
        const { masked } = maskLineRegions("$x+y$ done");
        expect(masked).toBe(NUL("$x+y$".length) + " done");
    });

    // line 261: a dollar inside a footnote reference must be skipped
    // (i++, continue) rather than treated as an opener - an empty
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
    // reports endsInMath - mirrors the comment case at line 245.
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

    // line 295-299: the four-way guard that REJECTS a "$...$" candidate -
    // no closer found, empty content, leading space, or trailing space.
    // Each must independently veto math; only when none apply does it
    // mask. Reordering the guard as a chained AND/OR (LogicalOperator
    // mutants) or dropping any single clause changes which of these four
    // shapes gets (wrongly) treated as math.
    it("no closing dollar at all leaves both dollars as literal prose", () => {
        expect(maskLineRegions("a $b c").masked).toBe("a $b c");
    });
    // NOTE: "close === i + 1" (empty inline-math content) is unreachable in
    // practice - two adjacent unescaped dollars are always caught by the
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
    // after the closing "$" (close+1) - off by one either re-scans the
    // dollar or skips the character right after it.
    it("resumes scanning exactly after the closing dollar of inline math", () => {
        const line = "$a$`b`";
        const { masked } = maskLineRegions(line);
        expect(masked).toBe(NUL("$a$".length) + NUL("`b`".length));
    });
});

describe("scanDocument: YAML frontmatter", () => {
    // line 354: the closing-scan loop bound `j < src.length` - an off-by-
    // one would either miss the last line as a possible closer or read
    // past the array.
    it("a closing \"---\" on the very last line still closes frontmatter", () => {
        const doc = "---\nkey: 1\n---";
        expect(protectedLines(doc.split("\n"))).toEqual([true, true, true]);
    });

    // line 355: the closer regex accepts "---" or "..." with only
    // trailing whitespace - anchoring differently (no "^", or requiring
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
    // protected - `k <= j`, not `k < j`, so the closer line itself is
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
    // true for every interior line of an OPEN region - a BooleanLiteral
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
    // region - pin that a comment closer whose suffix opens MATH is
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
    // ends a BLOCK - an indented chunk may open on the very next line.
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

    // line 456: mirrors 430 - a math closer's live suffix can reopen a
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
    // the math branch - including the trim/replace mechanics that decide
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
    // depth-1 line right after must then end the (new) region - which
    // only happens if regionDepth was updated to 2, not left at 1.
    it("a comment-to-math reopen at a deeper depth updates regionDepth to the new depth", () => {
        const doc = "> <!--\n> > --> $$\n> after\nplain";
        const scan = scanDocument(doc.split("\n"));
        // "> after" (depth 1) is shallower than the reopened region's
        // depth (2), so the math region has already ended by the time we
        // reach it - it is ordinary live quoted text, not math interior
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
    // line 476/478: a fence dies when its blockquote ends - pin via a
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
    // contentIndent+3 - pin the exact boundary for a document-level fence
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
    // character, anchored, with only trailing whitespace after - pin
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
    // at least as long as the opener - a "~~~" never closes a "```" fence
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
    // code block stays protected and blockBoundary stays false - proven
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

    // line 565/566: the list stack pop loop - items are popped only while
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

    // line 571: the gap-width rule - 0 or 5+ spaces after the marker
    // count as a gap of 1 (not the literal count); 1-4 spaces count as
    // their literal width. Pin both edges: a huge gap collapses to 1,
    // and a normal 1-space gap is NOT force-collapsed to something else.
    it("five or more spaces after the marker collapse the content indent to marker+1", () => {
        // "-     item" : marker "-" (1 char) + 5 spaces + "item" - content
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
    // text AFTER a stripped list marker - anchoring must still require
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
    // marker's own width PLUS the opener's leading spaces - pin the exact
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
    // BOTH constructs, independently - pin that a math opener alone
    // (no "<!--" present) still starts a region.
    it("a display-math opener with no comment token still opens a region", () => {
        const doc = "$$\nbody\n$$";
        const scan = scanDocument(doc.split("\n"));
        expect(scan.startsInMath).toEqual([false, true, true]);
    });

    // line 633: endsProtected is true for a document-level unclosed
    // fence too, not only comment/math - pin the fence half of that OR.
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
    // it - a ConditionalExpression "false" mutant would fall through to
    // read lines[i] (undefined) instead of returning "".
    it("returns empty string for an index exactly at lines.length", () => {
        expect(maskedLineAt(["only"], 1)).toBe("");
    });
});

describe("removeLineRanges", () => {
    // line 711: a blank line arriving right after a cut is swallowed when
    // `out` is still empty (document start) OR its last line is already
    // blank - a mutant flipping "out.length === 0" to "!== 0" would stop
    // swallowing the blank exactly when out IS empty, leaving a stray
    // leading blank line that should have merged away to nothing.
    it("swallows a leading blank line after a cut at document start", () => {
        const lines = ["cut1", "", "after"];
        const out = removeLineRanges(lines, [{ start: 0, end: 0 }]);
        expect(out).toEqual(["after"]);
    });

    // line 722/723: the setext-residue guard fires only when `out` is
    // NON-empty and its last line is non-blank - pin the exact case
    // (out empty, "---" survives text) that must NOT get a guard blank,
    // versus the case that must.
    it("does not guard against a stranded \"---\" when it is the very first output line", () => {
        const lines = ["cut1", "---"];
        const out = removeLineRanges(lines, [{ start: 0, end: 0 }]);
        // out is empty when "---" arrives - the setext guard (722/723) is
        // for non-empty out; the SEPARATE start-of-document rule (733)
        // handles this case by inserting a leading blank instead
        expect(out).toEqual(["", "---"]);
    });
    it("guards a stranded \"---\" from becoming a setext heading underline", () => {
        const lines = ["para", "cut1", "---"];
        const out = removeLineRanges(lines, [{ start: 1, end: 1 }]);
        expect(out).toEqual(["para", "", "---"]);
    });

    // line 724: the setext-residue regex - anchored both ends, allows
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
    // empty) must not let it parse as a frontmatter opener - a leading
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
    // be silently absorbed - an empty-BlockStatement mutant on the
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
    // flags - pin that with NO scan argument at all, a protected
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
    // by indented content - pin that IndentedContent is tested against
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
    // indented - pin a PROTECTED indented line after the blank (fenced
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

// Round 2: hardening against the 66 mutants that survived round 1's suite
// (survivors-scan-round2.json), verified by hand-applying each mutation to a
// scratch copy of the source and confirming the exact output divergence
// before writing the assertion below. Organized in file order, matching
// round 1's convention. Equivalence proofs for the mutants that cannot be
// distinguished through the exported API are collected in the trailing
// comment block.

describe("round 2", () => {
    describe("insideReferenceShape: reference-internal dollar must not leak into math scanning", () => {
        // line 261: the guard that skips a "$" sitting inside "[^…]" - both
        // the BlockStatement "{}" mutant (empties the skip body) and the
        // ConditionalExpression "false" mutant (never takes the skip branch)
        // let that "$" fall into the ordinary math-opener logic instead.
        // With a footnote reference immediately followed (no separator) by
        // a real math span, the reference's internal "$" then pairs with
        // the LATER "]$" as a bogus closer before the scanner ever reaches
        // the genuine "$y$" - a completely different mask than leaving the
        // reference alone and masking only "$y$".
        it("a dollar immediately after a reference is not treated as a math opener", () => {
            const line = "[^a$b]$y$";
            expect(maskLineRegions(line).masked).toBe("[^a$b]" + NUL(3));
        });
    });

    describe("maskLineRegions: display math close-not-found guard", () => {
        // line 267: forcing "close === -1" to always true makes a CLOSED
        // "$$...$$" span on one line get treated as unclosed - blotting to
        // end of line and wrongly reporting endsInMath, instead of closing
        // normally and leaving the trailing prose live.
        it("a closed display-math span on one line does not blot past its closer", () => {
            const { masked, endsInMath } = maskLineRegions("x $$disp$$ y");
            expect(masked).toBe("x " + NUL("$$disp$$".length) + " y");
            expect(endsInMath).toBe(false);
        });
    });

    describe("maskLineRegions: inline math closer resume cursor", () => {
        // line 304: after a successful inline-math match, "i" must resume
        // at "close + 1" - the ArithmeticOperator mutant "close - 1" rewinds
        // INTO the just-matched span's last content character, letting it
        // reopen as a fresh code-span/math scan and blot a different (wider,
        // in this case: also swallowing "` `" after the math) region than
        // the correct one.
        it("resumes exactly after the closing dollar, not one character early", () => {
            const line = "$a`$ `z`";
            expect(maskLineRegions(line).masked).toBe(NUL(4) + " " + NUL(3));
        });
    });

    describe("scanDocument: YAML frontmatter closer regex and resume index", () => {
        // line 355: the closer regex must be anchored at the start ("^") -
        // dropping the anchor lets a line that merely ENDS with "---"
        // (e.g. arbitrary prose) falsely close the frontmatter early,
        // before the real "---" delimiter is reached.
        it("a line that only ends with \"---\" does not close frontmatter early", () => {
            const doc = "---\nnotaclose---\nkey: 1\n---\nafter";
            expect(protectedLines(doc.split("\n"))).toEqual([
                true,
                true,
                true,
                true,
                false,
            ]);
        });

        // line 357: after closing frontmatter, the main scan must resume at
        // "j + 1" (right after the closer) - the ArithmeticOperator mutant
        // "j - 1" rewinds the main scan into the frontmatter body itself,
        // re-processing a line that happens to look like a fence opener and
        // letting that bogus fence swallow the real closer and everything
        // after it.
        it("resumes the main scan exactly after the frontmatter closer, not inside it", () => {
            const doc = "---\n```\n---\nafter\n```\nmore";
            expect(protectedLines(doc.split("\n"))).toEqual([
                true,
                true,
                true,
                false,
                true,
                true,
            ]);
        });
    });

    describe("scanDocument: comment/math closer's own block-boundary decision", () => {
        // line 434: the bare-closer-ends-a-block check's full condition
        // (ConditionalExpression "true") - forcing it true makes EVERY
        // comment closer end a block, even one with live trailing text
        // still on the line, wrongly opening fresh indented code right
        // after it.
        it("a comment closer with live trailing text does not open code on the next line", () => {
            const doc = "<!--\nhidden\n--> tail\n    cont";
            const scan = scanDocument(doc.split("\n"));
            expect(scan.isProtected).toEqual([false, true, false, false]);
        });

        // line 434: the LogicalOperator mutant ("&&" -> "||" between the
        // two negated flags) only diverges when the closer's suffix
        // reopens EXACTLY ONE of comment/math - this iteration's wrongly
        // forced blockBoundary=true is normally overwritten before it can
        // matter (the very next line re-enters the interior branch, which
        // resets it), UNLESS that next line's blockquote depth is shallow
        // enough to end the reopened region via the depth-drop path
        // (which does not touch blockBoundary). A comment reopening MATH
        // one quote-level deeper, followed by a plain (unquoted) indented
        // line, exposes the stale wrongly-true value as bogus fresh code.
        it("a deeper same-line region reopen does not leak a stale block boundary past the quote drop", () => {
            const doc = "> <!--\n> > --> $$\n    indented";
            const scan = scanDocument(doc.split("\n"));
            expect(scan.isProtected).toEqual([false, false, false]);
        });

        // line 459: the math-branch mirror of the two checks above.
        it("a math closer with live trailing text does not open code on the next line", () => {
            const doc = "$$\nx\n$$ tail\n    cont";
            const scan = scanDocument(doc.split("\n"));
            expect(scan.isProtected).toEqual([false, true, false, false]);
        });
        it("a deeper same-line comment reopen (from a math closer) does not leak a stale block boundary", () => {
            const doc = "> $$\n> > $$ <!--\n    indented";
            const scan = scanDocument(doc.split("\n"));
            expect(scan.isProtected).toEqual([false, false, false]);
        });
    });

    describe("scanDocument: fence closer indent while-loop", () => {
        // line 488: the leading-space-count while-loop's condition -
        // forcing it to "true" drops the "rest[lead] === ' '" check
        // entirely, so the loop never terminates (lead climbs forever
        // with no bound). Any fence-closer check reaches this loop, so a
        // nested-blockquote closer at the exact contentIndent+3 boundary
        // both pins the boundary AND would hang forever under this mutant.
        it("a doubly-quoted fence closes with a closer at exactly contentIndent + 3", () => {
            const doc = "> > ```\n> > code\n> >    ```\n> > after";
            expect(protectedLines(doc.split("\n"))).toEqual([
                true,
                true,
                true,
                false,
            ]);
        });
    });

    describe("scanDocument: fence closer regex anchoring and character run", () => {
        // line 491: dropping the "^" anchor lets text BEFORE the closing
        // run (e.g. leftover content on a content line) satisfy the
        // closer pattern as long as it ENDS with a valid delimiter run -
        // a content line like "xyz```" must NOT close the fence.
        it("a content line that merely ends with backticks does not close the fence", () => {
            const doc = "```\ncode\nxyz```\nafter";
            expect(protectedLines(doc.split("\n"))).toEqual([
                true,
                true,
                true,
                true,
            ]);
        });

        // line 491: changing the trailing "\s*$" to "\S*$" rejects a
        // closer that has trailing WHITESPACE after its delimiter run,
        // even though CommonMark allows that.
        it("a closer with trailing whitespace after the delimiter still closes the fence", () => {
            const doc = "```\ncode\n```   \nafter";
            expect(protectedLines(doc.split("\n"))).toEqual([
                true,
                true,
                true,
                false,
            ]);
        });
    });

    describe("scanDocument: indented-code branches' own blockBoundary write", () => {
        // line 542: the branch that OPENS a fresh indented-code block sets
        // blockBoundary=false - forcing it "true" (BooleanLiteral) leaks a
        // false block-boundary signal into the very next line's list-stack
        // pop decision (line 519), which can wrongly pop a list item that
        // is still open, lowering the code-indent threshold for a later
        // line that should NOT yet qualify as code.
        it("opening indented code does not leak a stale block boundary into the next line's list-stack pop", () => {
            const doc = "- item\n\n      one\n# h\n    four";
            expect(protectedLines(doc.split("\n"))).toEqual([
                false,
                false,
                true,
                false,
                false,
            ]);
        });

        // line 532: same shape, but for the branch that CONTINUES an
        // already-open indented-code block (needs a second consecutive
        // indented line to reach the mutated branch instead of the
        // opening one).
        it("continuing indented code does not leak a stale block boundary into the next line's list-stack pop", () => {
            const doc = "- item\n\n      one\n      two\n# h\n    four";
            expect(protectedLines(doc.split("\n"))).toEqual([
                false,
                false,
                true,
                true,
                false,
                false,
            ]);
        });
    });

    describe("scanDocument: list-marker pop loop (a NEW marker popping shallower items)", () => {
        // line 565: forcing the pop loop's condition to "false" (and,
        // identically in effect, the EqualityOperator mutant that turns
        // "listStack.length > 0" into "listStack.length <= 0", which is
        // false whenever the length check would matter) means a new,
        // narrower list marker never pops a wider sibling that came
        // before it. The stale wide entry stays buried under the new
        // marker's own (immediately-matching) push, invisible until a
        // later query pops back down THROUGH the new top and re-exposes
        // it - at which point a code-indent threshold survives that
        // should have been cleared.
        it("a narrower sibling list marker correctly pops away a wider marker that preceded it", () => {
            const doc = "- a\n123456789. b\n\n     d";
            expect(protectedLines(doc.split("\n"))).toEqual([
                false,
                false,
                false,
                true,
            ]);
        });

        // line 565: forcing the condition to "true" turns the loop into
        // "while (true) listStack.pop();" - an unconditional infinite
        // loop the instant any list marker is seen at all, since pop() on
        // an empty array is a silent no-op that never breaks it.
        it("does not hang when a list marker line is scanned (565 while-true guard)", () => {
            const doc = "- a\n  b";
            expect(protectedLines(doc.split("\n"))).toEqual([false, false]);
        });

        // line 566: the EqualityOperator mutant "indentWidth <= top"
        // (instead of "<") also pops when a NESTED marker's indent lands
        // EXACTLY ON its parent's content column - which should nest
        // INSIDE the parent, not replace it. The same doubly-nested +
        // reveal shape as above (526's arithmetic sibling: pop the shared
        // top, see what is left underneath) exposes the wrongly-cleared
        // parent as a missing code-indent threshold.
        it("a nested marker landing exactly on its parent's content column nests instead of replacing it", () => {
            const doc = "- a\n  - b\n\n  para\n\n     d";
            expect(protectedLines(doc.split("\n"))).toEqual([
                false,
                false,
                false,
                false,
                false,
                false,
            ]);
        });

        // line 566: forcing the whole condition to "true" is the same
        // unconditional-infinite-pop hazard as 565's true-mutant.
        it("does not hang when a list marker line is scanned (566 while-true guard)", () => {
            const doc = "- a\n  b";
            expect(protectedLines(doc.split("\n"))).toEqual([false, false]);
        });
    });

    describe("scanDocument: list-marker gap-width collapse rule", () => {
        // line 571: a marker with NOTHING after it (matched via the "$"
        // alternative in the marker regex) captures an EMPTY gap group.
        // The ConditionalExpression "false" mutant (never collapses,
        // always uses the literal - here 0) and the EqualityOperator
        // mutant "length !== 0" (collapses on any NON-zero length instead
        // of on zero) both mishandle this zero-length case, giving the
        // bare marker the wrong content indent.
        it("a bare list marker with nothing after it still gets content indent = marker width + 1", () => {
            const doc = "-\n\n     code";
            expect(protectedLines(doc.split("\n"))).toEqual([
                false,
                false,
                false,
            ]);
        });

        // line 571: a gap of EXACTLY 4 spaces must use its LITERAL width
        // (CommonMark: only 5+ collapses to 1) - the ConditionalExpression
        // "true" mutant (always collapses to 1) and the EqualityOperator
        // mutant "length >= 4" (collapses starting at 4, not 5) both
        // wrongly collapse this boundary case.
        it("a four-space gap after the marker uses its literal width, not the collapse rule", () => {
            const doc = "-    item\n\n       code";
            expect(protectedLines(doc.split("\n"))).toEqual([
                false,
                false,
                false,
            ]);
        });
    });

    describe("scanDocument: fence-open regex on a stripped list-marker remainder", () => {
        // line 598: dropping the "^" anchor lets ordinary prose text
        // BEFORE a backtick run (after the list marker is stripped) count
        // as a fence opener, as long as it ENDS with 3+ backticks.
        it("prose ending in backticks after a list marker does not open a fence", () => {
            const doc = "- xyz```\ncontent\nafter";
            expect(protectedLines(doc.split("\n"))).toEqual([
                false,
                false,
                false,
            ]);
        });

        // line 598: dropping the "{3,}" quantifier on the tilde branch
        // (leaving a bare "~") lets just ONE or TWO tildes open a fence,
        // even though CommonMark requires 3+.
        it("two tildes after a list marker do not open a fence", () => {
            const doc = "- ~~text\ncontent\nafter";
            expect(protectedLines(doc.split("\n"))).toEqual([
                false,
                false,
                false,
            ]);
        });
    });

    describe("scanDocument: list-item fence contentIndent arithmetic", () => {
        // line 608: contentIndent must ADD the fence opener's own leading
        // spaces to the stripped-prefix length - the ArithmeticOperator
        // mutant subtracts them instead, which goes negative whenever the
        // opener itself is indented (no list marker involved: the
        // "stripped-prefix length" term is 0, isolating the sign flip).
        // A negative contentIndent then rejects a closer indented to
        // match the opener, which CommonMark explicitly allows.
        it("a document-level fence opener with leading spaces still accepts a closer indented to match it", () => {
            const doc = "   ```\ncode\n   ```\nafter";
            expect(protectedLines(doc.split("\n"))).toEqual([
                true,
                true,
                true,
                false,
            ]);
        });
    });

    describe("scanDocument: endsProtected's fence clause", () => {
        // line 633: forcing the fence clause to "true" makes endsProtected
        // always true, even for a document with no fence, comment, or math
        // open at all.
        it("endsProtected is false for a document with nothing open at EOF", () => {
            expect(scanDocument("plain\ntext".split("\n")).endsProtected).toBe(
                false,
            );
        });
    });

    describe("maskedLineAt: negative index guard", () => {
        // line 680: forcing the range guard to "false" means a NEGATIVE
        // index also falls through to "lines[i]" (undefined) instead of
        // returning "" - round 1 only pinned the upper bound (i ===
        // lines.length); this pins the lower bound, which crashes instead
        // of just returning a wrong value.
        it("returns empty string for a negative index instead of crashing", () => {
            expect(maskedLineAt(["only"], -1)).toBe("");
        });
    });

    describe("removeLineRanges: blank-swallow guard's third clause", () => {
        // line 711: forcing the "out is empty OR ends in a blank" clause
        // to "true" swallows a blank line after a cut even when the
        // surviving output so far is non-blank - a blank that legitimately
        // separates two paragraphs must survive the cut, not vanish.
        it("does not swallow a blank line that legitimately separates two surviving paragraphs", () => {
            const out = removeLineRanges(
                ["keep", "cut1", "", "after"],
                [{ start: 1, end: 1 }],
            );
            expect(out).toEqual(["keep", "", "after"]);
        });
    });

    describe("removeLineRanges: setext-residue guard's own gating clauses", () => {
        // line 722/723: the guard must require BOTH out.length > 0 AND the
        // last output line to be non-blank. The EqualityOperator mutant
        // "length >= 0" (always true - length is never negative) drops the
        // length gate; proven with an EMPTY out where the survivor is
        // "===" (a valid setext underline but not literally "---", so the
        // separate doc-start rule at line 733 does not also fire and mask
        // the difference).
        it("does not add a setext guard blank when out is still empty (length gate)", () => {
            const out = removeLineRanges(["cut1", "==="], [{ start: 0, end: 0 }]);
            expect(out).toEqual(["==="]);
        });

        // line 723: the guard must not fire when the last output line IS
        // already blank (a blank already separates the surviving text from
        // the setext-looking line, so no extra guard blank is needed).
        // This single case kills all three col-723 mutants: the
        // ConditionalExpression "true", the ArithmeticOperator
        // "length + 1" (reads one past the array, always undefined, always
        // "!== \"\""), and the StringLiteral swap to a string the array
        // will never contain (also always "!== " that string) - all three
        // make this clause unconditionally true.
        it("does not add a redundant setext guard blank when the last output line is already blank", () => {
            const out = removeLineRanges(
                ["para", "", "cut1", "---"],
                [{ start: 2, end: 2 }],
            );
            expect(out).toEqual(["para", "", "---"]);
        });
    });

    describe("removeLineRanges: setext-residue regex shape", () => {
        // line 724: swapping the leading "\s{0,3}" for "\S{0,3}" rejects a
        // setext underline that has 1-3 leading spaces (CommonMark allows
        // up to 3) - the class-swap only matters when there IS leading
        // whitespace to consume, since "{0,3}" is satisfied trivially by
        // zero characters either way.
        it("a setext underline with leading whitespace (within CommonMark's 3-space limit) is still guarded", () => {
            const out = removeLineRanges(
                ["para", "cut1", "  ---"],
                [{ start: 1, end: 1 }],
            );
            expect(out).toEqual(["para", "", "  ---"]);
        });

        // line 724: swapping the trailing "\s*$" for "\S*$" rejects a
        // setext underline that has trailing whitespace after the
        // delimiter run.
        it("a setext underline with trailing whitespace is still guarded", () => {
            const out = removeLineRanges(
                ["para", "cut1", "---   "],
                [{ start: 1, end: 1 }],
            );
            expect(out).toEqual(["para", "", "---   "]);
        });

        // line 724: dropping the "+" quantifier on the equals branch
        // (leaving a bare "=") rejects a MULTI-character "===" run, since
        // the bare "=" can only consume one character, leaving the rest
        // unconsumed before the trailing "\s*$" anchor.
        it("a multi-character equals-run setext underline is still guarded", () => {
            const out = removeLineRanges(
                ["para", "cut1", "==="],
                [{ start: 1, end: 1 }],
            );
            expect(out).toEqual(["para", "", "==="]);
        });
    });

    describe("findDefinitionBlocks: protected-line absorb guard", () => {
        // line 757: the BlockStatement "{}" mutant (empties the whole
        // isProtected-handling branch) and the ConditionalExpression
        // "false" mutant (never enters it) both have the SAME externally
        // visible effect - a protected line falls through to the
        // IndentedContent/blank-run checks below instead of being
        // absorbed-or-broken by its own logic. An indented comment-region
        // OPENER line (itself unprotected, absorbed normally by the
        // IndentedContent check) followed by its INDENTED-looking but
        // PROTECTED interior line exposes the difference: the real code
        // absorbs the interior via the comment-aware branch and keeps
        // scanning; with the branch gone, IndentedContent no longer
        // applies (the interior line has no leading whitespace) so it
        // breaks one line too early.
        it("absorbs a comment region's protected interior line via the comment-aware branch, not by falling through", () => {
            const doc = "[^1]: a\n    <!--\nhidden\n-->";
            const lines = doc.split("\n");
            const scan = scanDocument(lines);
            expect(findDefinitionBlocks(lines, scan.isProtected, scan)).toEqual([
                { name: "1", start: 0, end: 2 },
            ]);
        });
    });

    describe("findDefinitionBlocks: blank-run walk bound and whitespace-only lines", () => {
        // line 777: the MethodExpression mutant drops ".trim()" from the
        // blank-run walk's own condition, so a WHITESPACE-ONLY line (not
        // truly empty, but blank in effect) stops the walk instead of
        // being swept over - the walk must treat it exactly like an empty
        // line.
        it("a whitespace-only line within a blank run is swept over like an empty line", () => {
            const doc = ["[^1]: a", "   ", "    more"];
            const isProtected = scanDocument(doc).isProtected;
            expect(findDefinitionBlocks(doc, isProtected)).toEqual([
                { name: "1", start: 0, end: 2 },
            ]);
        });

        // line 777: the EqualityOperator mutant "k <= lines.length" lets
        // the walk step one past the array when a blank run reaches
        // EXACTLY end-of-document, reading "lines[lines.length].trim()" -
        // "undefined" has no ".trim" method, so this crashes instead of
        // the walk cleanly stopping at the document boundary.
        it("a blank run reaching exactly end-of-document does not overrun the array", () => {
            const doc = ["[^1]: a", ""];
            const isProtected = scanDocument(doc).isProtected;
            expect(findDefinitionBlocks(doc, isProtected)).toEqual([
                { name: "1", start: 0, end: 0 },
            ]);
        });
    });

    describe("findDefinitionBlocks: post-walk absorb guard", () => {
        // line 779: the LogicalOperator mutant ("&&" -> "||" on the first
        // two clauses) and both ConditionalExpression "true" mutants make
        // this guard ignore isProtected once "k < lines.length" alone is
        // satisfied - a blank run landing exactly on a PROTECTED fence
        // opener (itself indented, so it still matches IndentedContent)
        // then gets wrongly absorbed into the definition block instead of
        // correctly ending it.
        it("a blank run landing on a protected (indented) fence opener does not get absorbed", () => {
            const doc = ["[^1]: a", "", " ```", " code", " ```"];
            const isProtected = scanDocument(doc).isProtected;
            expect(findDefinitionBlocks(doc, isProtected)).toEqual([
                { name: "1", start: 0, end: 0 },
            ]);
        });
    });

    describe("findDefinitionBlocks: non-blank break check", () => {
        // line 773: the MethodExpression mutant drops ".trim()" here too
        // (the OUTER non-blank check, distinct from the 777 walk above) -
        // reusing the same whitespace-only-line shape: without ".trim()",
        // "   " !== "" is true, breaking the block one line before the
        // real indented continuation is ever reached.
        it("a whitespace-only line does not end the block via the outer non-blank check", () => {
            const doc = ["[^1]: a", "   ", "    more"];
            const isProtected = scanDocument(doc).isProtected;
            expect(findDefinitionBlocks(doc, isProtected)).toEqual([
                { name: "1", start: 0, end: 2 },
            ]);
        });
    });
});

/*
 * Round 2 equivalence / unreachability proofs
 * ============================================
 * For each of the following survivors, no test was written: tracing the
 * exact reachable value ranges shows the mutation can never produce an
 * externally observable difference through the exported API.
 *
 * --- Harmless "read one past the end" off-by-ones (203:12, 217:29,
 * 284:33, 354:25) ---
 * All four change a loop's "<" bound to "<=", letting the index reach
 * exactly `line.length` / `src.length` for one extra iteration. In every
 * case the body only ever READS the out-of-range slot (never assigns
 * through it), and JS returns `undefined` for both string- and
 * array-index access past the end:
 *   - 203 (main mask loop) and 217 (backtick-run search): `line[i]` is
 *     undefined, which fails every "===" character check in the loop body
 *     (undefined !== "`", !== "$", startsWith(..., i) is false past the
 *     end), so the extra iteration takes the fallback "just advance i"
 *     path and calls `blot` zero times - output identical.
 *   - 284 (inline-math closer search): same shape - `line[j]` undefined
 *     fails both the backslash-escape check and the "$" check, so the
 *     loop body is a no-op for that iteration.
 *   - 354 (frontmatter closer search): `/^(---|\.\.\.)\s*$/.test(undefined)`
 *     coerces to the string "undefined", which does not match the
 *     pattern, so the extra iteration never finds a spurious closer.
 * Verified empirically against a scratch-mutated copy of the source: every
 * constructed probe (including inputs specifically shaped to reach the
 * boundary, e.g. an all-whitespace tail or a frontmatter block with no
 * closer at all) produced byte-identical output with and without each
 * mutation.
 *
 * --- 296:17 (drop the "close === i + 1" OR-clause) and 296:27
 * (i + 1 -> i - 1) ---
 * Already identified as equivalent in this file's round-1 notes (see the
 * "content starting with a space" describe block above): two adjacent
 * unescaped dollars are always caught by the "$$" display-math branch
 * before reaching this single-dollar code path, so `close` can never come
 * back equal to `i + 1` here - the clause is dead in every reachable
 * state. Re-confirmed for round 2: since `close` is otherwise always -1 or
 * >= i + 1 (found by a forward search starting at i + 1), and the
 * ArithmeticOperator variant's "close === i - 1" can only be true when
 * i === 0 and close === -1 (the only i for which i - 1 could equal a
 * legal close value), that same state already satisfies the FIRST clause
 * "close === -1" - so the OR's overall result is identical whether or not
 * this dead clause is mutated.
 *
 * --- regionDepth's own guard: 430:17, 456:17, 622:17 (all
 * "if (inComment || inMath) regionDepth = depth" forced to "true") ---
 * regionDepth is read exactly once, at line 404, and every read is itself
 * gated by "(inComment || inMath)". Every place inComment/inMath can
 * transition to (or remain) true - the comment-closer reopen (430), the
 * math-closer reopen (456), and a fresh opener (622) - immediately writes
 * regionDepth in that SAME statement in the unmutated code. So: when the
 * guard would have been true anyway, the mutant changes nothing; when the
 * guard is false (no region is actually open), the stale write is inert
 * because the next time regionDepth is read with inComment||inMath true,
 * that read is preceded by a fresh, correctly-guarded write from whichever
 * of these three sites opened it. The value written by a "false"-guard
 * write is provably never read while stale. Verified empirically: forcing
 * each of the three guards to "true" produced identical isProtected/
 * startsInComment/startsInMath output across every regression probe,
 * including ones specifically built to chain a region close, a false
 * reopen, and a subsequent depth-sensitive read.
 *
 * --- 436:46 and 461:46 (StringLiteral: the NUL->" " replacement in
 * `closed.masked.replace(/\0/g, " ").trim() === ""` becomes NUL->"") ---
 * The check only cares whether the string is ENTIRELY whitespace after the
 * substitution. Every character in `closed.masked` is either NUL or an
 * already-real character (space or otherwise) untouched by the replace.
 * Substituting NUL with " " or with "" changes only how many whitespace
 * characters are present, never whether a NON-whitespace character exists
 * - and `.trim() === ""` depends only on the latter. So both substitutions
 * agree on every input. Verified empirically with mixed NUL/real-space
 * masked strings.
 *
 * --- 476:30 and 478:29 (BooleanLiteral: the fence-interior branch's own
 * `inIndentedCode = false` / `blockBoundary = false` resets forced to
 * "true") ---
 * Both flags are re-derived unconditionally the moment the fence closes or
 * the line stops being fenced:
 *   - blockBoundary: line 501 unconditionally sets it to `true` the instant
 *     the fence actually closes (overwriting any per-iteration value from
 *     478, mutated or not), and while the fence stays open the flag is
 *     never read by anything (the fence branch's own logic at 484-503
 *     never consults it). So 478's mutation is invisible both during and
 *     after the fence.
 *   - inIndentedCode: right after a fence closes, `!inDefinition` is
 *     ALWAYS true (line 477 forces `inDefinition = false` on every fenced
 *     line, so it cannot be stale-true) and `blockBoundary` is ALWAYS true
 *     (per the point above) - so the very next line's own branch-535 check
 *     ("indented && !inDefinition && blockBoundary") reduces to just
 *     "indented" and independently reaches the identical isProtected
 *     verdict that a wrongly-true inIndentedCode would have produced via
 *     branch 530. When that next line is NOT indented, inIndentedCode gets
 *     unconditionally reset to false at line 551 before it could matter.
 * Verified empirically across fence-then-indented, fence-then-plain, and
 * list-nested-fence-then-deep-indent probes: identical output in all three.
 *
 * --- 488:24 EqualityOperator ("lead < rest.length" -> "lead <=") ---
 * Same "harmless read-one-past-the-end" shape as the 203/217/284/354
 * group above: at `lead === rest.length`, `rest[lead]` is undefined, which
 * fails the loop's own second clause ("=== ' '"), so the extra iteration
 * the mutant allows is immediately rejected by the AND's second half -
 * `lead`'s final value is identical either way. Verified empirically,
 * including with a rest string that is ENTIRELY spaces (the case most
 * likely to expose an off-by-one).
 *
 * --- 565:25 EqualityOperator ("listStack.length > 0" -> ">= 0") ---
 * Array length is never negative, so "length >= 0" is unconditionally
 * true - but so is the ORIGINAL clause whenever length actually is > 0,
 * and the ONLY case they'd disagree (length === 0) is already covered by
 * the loop's own second clause: `listStack[listStack.length - 1]` on an
 * empty array is `listStack[-1]` = undefined, and `indentWidth <
 * undefined` is always false. So at length === 0 the mutant's condition
 * reduces to `true && false` = false, identical to the original's
 * `false && ...` short-circuit. Verified empirically against every probe
 * built for the surrounding (non-equivalent) 565/566 mutants.
 *
 * --- 779:17 EqualityOperator ("k < lines.length" -> "k <=") ---
 * Same shape again: at k === lines.length, `isProtected[k]` and
 * `lines[k]` are both undefined; `!isProtected[k]` becomes `!undefined` =
 * true (harmless on its own), but `IndentedContent.test(lines[k])` coerces
 * `undefined` to the string "undefined", which has no leading whitespace
 * and so never matches `/^\s+\S/`. The three-clause AND is therefore false
 * either way, and the block ends via the same `else { break; }` path.
 * Verified empirically with a blank run that runs to exactly
 * end-of-document.
 *
 * --- 773:17 ConditionalExpression ("lines[j].trim() !== \"\"" -> "false")
 * ---
 * Reaching this line already guarantees `IndentedContent.test(lines[j])`
 * was false one line above (769), and `isProtected[j]` was false (757
 * would otherwise have absorbed-or-broken first). If the mutant skips the
 * direct break, execution falls into the blank-run walk immediately below:
 * since `lines[j]` is non-blank, the walk's own while-loop (777) does not
 * advance (k stays at j), and the walk's absorb guard (779) re-tests the
 * IDENTICAL `IndentedContent.test(lines[j])` that already failed - so it
 * takes the `else { break; }` branch at line 786, the same outcome the
 * direct break would have produced. Verified empirically with both a
 * whitespace-only line and an ordinary non-indented, non-blank line
 * (neither distinguishes the mutant from the original).
 */

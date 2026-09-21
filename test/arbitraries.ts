import fc from "fast-check";

import { PREFIXES } from "./helpers/prefixes";

// ---------- document generator ----------
// Structured, not byte-random: the pieces are the plugin's whole attack
// surface - references (plain/named/cased/$/escaped/inline), definitions
// with continuations, fences (bare/quoted/listed), math, comments,
// indented code, blockquoted definitions, dividers, frontmatter, and
// every EOL flavor.
//
// Lives in its own module (not properties.test.ts) so non-test tooling -
// e.g. the sample-corpus script that renders generated docs in Obsidian
// for human review - can consume the same generator the properties use.

const NAMES = ["1", "2", "9", "42", "note", "Note", "a$1", "ch-2", "x"];
const WORDS = ["alpha", "bravo", "charlie", "中文", "word"];
const PUNCT = [".", ",", "!", "?", "。", "？"];

const nameArb = fc.constantFrom(...NAMES);
const inlinePieceArb = fc.constantFrom(
    "^[an inline note]",
    "^[^shadow]",
    "`code [^77]`",
    "<!-- [^78] -->",
    // Obsidian %% comments (ground truth 2026-09-09): the reference inside
    // an inline pair is live; an unpaired mid-line "%%" is literal
    "%%hidden[^99]%%",
    "%% b \\%% c %%",
    "tail %% literal",
    "$m[^79]$",
    "\\[^80]",
    "$5 or $6",
    // punctuation directly after excluded reference shapes - the class the
    // punctuation rule's regex bypass corrupted (2026-08-11 review bug #1)
    "\\[^81].",
    "^[^shadow]?!",
    "`[^` $[^83].$",
);
const linePieceArb = fc.oneof(
    fc.constantFrom(...WORDS),
    nameArb.map((n) => `[^${n}]`),
    fc
        .tuple(
            fc.constantFrom(...WORDS),
            nameArb,
            fc.constantFrom(...PUNCT),
        )
        .map(([w, n, p]) => `${w}[^${n}]${p}`),
    inlinePieceArb,
);
const proseLineArb = fc
    .array(linePieceArb, { minLength: 1, maxLength: 5 })
    .map((pieces) => pieces.join(" "));

// filler paragraphs between the footnote-bearing blocks (Jason's corpus
// review, 2026-08-12: real notes are mostly prose) - Latin lorem ipsum and
// the Thousand Character Classic as its CJK counterpart. A paragraph may
// carry one reference, before OR after its final punctuation mark (the
// punctuation rule's whole job).
const LATIN_FILLER = [
    "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
    "Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.",
    "Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.",
    "Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.",
];
const CJK_FILLER = [
    "天地玄黄，宇宙洪荒。日月盈昃，辰宿列张。寒来暑往，秋收冬藏。",
    "闰余成岁，律吕调阳。云腾致雨，露结为霜。金生丽水，玉出昆冈。",
    "剑号巨阙，珠称夜光。果珍李柰，菜重芥姜。海咸河淡，鳞潜羽翔。",
];
const fillerParagraphArb = fc
    .tuple(
        fc.array(fc.constantFrom(...LATIN_FILLER, ...CJK_FILLER), {
            minLength: 1,
            maxLength: 3,
        }),
        fc.option(fc.tuple(nameArb, fc.boolean()), { nil: undefined }),
    )
    .map(([sentences, referenceSpot]) => {
        const paragraph = sentences.join(" ");
        if (referenceSpot === undefined) return paragraph;
        const [name, afterPunctuation] = referenceSpot;
        return afterPunctuation
            ? `${paragraph}[^${name}]`
            : `${paragraph.slice(0, -1)}[^${name}]${paragraph.slice(-1)}`;
    });

// definition bodies may carry NESTED references or inline footnotes:
// hand-typed nesting the plugin refuses to CREATE but must always survive
// (Jason's ruling + lint report, 2026-08-13). The generator was blind to
// this whole class before - no soak could have caught a nested-footnote
// lint bug.
const definitionBodyPieceArb = fc.oneof(
    { weight: 4, arbitrary: fc.constantFrom(...WORDS) },
    { weight: 1, arbitrary: nameArb.map((n) => `sees [^${n}]`) },
    { weight: 1, arbitrary: fc.constant("aside ^[nested inline]") },
);
const definitionBlockArb = fc
    .tuple(nameArb, definitionBodyPieceArb, fc.boolean(), definitionBodyPieceArb)
    .map(([n, body, continued, more]) =>
        continued ? `[^${n}]: ${body}\n    continued ${more}` : `[^${n}]: ${body}`,
    );

const fenceBlockArb = fc
    .tuple(fc.constantFrom("```", "~~~", "> ```", "- ```"), nameArb)
    .map(([kind, n]) => {
        if (kind === "> ```") return `> \`\`\`\n> fake[^${n}]\n> \`\`\``;
        if (kind === "- ```") return `- \`\`\`\n  fake[^${n}]\n  \`\`\``;
        return `${kind}\nfake[^${n}]\n${kind}`;
    });

const specialBlockArb = fc.constantFrom(
    "$$\nm[^70]\n$$",
    "$$\n[^71]: math label\n$$",
    "<!-- hidden [^72]\nstill hidden -->",
    "live[^2] <!-- opener\n--> closer[^9]",
    "    indented code[^73]",
    "> quoted[^42]\n> [^42]: a quoted definition",
    "---",
    // shapes from the 2026-08-10 Sol-bug batch: loose-list continuations,
    // double-digit list fences, quoted unclosed math, heading + indent
    "- item\n\n    continuation[^42]",
    "10. ```\n    fenced[^74]\n    ```",
    "> $$\n> quoted math[^75]",
    "# Heading\n    code-shaped[^76]",
    "[^note]: formula\n    $$\n    E = mc^2\n    $$",
    // shapes from the 2026-08-11 review batch, ground-truthed in the live
    // reading view: list-relative fence indent, quote-relative indented
    // code (open/lazy-live), wide-gap nested quote markers
    "- item\n    ```\n    fenced[^84]\n    ```",
    ">     quoted code[^85]",
    "> para\n>     lazy live[^86]",
    ">    > nested[^87]\n>    > [^87]: wide-gap definition",
    ">     > gap code[^88]",
    // the configured section heading appearing mid-document: the
    // 2026-07-17 heading-duplication family was unreachable while the
    // generator never emitted one (review D12, 2026-09-09); and a tab
    // indent, which CommonMark reads as code
    "# Footnotes",
    "## Footnotes",
    "\tcode-shaped[^89]",
    // a label directly under a prose line is lazy paragraph text, not a
    // definition (Obsidian ground truth 2026-09-09; micromark disagrees,
    // so the oracle cannot referee this shape - the other properties do)
    "prose line[^90]\n[^90]: lazy label",
    "- item[^91]\n  [^91]: lazy under a list item",
    // Obsidian %% block comments (ground truth 2026-09-09): references
    // inside bind and count, a label inside is dead, a comment-only line
    // is a paragraph line, a quoted block ends with its quote; micromark
    // knows none of this, so the oracle recuses every "%%" document
    "%%\nhidden[^92]\n%%",
    "%%\n[^93]: commented label\n%%",
    "%% c %%\n[^94]: lazy under a comment line",
    "> %%\n> [^95]: quoted commented label",
    "- %%\n  hidden[^96]\n  %%",
    "%%text\nmore[^97]\n%% after",
    // an inline %% pair holding a label: not a block opener (two %% on the
    // line), the label inside is dead text - pinned by
    // test/hunt/bug-lazy-label-in-inline-comment.test.ts
    "%% [^98]: inline comment label %%",
    // a label after a real %% block's closer on the same line: a live
    // definition (Jason's verification 2026-09-15, sheet 11)
    "%%\nhidden\n%% [^99]: after the closer",
    // a small GFM table, with a label right under it (Jason's ruling A2:
    // a label directly under a table row is a definition)
    "| a | b |\n| --- | --- |\n| c[^100] | d |",
    // shapes from the 2026-09-16 hunt (cycle 2): a label under a comment
    // closer's tail line (the plugin reads it as a definition; micromark
    // interrupts the paragraph too, so the oracle judges both sides), a
    // label under a link reference definition (a block, not a paragraph),
    // setext underlines of both kinds, a callout title with its label, a
    // quoted definition at depth two, an ordered-paren list item with a
    // label, and a code span that wraps across lines (sheet 11's B30)
    "x <!-- a\n--> tail\n[^101]: after comment tail",
    "[foo]: /url\n[^102]: after lrd",
    "setext para\n===\n[^103]: after setext h1",
    "setext para\n-\n[^104]: after setext h2",
    "> [!note] title\n> [^105]: callout label",
    "> > [^106]: depth two quoted",
    "1) item\n   [^107]: under ordered paren",
    "a `code\nspan` tail[^108]",
    "| a | b |\n| --- | --- |\n| c[^109] | d |\n[^109]: under table",
    // shapes from the 2026-09-16 hunt (cycle 3): a quoted definition with
    // a lazy continuation line (Reading view folds it into the footnote;
    // the multi-caret and selection claims must refuse to nest there), a
    // pipe-less GFM table with a definition inside it (the in-table alert
    // must name it), a 1-3 space indented line after a definition's blank
    // gap (NOT its continuation - micromark), a definition label indented
    // into a list item (a definition from the item's content column), a
    // label before the closer on a %% comment's closer line (dead, but the
    // alert must name it), and a reference inside a no-// autolink (dead
    // text per CommonMark)
    "> [^110]: quoted body\n> continuation[^110] here",
    "a | b\n--- | ---\nc[^111] | d\n[^111]: under pipe-less",
    "[^112]: stray\n\n   thin prose[^112]",
    "- item\n\n    [^113]: in-item label",
    "%%\n[^114]: before closer %%",
    "see <ftp:x/y[^115]> here\n\n[^115]: autolink twin",
    // shapes from the 2026-09-16 hunt (cycle 5): a quoted definition whose
    // lazy continuation a setext underline pulls out as a heading, an
    // orphan reference glued to a one- or two-character setext run (the
    // cut must be refused), a table-looking run under a "<" line that is
    // plain paragraph text, and a code span closing inside a fence-shaped
    // line whose info string holds a backtick (not a fence, per CommonMark
    // 4.5). Two more shapes stay OUT of the shared generator on purpose:
    // "para\n[^119]%%\nmore text" and "[^116]: body\ncont\n===" trip real
    // bugs the hunt pins in test/hunt (bug-orphan-delete-comment-opener-
    // residue, bug-definition-chunk-after-ender), and feeding them to the
    // non-it.fails invariants would turn the suite flaky red until the
    // fixes land. Re-add them here once those are fixed.
    "> [^117]: quoted body\n> cont\n> ===",
    "para\n[^118]==\n\ntext[^1]\n\n[^1]: d",
    "<3\n| a | b |\n| --- | --- |\n[^120]: d",
    "para `code [^121]\n``` `x`",
);

const blockArb = fc.oneof(
    { weight: 4, arbitrary: fillerParagraphArb },
    { weight: 4, arbitrary: proseLineArb },
    { weight: 3, arbitrary: definitionBlockArb },
    { weight: 1, arbitrary: fenceBlockArb },
    { weight: 1, arbitrary: specialBlockArb },
);

const frontmatterArb = fc.constantFrom(
    undefined,
    "---\ntitle: t\n---",
    "---\nfootnote-prefix: P-\n---",
    '---\nfootnote-prefix: "2."\n---',
    // every separator the convention names, regex-special ones included
    // (review D3, 2026-09-09)
    ...PREFIXES.map((prefix) => `---\nfootnote-prefix: ${prefix}\n---`),
);

export const docArb = fc
    .tuple(
        frontmatterArb,
        fc.array(blockArb, { maxLength: 10 }),
        fc.constantFrom("lf", "crlf", "mixed"),
    )
    .map(([frontmatter, blocks, eol]) => {
        const body = blocks.join("\n\n");
        const doc = frontmatter ? `${frontmatter}\n${body}` : body;
        if (eol === "lf") return doc;
        if (eol === "crlf") return doc.replace(/\n/g, "\r\n");
        let i = 0;
        return doc.replace(/\n/g, () => (i++ % 2 === 0 ? "\r\n" : "\n"));
    });

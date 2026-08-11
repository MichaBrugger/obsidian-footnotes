import fc from "fast-check";

// ---------- document generator ----------
// Structured, not byte-random: the pieces are the plugin's whole attack
// surface — references (plain/named/cased/$/escaped/inline), definitions
// with continuations, fences (bare/quoted/listed), math, comments,
// indented code, blockquoted definitions, dividers, frontmatter, and
// every EOL flavor.
//
// Lives in its own module (not properties.test.ts) so non-test tooling —
// e.g. the sample-corpus script that renders generated docs in Obsidian
// for human review — can consume the same generator the properties use.

const NAMES = ["1", "2", "9", "42", "note", "Note", "a$1", "ch-2", "x"];
const WORDS = ["alpha", "bravo", "charlie", "中文", "word"];
const PUNCT = [".", ",", "!", "?", "。", "？"];

const nameArb = fc.constantFrom(...NAMES);
const inlinePieceArb = fc.constantFrom(
    "^[an inline note]",
    "^[^shadow]",
    "`code [^77]`",
    "<!-- [^78] -->",
    "$m[^79]$",
    "\\[^80]",
    "$5 or $6",
    // punctuation directly after excluded reference shapes — the class the
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

const definitionBlockArb = fc
    .tuple(nameArb, fc.constantFrom(...WORDS), fc.boolean())
    .map(([n, w, continued]) =>
        continued ? `[^${n}]: ${w}\n    continued ${w}` : `[^${n}]: ${w}`,
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
);

const blockArb = fc.oneof(
    { weight: 4, arbitrary: proseLineArb },
    { weight: 3, arbitrary: definitionBlockArb },
    { weight: 1, arbitrary: fenceBlockArb },
    { weight: 1, arbitrary: specialBlockArb },
);

const frontmatterArb = fc.constantFrom(
    undefined,
    "---\ntitle: t\n---",
    "---\nfootnote-prefix: 2.\n---",
    "---\nfootnote-prefix: P-\n---",
    "---\nfootnote-prefix: 2. # comment\n---",
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

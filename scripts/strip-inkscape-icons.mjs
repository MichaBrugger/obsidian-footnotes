// Strips Inkscape's editing metadata out of the icon sources and emits the
// bare SVGs main.ts inlines through addIcon:
//
//   node scripts/strip-inkscape-icons.mjs
//
// reads  icons/action style/*.svg  →  writes  icons/optimized/<name>.svg
//
// What goes: the XML declaration, comments, <sodipodi:namedview> (grid,
// zoom, window state), empty <defs>, every inkscape:/sodipodi: attribute
// and namespace, ids, xml:space/version, and the svg tag's width/height
// (the viewBox rules). Inline style="" declarations become presentation
// attributes with Inkscape's defaults dropped, black strokes/fills become
// currentColor (Inkscape exports #000 and the icons must follow the theme
// — long-standing gotcha, see main.ts), sub-0.01px translate garbage is
// deleted, path numbers round to 3 decimals, and attribute-less <g>
// wrappers left over from layers are unwrapped.

import * as fs from "fs";
import * as path from "path";

const SRC = path.join("icons", "action style");
const OUT = path.join("icons", "optimized");

const STYLE_DEFAULTS = {
    display: "inline",
    "stroke-dasharray": "none",
    "stroke-opacity": "1",
    "fill-opacity": "1",
    "stroke-miterlimit": "4",
};

function strip(svg) {
    let out = svg
        .replace(/<\?xml[^>]*\?>/g, "")
        .replace(/<!--[\s\S]*?-->/g, "")
        .replace(/<sodipodi:namedview[\s\S]*?<\/sodipodi:namedview>/g, "")
        .replace(/<sodipodi:namedview[\s\S]*?\/>/g, "")
        .replace(/<metadata[\s\S]*?<\/metadata>/g, "")
        .replace(/\s(?:inkscape|sodipodi):[\w-]+="[^"]*"/g, "")
        .replace(/\sxmlns:(?:inkscape|sodipodi|svg)="[^"]*"/g, "")
        .replace(/\sxml:space="[^"]*"/g, "")
        .replace(/\sversion="[^"]*"/g, "")
        .replace(/\sid="[^"]*"/g, "");

    // the svg root's fixed size defers to the viewBox
    out = out.replace(/<svg([^>]*)>/, (_, attrs) =>
        `<svg${attrs.replace(/\s(?:width|height)="[^"]*"/g, "")}>`,
    );

    // inline style="" → presentation attributes, defaults dropped
    out = out.replace(/\sstyle="([^"]*)"/g, (_, css) => {
        const attrs = [];
        for (const declaration of css.split(";")) {
            const colon = declaration.indexOf(":");
            if (colon < 0) continue;
            const prop = declaration.slice(0, colon).trim();
            let value = declaration.slice(colon + 1).trim();
            if (STYLE_DEFAULTS[prop] === value) continue;
            if ((prop === "stroke" || prop === "fill") && /^#0{3,6}$/.test(value)) {
                value = "currentColor";
            }
            attrs.push(`${prop}="${value}"`);
        }
        return attrs.length ? " " + attrs.join(" ") : "";
    });

    // presentation-attribute black too
    out = out.replace(/\s(stroke|fill)="#0{3,6}"/g, ' $1="currentColor"');

    // Inkscape's sub-0.01px node-nudge translate residue
    out = out.replace(
        /\stransform="translate\(-?0\.0\d*[, ]-?0\.0\d*\)"/g,
        "",
    );

    // 24px viewBox: three decimals is sub-pixel precision
    out = out.replace(/\sd="([^"]*)"/g, (_, d) =>
        ` d="${d.replace(/-?\d+\.\d\d+/g, (n) =>
            String(Number(Number(n).toFixed(3))),
        )}"`,
    );

    out = out
        .replace(/<defs\s*\/>|<defs\s*>\s*<\/defs>/g, "")
        .replace(/\s*\n\s*/g, " ")
        .replace(/\s{2,}/g, " ")
        .replace(/>\s+</g, "><")
        .replace(/\s+>/g, ">")
        .trim();

    // unwrap layer leftovers: a <g> with no attributes at all
    for (;;) {
        const open = out.indexOf("<g>");
        if (open < 0) break;
        let depth = 0;
        let close = -1;
        const tag = /<(\/?)g[\s>]/g;
        tag.lastIndex = open;
        for (let m; (m = tag.exec(out)); ) {
            depth += m[1] ? -1 : 1;
            if (depth === 0) {
                close = m.index;
                break;
            }
        }
        if (close < 0) break;
        out =
            out.slice(0, open) +
            out.slice(open + 3, close) +
            out.slice(out.indexOf(">", close) + 1);
    }
    return out;
}

fs.mkdirSync(OUT, { recursive: true });
for (const name of fs.readdirSync(SRC)) {
    if (!name.endsWith(".svg")) continue;
    const raw = fs.readFileSync(path.join(SRC, name), "utf8");
    const bare = strip(raw);
    fs.writeFileSync(path.join(OUT, name), bare);
    console.log(`${name}: ${raw.length} -> ${bare.length} chars`);
    if (/#0{3,6}|inkscape|sodipodi/.test(bare)) {
        console.error(`  WARNING: residue left in ${name}`);
        process.exitCode = 1;
    }
}

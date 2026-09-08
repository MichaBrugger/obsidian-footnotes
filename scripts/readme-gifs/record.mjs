// README GIF driver: node scripts/readme-gifs/record.mjs <scene> [--out <gif path>] [--width 800] [--fps 10]
// Needs the sandbox vault open in Obsidian (the window is brought to the
// front while a scene records) and ffmpeg on PATH. Frames land in
// scripts/readme-gifs/.frames/<scene>/ (gitignored) for inspection.
// Loads inapp.js and scene-<scene>.js into Obsidian through vault dotfiles,
// waits for the scene, pulls the frames out of the vault, and assembles a
// GIF with ffmpeg using the real frame timestamps.
import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
// this folder lives at <repo>/scripts/readme-gifs, and the repo is the
// sandbox vault's plugin folder (<vault>/.obsidian/plugins/obsidian-footnotes)
const REPO = resolve(here, "..", "..");
const VAULT = resolve(REPO, "..", "..", "..");
const args = process.argv.slice(2);
const scene = args[0];
if (!scene) {
    console.error("usage: node record.mjs <scene> [--out path] [--width 800] [--fps 10]");
    process.exit(2);
}
const opt = (name, def) => {
    const i = args.indexOf(name);
    return i !== -1 ? args[i + 1] : def;
};
const out = resolve(opt("--out", join(REPO, "README", `${scene}.gif`)));
const width = Number(opt("--width", "800"));
const fps = Number(opt("--fps", "10"));

// every CLI call names the vault: the CLI otherwise follows whichever vault
// window is focused, and a run with the personal vault in front would
// create the scratch note THERE (it did once, 2026-09-08 - an 11-byte
// placeholder, removed)
const VAULT_NAME = "Obsidian-Plugin-Sandbox";
const ob = (...a) => execFileSync("Obsidian.com", [`vault=${VAULT_NAME}`, ...a], { encoding: "utf8" }).trim();
const evalIn = (code) => ob("eval", `code=${code}`);
const readJson = (code) => {
    const o = evalIn(`JSON.stringify(${code})`);
    const m = o.match(/^=>\s?([\s\S]*)$/);
    return JSON.parse(m ? m[1] : o);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const vaultName = readJson("app.vault.getName()");
if (vaultName !== VAULT_NAME) {
    console.error(`refusing to run: the CLI answered for vault "${vaultName}"`);
    process.exit(1);
}

// 1. the scratch note and the two scripts as vault dotfiles
ob("create", "name=Smoke Test - footnotes", "content=placeholder", "overwrite", "silent");
copyFileSync(join(here, "inapp.js"), join(VAULT, ".gif-inapp.js"));
copyFileSync(join(here, `scene-${scene}.js`), join(VAULT, ".gif-scene.js"));
evalIn(`(async () => { new Function(await app.vault.adapter.read('.gif-inapp.js'))(); })(); 'fired'`);
await sleep(600);
evalIn(`(async () => { new Function(await app.vault.adapter.read('.gif-scene.js'))(); })(); 'fired'`);

// 2. wait for the scene
let state = null;
for (let i = 0; i < 90; i++) {
    await sleep(1000);
    state = readJson("window.__scene || null");
    if (state && (state.stage === "done" || state.stage === "error")) break;
}
rmSync(join(VAULT, ".gif-inapp.js"), { force: true });
rmSync(join(VAULT, ".gif-scene.js"), { force: true });
if (!state || state.stage !== "done") {
    console.error("scene failed:", JSON.stringify(state));
    process.exit(1);
}
console.log(`captured ${state.count} frames, region ${JSON.stringify(state.rect)}`);

// 3. frames out of the vault, into the scratchpad
const src = join(VAULT, state.dir);
const work = join(here, ".frames", scene);
rmSync(work, { recursive: true, force: true });
mkdirSync(work, { recursive: true });
for (const f of readdirSync(src)) copyFileSync(join(src, f), join(work, f));
rmSync(join(VAULT, ".footnote-capture"), { recursive: true, force: true });

// 4. concat list with real durations, then palette + gif
const times = JSON.parse(readFileSync(join(work, "times.json"), "utf8"));
const list = [];
for (let i = 0; i < times.length; i++) {
    const dur = i + 1 < times.length ? (times[i + 1] - times[i]) / 1000 : 0.8;
    list.push(`file 'f${String(i).padStart(4, "0")}.png'`, `duration ${dur.toFixed(3)}`);
}
list.push(`file 'f${String(times.length - 1).padStart(4, "0")}.png'`);
writeFileSync(join(work, "list.txt"), list.join("\n") + "\n");
mkdirSync(dirname(out), { recursive: true });
const vf = `fps=${fps},scale=${width}:-1:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=160:stats_mode=diff[p];[s1][p]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle`;
execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", "list.txt", "-vf", vf, "-loop", "0", out], { cwd: work, stdio: "inherit" });
const bytes = readFileSync(out).length;
console.log(`wrote ${out} (${(bytes / 1024).toFixed(0)} KB, ${times.length} source frames, ${(times[times.length - 1] / 1000).toFixed(1)} s)`);

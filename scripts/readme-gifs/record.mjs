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

// a scene whose first line is "// @mobile" runs under Obsidian's mobile
// emulation. emulateMobile() reloads the window, so the toggle has to happen
// out here, on either side of the scene, and the reload has to settle
const sceneSource = readFileSync(join(here, `scene-${scene}.js`), "utf8");
const wantsMobile = /^\/\/ @mobile/.test(sceneSource);
const isMobile = () => readJson("document.body.classList.contains('is-mobile')");
const setMobile = async (on) => {
    if (isMobile() === on) return;
    try {
        evalIn(`app.emulateMobile(${on})`);
    } catch {
        // the reload cuts the CLI answer short
    }
    for (let i = 0; i < 40; i++) {
        await sleep(500);
        try {
            if (readJson("app.workspace.layoutReady === true") && isMobile() === on) break;
        } catch {
            // still reloading
        }
    }
    await sleep(1500);
    if (isMobile() !== on) throw new Error(`mobile emulation did not turn ${on ? "on" : "off"}`);
};
if (wantsMobile) await setMobile(true);

// 1. the scratch note and the two scripts as vault dotfiles
ob("create", "name=Smoke Test - footnotes", "content=placeholder", "overwrite", "silent");
copyFileSync(join(here, "inapp.js"), join(VAULT, ".gif-inapp.js"));
copyFileSync(join(here, "scene-shared.js"), join(VAULT, ".gif-shared.js"));
copyFileSync(join(here, `scene-${scene}.js`), join(VAULT, ".gif-scene.js"));
evalIn(`(async () => { window.__scene = null; new Function(await app.vault.adapter.read('.gif-inapp.js'))(); new Function(await app.vault.adapter.read('.gif-shared.js'))(); })(); 'fired'`);
await sleep(600);
// supersede any stale scene, then bring the window forward and insist on focus
evalIn(`(() => { window.__gif.beginRun(); window.__gif.bringToFront(); })(); 'fired'`);
await sleep(700);
if (readJson("window.__gif.focused()") !== true) {
    rmSync(join(VAULT, ".gif-inapp.js"), { force: true });
    rmSync(join(VAULT, ".gif-scene.js"), { force: true });
    console.error("the sandbox vault window is hidden; Obsidian throttles a hidden window and the take would crawl. Make it visible and rerun.");
    process.exit(1);
}
evalIn(`(async () => { new Function(await app.vault.adapter.read('.gif-scene.js'))(); })(); 'fired'`);

// 2. wait for the scene
let state = null;
for (let i = 0; i < 90; i++) {
    await sleep(1000);
    try {
        state = readJson("window.__scene || null");
    } catch {
        continue; // a resize or reload can garble one answer; ask again
    }
    if (state && (state.stage === "done" || state.stage === "error")) break;
}
rmSync(join(VAULT, ".gif-inapp.js"), { force: true });
rmSync(join(VAULT, ".gif-shared.js"), { force: true });
rmSync(join(VAULT, ".gif-scene.js"), { force: true });
// back to the desktop layout whatever the scene did
if (wantsMobile) await setMobile(false);
if (!state || state.stage !== "done") {
    console.error("scene failed:", JSON.stringify(state));
    process.exit(1);
}
// a still scene hands back one PNG instead of frames
if (state.still) {
    const stillOut = resolve(opt("--out", join(REPO, "README", `${scene}.png`)));
    mkdirSync(dirname(stillOut), { recursive: true });
    copyFileSync(join(VAULT, state.still), stillOut);
    rmSync(join(VAULT, ".footnote-capture"), { recursive: true, force: true });
    console.log(`wrote ${stillOut} (${(readFileSync(stillOut).length / 1024).toFixed(0)} KB still)`);
    process.exit(0);
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
    // the last frame holds for a while before the loop restarts
    const dur = i + 1 < times.length ? (times[i + 1] - times[i]) / 1000 : 4.0;
    list.push(`file 'f${String(i).padStart(4, "0")}.png'`, `duration ${dur.toFixed(3)}`);
}
list.push(`file 'f${String(times.length - 1).padStart(4, "0")}.png'`);
writeFileSync(join(work, "list.txt"), list.join("\n") + "\n");
mkdirSync(dirname(out), { recursive: true });
const vf = `fps=${fps},scale=${width}:-1:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=160:stats_mode=diff[p];[s1][p]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle`;
execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", "list.txt", "-vf", vf, "-loop", "0", out], { cwd: work, stdio: "inherit" });
const bytes = readFileSync(out).length;
console.log(`wrote ${out} (${(bytes / 1024).toFixed(0)} KB, ${times.length} source frames, ${(times[times.length - 1] / 1000).toFixed(1)} s)`);

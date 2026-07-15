// Smoke tests: drive the REAL plugin inside a running Obsidian instance via
// the Obsidian CLI and assert on actual note contents. This is the
// integration layer — unit tests (vitest, test/) cover pure logic.
//
// Requirements:
//   - Obsidian is running with the Obsidian-Plugin-Sandbox vault focused
//   - the `obsidian` CLI is on PATH (ships with Obsidian 1.12+)
//   - the hot-reload community plugin is enabled (picks up deployed builds)
//
// Usage:
//   npm run test:smoke              deploys the current build, then tests
//   npm run test:smoke -- --no-deploy   tests whatever is already loaded

import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import process from "node:process";

const NOTE = "Smoke Test - footnotes";
const PLUGIN_ID = "obsidian-footnotes";
const CMD_AUTONUM = "obsidian-footnotes:insert-autonumbered-footnote";
const CMD_NAMED = "obsidian-footnotes:insert-named-footnote";

// ---------- CLI plumbing ----------

// spawn the CLI without a shell so multiline/quoted args survive intact;
// on Windows the console entry point is Obsidian.com
const CLI_CANDIDATES = process.env.OBSIDIAN_CLI
    ? [process.env.OBSIDIAN_CLI]
    : process.platform === "win32"
        ? ["Obsidian.com", "obsidian"]
        : ["obsidian"];
let cli = null;

function ob(...args) {
    const candidates = cli ? [cli] : CLI_CANDIDATES;
    let lastErr;
    for (const candidate of candidates) {
        try {
            const out = execFileSync(candidate, args, { encoding: "utf8" }).trim();
            cli = candidate;
            return out;
        } catch (e) {
            lastErr = e;
            if (e.code !== "ENOENT" && e.code !== "EINVAL") break;
        }
    }
    throw new Error(`obsidian CLI failed (${args[0]}): ${lastErr.message}`);
}

// The CLI occasionally swallows eval output; actions are fire-and-forget and
// state is read back with polling reads instead.
function action(code) {
    ob("eval", `code=${code}`);
}

function read(code) {
    for (let i = 0; i < 3; i++) {
        const out = ob("eval", `code=${code}`);
        const m = out.match(/^=>\s?([\s\S]*)$/);
        if (m) return m[1];
        if (out) return out;
    }
    return "";
}

function readJson(code) {
    const out = read(`JSON.stringify(${code})`);
    try {
        return JSON.parse(out);
    } catch {
        return undefined;
    }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function pollUntil(desc, code, predicate, timeoutMs = 6000) {
    const deadline = Date.now() + timeoutMs;
    let last;
    while (Date.now() < deadline) {
        last = readJson(code);
        if (predicate(last)) return last;
        await sleep(250);
    }
    throw new Error(`timed out waiting for ${desc}; last value: ${JSON.stringify(last)}`);
}

// ---------- vault helpers ----------

const EDITOR = "app.workspace.activeLeaf.view";

// content is set through the editor (not the file) so there is never a
// disk-vs-unsaved-buffer conflict between tests
let noteReady = false;
async function setupNote(content) {
    if (!noteReady) {
        ob("create", `name=${NOTE}`, "content=placeholder", "overwrite", "silent");
        ob("open", `file=${NOTE}`);
        noteReady = true;
    }
    action(`(${EDITOR}).editor.setValue(${JSON.stringify(content)});`);
    await waitForEditorText(content);
    // the view's data buffer lags editor changes by a tick and the plugin
    // numbers footnotes from it; wait for it to sync so tests are stable
    await pollUntil(
        "view data buffer to sync",
        `(${EDITOR}).data`,
        (v) => v === content,
    );
}

// every test starts from the same settings baseline so one test's failure
// can't leak configuration into the next
const BASELINE_SETTINGS = {
    enablePopupEditor: false,
    insertAtEndOfWord: true,
    enableFootnoteSectionHeading: false,
    enableRemoveBlankLastLines: true,
};
function resetSettings(overrides = {}) {
    setSettings({ ...BASELINE_SETTINGS, ...overrides });
}

async function waitForEditorText(expected) {
    await pollUntil(
        `editor to contain ${JSON.stringify(expected)}`,
        `(${EDITOR}).editor ? (${EDITOR}).editor.getValue() : null`,
        (v) => v === expected,
    );
}

function setCursorAndRun(line, ch, commandId) {
    action(
        `const v=${EDITOR}; v.editor.setCursor({line:${line},ch:${ch}}); ` +
        `app.commands.executeCommandById('${commandId}');`,
    );
}

function setSettings(patch) {
    action(
        `Object.assign(app.plugins.plugins['${PLUGIN_ID}'].settings, ${JSON.stringify(patch)});`,
    );
}

// ---------- test runner ----------

let failures = 0;

async function test(name, fn) {
    try {
        await fn();
        console.log(`  PASS  ${name}`);
    } catch (e) {
        failures++;
        console.error(`  FAIL  ${name}\n        ${e.message}`);
    }
}

async function expectEditorText(expected) {
    await pollUntil(
        `editor text ${JSON.stringify(expected)}`,
        `(${EDITOR}).editor.getValue()`,
        (v) => v === expected,
    );
}

// ---------- suite ----------

async function main() {
    const deploy = !process.argv.includes("--no-deploy");

    // sanity: right vault, plugin loaded
    const vault = read("app.vault.getName()");
    if (!vault.includes("Sandbox")) {
        throw new Error(`refusing to run against vault "${vault}" — smoke tests mutate notes`);
    }
    if (readJson(`!!app.plugins.plugins['${PLUGIN_ID}']`) !== true) {
        throw new Error(`plugin ${PLUGIN_ID} is not loaded`);
    }

    if (deploy) {
        // repo root may be the plugin dir itself or a worktree beneath it
        const root = process.cwd();
        const marker = `.obsidian${join("/", "plugins")}`;
        const idx = root.indexOf(".obsidian");
        if (idx === -1) throw new Error("cannot locate plugin dir from cwd");
        const pluginDir = join(root.slice(0, idx), ".obsidian", "plugins", PLUGIN_ID);
        for (const f of ["main.js", "styles.css"]) {
            const src = resolve(root, f);
            const dest = join(pluginDir, f);
            // when run from the plugin dir itself there is nothing to copy
            if (existsSync(src) && resolve(src) !== resolve(dest)) copyFileSync(src, dest);
        }
        console.log(`deployed build to ${pluginDir}; waiting for hot-reload...`);
        await sleep(2500);
    }

    const savedSettings = readJson(`app.plugins.plugins['${PLUGIN_ID}'].settings`);
    console.log(`running smoke tests against vault "${vault}"\n`);

    await test("autonumbered footnote inserts at end of word", async () => {
        resetSettings();
        await setupNote("Alpha bravo charlie");
        setCursorAndRun(0, 8, CMD_AUTONUM); // mid "bravo"
        await expectEditorText("Alpha bravo[^1] charlie\n\n[^1]: ");
    });

    await test("next footnote gets the next number", async () => {
        resetSettings();
        await setupNote("Alpha bravo[^1] charlie\n\n[^1]: existing");
        setCursorAndRun(0, 18, CMD_AUTONUM); // mid "charlie"
        await expectEditorText("Alpha bravo[^1] charlie[^2]\n\n[^1]: existing\n[^2]: ");
    });

    await test("named footnote inserts empty marker with cursor inside", async () => {
        resetSettings();
        await setupNote("Alpha bravo charlie");
        setCursorAndRun(0, 8, CMD_NAMED);
        await expectEditorText("Alpha bravo[^] charlie");
        const cursor = await pollUntil(
            "cursor inside marker",
            `(${EDITOR}).editor.getCursor()`,
            (c) => c && c.line === 0,
        );
        if (cursor.ch !== 13) throw new Error(`cursor at ch ${cursor.ch}, expected 13 (inside [^])`);
    });

    await test("section heading with divider gets a blank line above", async () => {
        resetSettings({ enableFootnoteSectionHeading: true,
            footnoteSectionHeading: "---\n## Footnotes" });
        await setupNote("Alpha bravo charlie");
        setCursorAndRun(0, 8, CMD_AUTONUM);
        await expectEditorText("Alpha bravo[^1] charlie\n\n---\n## Footnotes\n\n[^1]: ");
    });

    await test("blank lines at end of note survive when trimming is off", async () => {
        resetSettings({ enableRemoveBlankLastLines: false });
        await setupNote("Alpha bravo charlie\n\n\n");
        setCursorAndRun(0, 8, CMD_AUTONUM);
        // the first footnote in a note always adds one separator blank line
        // on top of whatever trailing blank lines were kept
        await expectEditorText("Alpha bravo[^1] charlie\n\n\n\n\n[^1]: ");
    });

    await test("popup opens focused on footnote creation, cursor stays put", async () => {
        resetSettings({ enablePopupEditor: true });
        await setupNote("Alpha bravo charlie");
        setCursorAndRun(0, 8, CMD_AUTONUM);
        await pollUntil(
            "popup visible and focused",
            `(() => { const p = document.querySelector('.footnote-shortcut-popup');
                return { open: !!p, visible: p ? p.style.visibility === '' : false,
                    focused: p ? p.contains(document.activeElement) : false }; })()`,
            (s) => s && s.open && s.visible && s.focused,
        );
        const cursor = readJson(`(${EDITOR}).editor.getCursor()`);
        if (!cursor || cursor.line !== 0) {
            throw new Error(`cursor left line 0: ${JSON.stringify(cursor)}`);
        }
    });

    await test("footnote hotkey toggles the popup closed", async () => {
        action(`app.commands.executeCommandById('${CMD_AUTONUM}');`);
        await pollUntil(
            "popup closed with focus back in editor",
            `(() => ({ gone: !document.querySelector('.footnote-shortcut-popup'),
                focusBack: (${EDITOR}).containerEl.contains(document.activeElement) }))()`,
            (s) => s && s.gone && s.focusBack,
        );
        const line0 = readJson(`(${EDITOR}).editor.getLine(0)`);
        if (line0 !== "Alpha bravo[^1] charlie") {
            throw new Error(`toggle-close inserted an extra footnote: ${JSON.stringify(line0)}`);
        }
    });

    // restore state and clean up
    setSettings(savedSettings);
    ob("delete", `path=${NOTE}.md`);

    console.log(failures === 0 ? "\nall smoke tests passed" : `\n${failures} smoke test(s) FAILED`);
    process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
    console.error(`smoke tests aborted: ${e.message}`);
    process.exit(1);
});

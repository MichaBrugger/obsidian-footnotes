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
import {
    copyFileSync,
    existsSync,
    readFileSync,
    unlinkSync,
    writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";

const NOTE = "Smoke Test - footnotes";
const PLUGIN_ID = "obsidian-footnotes";
const CMD_AUTONUM = "obsidian-footnotes:insert-autonumbered-footnote";
const CMD_NAMED = "obsidian-footnotes:insert-named-footnote";
const CMD_INLINE = "obsidian-footnotes:insert-inline-footnote";
const CMD_PASTE_INLINE = "obsidian-footnotes:paste-inline-footnote";
const CMD_LINT = "obsidian-footnotes:lint-footnotes";

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
        // the suite REQUIRES live preview: raw source mode renders no
        // table widgets (the cell tests just time out), and the leaf
        // inherits whatever mode its previous note used — force the mode
        // instead of depending on it (repeatability, 2026-08-10)
        action(
            `(async () => { const v=${EDITOR}; ` +
            `await v.setState({...v.getState(), mode:'source', source:false}, {history:false}); })();`,
        );
        await sleep(300);
        noteReady = true;
    }
    // close any popup a previous test left open (Escape routes through the
    // plugin's own close path, keeping its internal state consistent)
    action(
        `document.querySelectorAll('.footnote-shortcut-popup').forEach((el) => ` +
        `el.dispatchEvent(new KeyboardEvent('keydown', {key:'Escape', bubbles:true})));`,
    );
    // park the cursor at the top first: if a previous test left a table
    // cell sub-editor open, moving the selection out closes it, and the
    // brief wait lets its sync-back finish before the content is replaced
    action(`const v=${EDITOR}; v.editor.focus(); v.editor.setCursor({line:0,ch:0});`);
    await sleep(150);
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
    enableFootnotePrefix: false,
    enableFootnoteSectionHeading: false,
    enableRemoveBlankLastLines: true,
    renumberNamedFootnotes: false,
    lintDeleteOrphanedReferences: false,
    lintDeleteOrphanedDefinitions: false,
    lintFixPunctuation: true,
    lintMoveToBottom: true,
    lintReindex: true,
    lintApplyPrefix: true,
    lintOnSave: false,
    lintOnFootnoteCreation: false,
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
let skips = 0;

class SkipTest extends Error {}

// The table widget only opens its cell sub-editor from a FOCUSED window's
// render loop — hidden stalls it entirely, and merely-visible-but-unfocused
// leaves the editor focus() a no-op (observed 2026-08-10: showInactive made
// the tests FAIL instead of skip). Tests that need the cell editor call
// this; it grabs focus once when necessary (the suite is run deliberately,
// so a brief front is acceptable) and SKIPs loudly when even that fails.
async function requireVisibleWindow() {
    const usable = () =>
        readJson("document.hidden") === false &&
        readJson("document.hasFocus()") === true;
    if (usable()) return;
    action(
        `(() => { try { const w = require('electron').remote?.getCurrentWindow?.(); ` +
        `if (w?.isMinimized()) w.restore(); w?.show(); w?.focus(); } catch (e) {} })();`,
    );
    await sleep(500);
    if (usable()) return;
    throw new SkipTest(
        "Obsidian window is hidden or cannot take focus — table cell editing can't render",
    );
}

async function test(name, fn) {
    try {
        await fn();
        console.log(`  PASS  ${name}`);
    } catch (e) {
        if (e instanceof SkipTest) {
            skips++;
            console.log(`  SKIP  ${name}\n        ${e.message}`);
            return;
        }
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

// ---------- settings safety net ----------
// The suite patches the live plugin settings per test. Restoration must
// survive EVERY exit path — a failed assertion, a thrown poll timeout,
// Ctrl+C — or Jason has to re-edit his settings by hand after each run
// (observed 2026-08-10, when aborted runs left lint-on-save + a section
// heading behind). The pre-run snapshot also lands in a sidecar file, so
// even a hard-killed run heals on the NEXT invocation.

const SETTINGS_BACKUP = join(
    dirname(fileURLToPath(import.meta.url)),
    ".smoke-settings.bak.json",
);
let savedSettings = null;
let cleanupDone = false;

function restoreState(reason) {
    if (cleanupDone) return;
    cleanupDone = true;
    try {
        ob("delete", `path=${NOTE}.md`);
    } catch {
        // the note may never have been created — nothing to delete
    }
    if (!savedSettings) return;
    try {
        setSettings(savedSettings);
        const now = readJson(`app.plugins.plugins['${PLUGIN_ID}'].settings`);
        if (JSON.stringify(now) === JSON.stringify(savedSettings)) {
            if (existsSync(SETTINGS_BACKUP)) unlinkSync(SETTINGS_BACKUP);
            console.log(`settings restored (${reason})`);
        } else {
            console.error(
                `settings restore could not be verified (${reason}) — backup kept at ${SETTINGS_BACKUP}`,
            );
        }
    } catch (e) {
        console.error(
            `settings restore failed (${reason}): ${e.message} — backup kept at ${SETTINGS_BACKUP}`,
        );
    }
}

process.on("SIGINT", () => {
    restoreState("interrupted");
    process.exit(130);
});

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
        // let hot-reload's own cycle finish first — then reload explicitly
        // anyway: hot-reload has repeatedly left a STALE or DEAD instance
        // behind after a deploy (whole-suite failures, 2026-08-05), and an
        // explicit disable/enable cycle re-evaluates main.js from disk
        // deterministically
        await sleep(2500);
        // enablePluginAndSave PERSISTS the enablement: plain enablePlugin
        // is session-only, and since the plugin isn't in the vault's saved
        // community-plugins.json by default, an Obsidian restart after a
        // session-only enable brought the vault up with the plugin OFF —
        // every hotkey silently dead (Jason hit this 2026-08-21, reported
        // as "footnote hotkeys do nothing")
        action(
            `(async () => { await app.plugins.disablePlugin('${PLUGIN_ID}'); ` +
            `await app.plugins.enablePluginAndSave('${PLUGIN_ID}'); })();`,
        );
        await pollUntil(
            "the reloaded plugin's commands",
            `!!app.commands.commands['${CMD_AUTONUM}']`,
            (v) => v === true,
            10000,
        );
        await sleep(300);
    }

    // snapshot the settings — or, when a sidecar backup survived a killed
    // run, treat THAT as the true pre-smoke state and heal it first
    if (existsSync(SETTINGS_BACKUP)) {
        savedSettings = JSON.parse(readFileSync(SETTINGS_BACKUP, "utf8"));
        console.log(
            "found settings backup from an interrupted run — restoring it before starting",
        );
        setSettings(savedSettings);
    } else {
        savedSettings = readJson(
            `app.plugins.plugins['${PLUGIN_ID}'].settings`,
        );
        writeFileSync(SETTINGS_BACKUP, JSON.stringify(savedSettings, null, 2));
    }

    // an occluded/minimized window stalls the render loop (table cells,
    // toasts, data-buffer sync) and wedges the suite — nudge it visible
    // without stealing focus, and say so when that wasn't enough
    action(
        `(() => { try { const w = require('electron').remote?.getCurrentWindow?.(); ` +
        `if (w?.isMinimized()) w.restore(); w?.showInactive?.(); } catch (e) {} })();`,
    );
    await sleep(300);
    if (readJson("document.hidden") === true) {
        console.log(
            "NOTE: the Obsidian window is still hidden/occluded — table-cell tests will skip, and toast-dependent tests may be unreliable",
        );
    }

    // a previous failed run (or a plugin reload mid-popup) can leave stray
    // popup elements in the DOM; they'd poison every popup assertion below
    action(`document.querySelectorAll('.footnote-shortcut-popup').forEach((el) => el.remove());`);

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

    await test("hotkey right after an existing reference inserts a consecutive footnote", async () => {
        // issue #49: this used to jump to [^1]'s definition because the caret
        // touching the reference's outer edge counted as "on" it
        resetSettings();
        await setupNote("Alpha bravo[^1] charlie\n\n[^1]: existing");
        setCursorAndRun(0, 15, CMD_AUTONUM); // caret immediately after "[^1]"
        await expectEditorText("Alpha bravo[^1][^2] charlie\n\n[^1]: existing\n[^2]: ");
    });

    await test("hotkey inside an existing reference still navigates to its definition", async () => {
        resetSettings();
        await setupNote("Alpha bravo[^1] charlie\n\n[^1]: existing");
        setCursorAndRun(0, 13, CMD_AUTONUM); // caret inside "[^1]"
        await pollUntil(
            "cursor on the definition line",
            `(${EDITOR}).editor.getCursor()`,
            (c) => c && c.line === 2,
        );
        const text = readJson(`(${EDITOR}).editor.getValue()`);
        if (text !== "Alpha bravo[^1] charlie\n\n[^1]: existing") {
            throw new Error(`navigation changed the text: ${JSON.stringify(text)}`);
        }
    });

    await test("jumping between reference and definition centers the cursor in view", async () => {
        // regression (reported 2026-07-16): Obsidian's minimal scrolling
        // parked the cursor at the very edge of the viewport after a jump —
        // on mobile, nearly off screen. Jumps should land centered.
        resetSettings();
        const lines = Array.from({ length: 120 }, (_, i) => `Paragraph ${i + 1} lorem ipsum.`);
        lines[60] += "[^1]";
        lines.push("", "[^1]: the definition");
        await setupNote(lines.join("\n"));
        // start on the definition line (last line) and jump UP to the reference
        setCursorAndRun(122, 5, CMD_AUTONUM);
        await pollUntil(
            "cursor on the reference line",
            `(${EDITOR}).editor.getCursor()`,
            (c) => c && c.line === 60,
        );
        const ratio = await pollUntil(
            "cursor vertically inside the middle band of the viewport",
            `(() => { const cm = (${EDITOR}).editor.cm; ` +
            `const c = cm.coordsAtPos(cm.state.selection.main.head); ` +
            `const r = cm.scrollDOM.getBoundingClientRect(); ` +
            `return c && r.height > 0 ? (c.top - r.top) / r.height : null; })()`,
            (v) => typeof v === "number" && v > 0.25 && v < 0.75,
        );
        void ratio;
    });

    await test("named footnote inserts empty reference with cursor inside", async () => {
        resetSettings();
        await setupNote("Alpha bravo charlie");
        setCursorAndRun(0, 8, CMD_NAMED);
        await expectEditorText("Alpha bravo[^] charlie");
        const cursor = await pollUntil(
            "cursor inside reference",
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

    await test("inline footnote inserts ^[] at end of word with cursor inside", async () => {
        resetSettings();
        await setupNote("Alpha bravo charlie");
        setCursorAndRun(0, 8, CMD_INLINE); // mid "bravo"
        await expectEditorText("Alpha bravo^[] charlie");
        const cursor = await pollUntil(
            "cursor inside the inline footnote",
            `(${EDITOR}).editor.getCursor()`,
            (c) => c && c.line === 0,
        );
        // "Alpha bravo^[" is 13 chars — the caret belongs between the brackets
        if (cursor.ch !== 13) throw new Error(`cursor at ch ${cursor.ch}, expected 13 (inside ^[])`);
    });

    await test("second inline press warns while empty, hops once filled", async () => {
        // empty half (Jason, 2026-08-08): the second press used to hop the
        // caret out of the untouched ^[], stranding an empty inline
        // footnote — it now warns like the empty [^] reference and stays put
        resetSettings();
        await setupNote("Alpha bravo charlie");
        setCursorAndRun(0, 8, CMD_INLINE); // creates ^[] with cursor inside
        await expectEditorText("Alpha bravo^[] charlie");
        action(`app.commands.executeCommandById('${CMD_INLINE}');`);
        await pollUntil(
            "the empty inline footnote warning",
            `[...document.querySelectorAll('.notice')].map(n => n.textContent).join('|')`,
            (v) => typeof v === "string" && v.includes("inline footnote is empty"),
        );
        const cursor = readJson(`(${EDITOR}).editor.getCursor()`);
        if (!cursor || cursor.ch !== 13) {
            throw new Error(`caret moved to ${JSON.stringify(cursor)}, expected ch 13 (inside ^[])`);
        }
        // filled half: with text between the brackets, the second press is
        // the "done typing" hop past the closing bracket
        action(`(${EDITOR}).editor.replaceRange('filled', {line:0,ch:13});`);
        await expectEditorText("Alpha bravo^[filled] charlie");
        action(`app.commands.executeCommandById('${CMD_INLINE}');`);
        await pollUntil(
            "cursor just past the filled inline footnote",
            `(${EDITOR}).editor.getCursor()`,
            (c) => c && c.line === 0 && c.ch === "Alpha bravo^[filled]".length,
        );
        const line = readJson(`(${EDITOR}).editor.getLine(0)`);
        if (line !== "Alpha bravo^[filled] charlie") {
            throw new Error(`second press changed the text: ${JSON.stringify(line)}`);
        }
    });

    await test("inline footnote from clipboard pastes sanitized content", async () => {
        resetSettings();
        await setupNote("Alpha bravo charlie");
        // the real OS clipboard can't be driven headlessly (navigator.clipboard
        // requires document focus, and Electron's clipboard module is inert in
        // Obsidian's renderer), so stub the read at the platform boundary —
        // the command path from clipboard text to editor is still exercised.
        // The stub content needs sanitizing (newline) to prove that runs too.
        // Stub + command run in ONE eval: something on this machine restores
        // readText to native between CLI invocations (observed 2026-07-17,
        // likely a clipboard-monitoring agent), so a stub installed in a
        // separate call can vanish before the command reads it. The delayed
        // delete restores the native method after the command has finished.
        action(
            `(() => { window.__pasteCalls = 0; ` +
            `Object.defineProperty(navigator.clipboard, 'readText', ` +
            `{ value: async () => { window.__pasteCalls++; return ${JSON.stringify("pasted\nsource")}; }, configurable: true }); ` +
            `const v=${EDITOR}; v.editor.setCursor({line:0,ch:8}); ` +
            `app.commands.executeCommandById('${CMD_PASTE_INLINE}'); ` +
            `setTimeout(() => { delete navigator.clipboard.readText; }, 3000); })();`,
        );
        try {
            await expectEditorText("Alpha bravo^[pasted source] charlie");
        } catch (e) {
            // 0 calls = the command stalled before the clipboard (popup
            // settle, view lookup); undefined = the stub eval never ran
            const calls = readJson("window.__pasteCalls");
            throw new Error(`${e.message} (readText calls: ${JSON.stringify(calls)})`);
        }
    });

    await test("rapid double press creates one footnote and toggles its popup", async () => {
        // regression (reported 2026-07-16): the popup handle used to be
        // registered only after async setup, so a second press during that
        // window opened a SECOND popup instead of toggle-closing the first —
        // and the two popups' save machinery raced, eating later footnotes
        resetSettings({ enablePopupEditor: true });
        await setupNote("Alpha bravo charlie");
        action(
            `const v=${EDITOR}; v.editor.setCursor({line:0,ch:8}); ` +
            `app.commands.executeCommandById('${CMD_AUTONUM}'); ` +
            `app.commands.executeCommandById('${CMD_AUTONUM}');`,
        );
        await pollUntil(
            "exactly one footnote, popup closed",
            `(() => ({ text: (${EDITOR}).editor.getValue(), ` +
            `popup: !!document.querySelector('.footnote-shortcut-popup:not(.footnote-shortcut-popup-closed)') }))()`,
            (s) => s && s.text === "Alpha bravo[^1] charlie\n\n[^1]: " && !s.popup,
        );
        // the next rapid pair chains the second footnote the same way
        action(
            `app.commands.executeCommandById('${CMD_AUTONUM}'); ` +
            `app.commands.executeCommandById('${CMD_AUTONUM}');`,
        );
        await pollUntil(
            "second consecutive footnote created",
            `(${EDITOR}).editor.getValue()`,
            (v) => v === "Alpha bravo[^1][^2] charlie\n\n[^1]: \n[^2]: ",
        );
    });

    await test("closed untouched popups never save stale content over new footnotes", async () => {
        // regression (reported 2026-07-16, sequence captured live): the
        // popup embed marks itself dirty just from rendering, so a closed
        // untouched popup's debounced save wrote its STALE file snapshot
        // over footnotes added after it loaded — the external-change reload
        // then dumped the cursor at the top of the note
        resetSettings({ enablePopupEditor: true });
        await setupNote("Alpha bravo charlie delta");
        setCursorAndRun(0, 8, CMD_AUTONUM); // [^1] + popup
        await sleep(1600); // popup fully shown; embed self-dirties
        action(`app.commands.executeCommandById('${CMD_AUTONUM}');`); // close
        await sleep(300);
        action(`app.commands.executeCommandById('${CMD_AUTONUM}');`); // [^2] + popup
        await sleep(300);
        action(`app.commands.executeCommandById('${CMD_AUTONUM}');`); // close
        // the window where embed 1's stale save used to clobber [^2]
        await sleep(3500);
        const state = readJson(
            `(() => { const ed=(${EDITOR}).editor; ` +
            `return { text: ed.getValue(), cursor: ed.getCursor() }; })()`,
        );
        const expected = "Alpha bravo[^1][^2] charlie delta\n\n[^1]: \n[^2]: ";
        if (!state || state.text !== expected) {
            throw new Error(`stale save clobbered the note: ${JSON.stringify(state)}`);
        }
        if (state.cursor.line === 0 && state.cursor.ch === 0) {
            throw new Error("cursor was dumped at the start of the note");
        }
    });

    await test("typed popup definition survives an immediately-following footnote", async () => {
        // regression (reported 2026-07-16, third round): the user's real flow
        // — type a definition in the popup, close, immediately insert the next
        // footnote. The popup's (legitimate) debounced save wrote the file
        // WITHOUT the just-inserted next footnote, clobbering it; the
        // conflict reload then dumped the cursor at the top.
        resetSettings({ enablePopupEditor: true });
        await setupNote("Alpha bravo charlie");
        setCursorAndRun(0, 8, CMD_AUTONUM); // [^1] + popup
        await pollUntil(
            "popup focused for typing",
            `(() => { const p = document.querySelector('.footnote-shortcut-popup');
                return !!(p && p.contains(document.activeElement)); })()`,
            (v) => v === true,
        );
        // type through the DOM so the full real input path runs
        action(`document.execCommand('insertText', false, 'my note');`);
        await sleep(200);
        action(`app.commands.executeCommandById('${CMD_AUTONUM}');`); // close popup
        await sleep(150); // press again while the popup's save is still pending
        action(`app.commands.executeCommandById('${CMD_AUTONUM}');`); // [^2]
        await pollUntil(
            "both footnotes and the typed definition present",
            `(${EDITOR}).editor.getValue()`,
            (v) => v === "Alpha bravo[^1][^2] charlie\n\n[^1]: my note\n[^2]: ",
            12000,
        );
        const cursor = readJson(`(${EDITOR}).editor.getCursor()`);
        if (cursor && cursor.line === 0 && cursor.ch === 0) {
            throw new Error("cursor was dumped at the start of the note");
        }
        // close [^2]'s popup so it can't leak into the next test
        action(`app.commands.executeCommandById('${CMD_AUTONUM}');`);
        await pollUntil(
            "trailing popup closed",
            `!document.querySelector('.footnote-shortcut-popup:not(.footnote-shortcut-popup-closed)')`,
            (v) => v === true,
        );
    });

    await test("rapid typed popups keep their texts apart and never crash the save chain", async () => {
        // regression (reported 2026-08-13, root-caused live): the teardown's
        // save flush called embed.save() with NO ARGUMENTS — current
        // Obsidian's save(t, n) feeds t straight into set(), so
        // set(undefined) threw deep in the save chain AND poisoned
        // embed.text, making the embed's own debounced saves crash uncaught
        // ("Cannot read properties of undefined (reading 'split')"). The
        // stalled dirty flag also dragged every teardown out for seconds,
        // and the closed popup's still-mounted editor could swallow
        // keystrokes meant for the NEXT footnote's popup.
        resetSettings({ enablePopupEditor: true });
        await setupNote("Alpha bravo charlie");
        action(
            `window.__popupErrs = []; if (!window.__popupErrHook) { ` +
            `window.__popupErrHook = true; ` +
            `window.addEventListener('unhandledrejection', ` +
            `(e) => window.__popupErrs && window.__popupErrs.push(String(e.reason))); }`,
        );
        setCursorAndRun(0, 8, CMD_AUTONUM); // [^1] + popup
        for (let round = 0; round < 3; round++) {
            await pollUntil(
                `popup ${round + 1} focused for typing`,
                `(() => { const p = document.querySelector('.footnote-shortcut-popup');
                    return !!(p && p.contains(document.activeElement)); })()`,
                (v) => v === true,
            );
            action(`document.execCommand('insertText', false, 'note ${round}');`);
            await sleep(150);
            action(`app.commands.executeCommandById('${CMD_AUTONUM}');`); // close
            await sleep(120);
            if (round < 2) {
                action(`app.commands.executeCommandById('${CMD_AUTONUM}');`); // next
            }
        }
        await pollUntil(
            "every typed definition in its own footnote",
            `(${EDITOR}).editor.getValue()`,
            (v) => v === "Alpha bravo[^1][^2][^3] charlie\n\n[^1]: note 0\n[^2]: note 1\n[^3]: note 2",
            12000,
        );
        await sleep(2500); // outlive the embeds' own save debounce
        const errs = readJson("window.__popupErrs");
        if (errs && errs.length) {
            throw new Error(`popup save chain crashed: ${JSON.stringify(errs)}`);
        }
    });

    await test("right-click on a footnote offers Rename footnote, prose does not", async () => {
        // the editor-menu hook (Jason's ask 2026-08-13): parity with the
        // native "Rename this heading" on heading lines. Triggered
        // programmatically with a recording menu stub — the caret stands in
        // for the click point, which Obsidian resolves before the event.
        resetSettings({});
        await setupNote("Alpha bravo[^x] charlie\n\n[^x]: def");
        const menuProbe = (line, ch) =>
            `(() => { const v=${EDITOR}; v.editor.setCursor({line:${line},ch:${ch}}); ` +
            `const items=[]; const item={ setTitle(t){ items.push(t); return item; }, ` +
            `setIcon(){ return item; }, setSection(){ return item; }, onClick(){ return item; } }; ` +
            `const menu={ addItem(cb){ cb(item); return menu; } }; ` +
            `app.workspace.trigger('editor-menu', menu, v.editor, v); return items; })()`;
        const onReference = readJson(menuProbe(0, 13));
        if (!onReference || !onReference.includes("Rename footnote")) {
            throw new Error(`no menu item on the reference: ${JSON.stringify(onReference)}`);
        }
        const onLabel = readJson(menuProbe(2, 2));
        if (!onLabel || !onLabel.includes("Rename footnote")) {
            throw new Error(`no menu item on the definition label: ${JSON.stringify(onLabel)}`);
        }
        const onProse = readJson(menuProbe(0, 2));
        if (!onProse || onProse.includes("Rename footnote")) {
            throw new Error(`menu item leaked onto plain prose: ${JSON.stringify(onProse)}`);
        }
    });

    await test("Escape closes the popup (regression 2026-08-13)", async () => {
        // the embedded editor preventDefaults every Escape, so the old
        // defaultPrevented-based close never fired — caught by Jason's A3
        // manual pass; the fix reads the vim state directly in capture phase
        resetSettings({ enablePopupEditor: true });
        await setupNote("Alpha bravo charlie");
        setCursorAndRun(0, 8, CMD_AUTONUM);
        await pollUntil(
            "popup open and focused",
            `(() => { const p = document.querySelector('.footnote-shortcut-popup');
                return !!(p && p.contains(document.activeElement)); })()`,
            (v) => v === true,
        );
        action(
            `document.activeElement.dispatchEvent(new KeyboardEvent('keydown', ` +
            `{key:'Escape', code:'Escape', bubbles:true, cancelable:true}));`,
        );
        await pollUntil(
            "popup closed by Escape",
            `!document.querySelector('.footnote-shortcut-popup')`,
            (v) => v === true,
        );
    });

    await test("a selection + the named key names the footnote through a modal", async () => {
        // issue #35's named flavor (2026-08-13): the named flow's usual
        // second press can't carry a body statelessly, so a selection press
        // asks for the name in a modal and converts on Enter
        resetSettings({ enablePopupEditor: false });
        await setupNote("Alpha bravo charlie");
        action(
            `(() => { const v=${EDITOR}; ` +
            `v.editor.setSelection({line:0,ch:6},{line:0,ch:11}); })();`,
        );
        action(`app.commands.executeCommandById('${CMD_NAMED}');`);
        await pollUntil(
            "name modal open",
            `!!document.querySelector('.modal-container input')`,
            (v) => v === true,
        );
        action(
            `(() => { const input = document.querySelector('.modal-container input'); ` +
            `input.value = 'brv'; input.dispatchEvent(new Event('input')); ` +
            `input.dispatchEvent(new KeyboardEvent('keydown', {key:'Enter', bubbles:true})); })();`,
        );
        await pollUntil(
            "selection converted under the typed name",
            `(${EDITOR}).editor.getValue()`,
            (v) => v === "Alpha [^brv] charlie\n\n[^brv]: bravo",
            8000,
        );
    });

    await test("a footnote command submits the open name modal, like Enter (2026-08-22)", async () => {
        resetSettings({ enablePopupEditor: false });
        await setupNote("Alpha bravo charlie");
        action(
            `(() => { const v=${EDITOR}; ` +
            `v.editor.setSelection({line:0,ch:6},{line:0,ch:11}); })();`,
        );
        action(`app.commands.executeCommandById('${CMD_NAMED}');`);
        await pollUntil(
            "name modal open",
            `!!document.querySelector('.modal-container input')`,
            (v) => v === true,
        );
        action(
            `(() => { const input = document.querySelector('.modal-container input'); ` +
            `input.value = 'cmd'; input.dispatchEvent(new Event('input')); })();`,
        );
        // a footnote COMMAND (not Enter, not the button) submits the modal
        action(`app.commands.executeCommandById('${CMD_AUTONUM}');`);
        await pollUntil(
            "command press converted under the typed name and closed the modal",
            `JSON.stringify({value: (${EDITOR}).editor.getValue(), ` +
            `modal: !!document.querySelector('.modal-container input')})`,
            (v) =>
                v ===
                JSON.stringify({
                    value: "Alpha [^cmd] charlie\n\n[^cmd]: bravo",
                    modal: false,
                }),
            8000,
        );
    });

    await test("a multi-line selection becomes a multi-paragraph definition (2026-08-19)", async () => {
        // the academic shape: whole paragraphs move into ONE definition,
        // continuation lines indented four spaces under the label
        resetSettings({ enablePopupEditor: false });
        await setupNote("Intro line.\nFirst para body\n\nSecond para body\nOutro line.");
        action(
            `(() => { const v=${EDITOR}; ` +
            `v.editor.setSelection({line:1,ch:0},{line:3,ch:16}); })();`,
        );
        action(`app.commands.executeCommandById('${CMD_AUTONUM}');`);
        await pollUntil(
            "selection converted into an indented multi-paragraph body",
            `(${EDITOR}).editor.getValue()`,
            (v) =>
                v ===
                // the body's paragraph separator is an INDENTED blank —
                // "    " — flush with the continuations (Jason, 2026-08-21)
                "Intro line.\n[^1]\nOutro line.\n\n[^1]: First para body\n    \n    Second para body",
            8000,
        );
        // the caret must land at the end of the LAST body line, ready to edit
        const cursor = readJson(`(${EDITOR}).editor.getCursor()`);
        if (cursor.line !== 6 || cursor.ch !== "    Second para body".length) {
            throw new Error(`caret landed at ${JSON.stringify(cursor)}`);
        }
    });

    await test("TWO Alt-dragged selections toast and change nothing (Jason's report 2026-08-21)", async () => {
        // the report itself was environmental (plugin left session-enabled
        // only — see the deploy step), but this pins the real multi-range
        // path end to end: refusal toast, document untouched
        resetSettings({ enablePopupEditor: false });
        await setupNote("alpha bravo\ncharlie delta");
        action(
            `(${EDITOR}).editor.setSelections([` +
            `{anchor:{line:0,ch:0},head:{line:0,ch:5}},` +
            `{anchor:{line:1,ch:0},head:{line:1,ch:7}}]);`,
        );
        action(`app.commands.executeCommandById('${CMD_AUTONUM}');`);
        await pollUntil(
            "the one-continuous-stretch toast",
            `Array.from(document.querySelectorAll('.notice')).some(n => ` +
            `n.textContent.includes('one continuous stretch'))`,
            (v) => v === true,
            6000,
        );
        const value = readJson(`(${EDITOR}).editor.getValue()`);
        if (value !== "alpha bravo\ncharlie delta") {
            throw new Error(`multi-range press edited the note: ${JSON.stringify(value)}`);
        }
    });

    await test("multiple Alt-clicked CARETS fall through to a plain insert", async () => {
        resetSettings({ enablePopupEditor: false });
        await setupNote("alpha bravo\ncharlie delta");
        action(
            `(${EDITOR}).editor.setSelections([` +
            `{anchor:{line:0,ch:5},head:{line:0,ch:5}},` +
            `{anchor:{line:1,ch:7},head:{line:1,ch:7}}]);`,
        );
        action(`app.commands.executeCommandById('${CMD_AUTONUM}');`);
        await pollUntil(
            "one footnote at the primary caret",
            `(${EDITOR}).editor.getValue()`,
            (v) => v === "alpha[^1] bravo\ncharlie delta\n\n[^1]: ",
            8000,
        );
    });

    await test("popup edits propagate live into the main editor (stock parity)", async () => {
        // DELIBERATE behavior (Jason, 2026-08-08): while the popup is open
        // it saves on the embed's own debounce, exactly like Obsidian's
        // stock footnote hover editor, so the note text updates while you
        // type. A save-gate variant (one net edit per session, cleaner
        // main-editor undo) was tried and REVERTED: edits visibly NOT
        // appearing in the note was more disconcerting than the undo quirk
        // it fixed. Known accepted quirk: undoing a popup session from the
        // main editor can need an extra undo step, same as the stock hover
        // editor.
        resetSettings({ enablePopupEditor: true });
        await setupNote("Alpha bravo charlie");
        setCursorAndRun(0, 8, CMD_AUTONUM); // [^1] + popup
        await pollUntil(
            "popup focused for typing",
            `(() => { const p = document.querySelector('.footnote-shortcut-popup');
                return !!(p && p.contains(document.activeElement)); })()`,
            (v) => v === true,
        );
        action(`document.execCommand('insertText', false, 'live text');`);
        // the debounced save must reach the main editor WHILE the popup is
        // still open — that is the whole point of the stock-parity model
        await pollUntil(
            "typed definition visible in the main editor mid-session",
            `(${EDITOR}).editor.getValue()`,
            (v) => typeof v === "string" && v.includes("[^1]: live text"),
            8000,
        );
        const stillOpen = readJson(
            `!!document.querySelector('.footnote-shortcut-popup:not(.footnote-shortcut-popup-closed)')`,
        );
        if (!stillOpen) {
            throw new Error("popup closed before the mid-session save landed");
        }
        action(`app.commands.executeCommandById('${CMD_AUTONUM}');`); // close
        await pollUntil(
            "popup closed",
            `!document.querySelector('.footnote-shortcut-popup:not(.footnote-shortcut-popup-closed)')`,
            (v) => v === true,
        );
    });

    await test("rapid presses deep in a long note keep every footnote and the cursor", async () => {
        // regression (reported 2026-07-16): rapid create/close cycles could
        // lose a footnote AND reload the view, dumping the cursor at the top
        resetSettings({ enablePopupEditor: true });
        const body = Array.from({ length: 40 }, (_, i) => `Paragraph ${i + 1} lorem ipsum.`).join("\n");
        await setupNote(body);
        // six presses 120ms apart at line 30: presses 1/3/5 create
        // [^1][^2][^3], presses 2/4/6 toggle-close each pending popup
        action(
            `(() => { const v=${EDITOR}; v.editor.setCursor({line:30,ch:12}); ` +
            `const run = () => app.commands.executeCommandById('${CMD_AUTONUM}'); ` +
            `run(); for (let i=1;i<6;i++) setTimeout(run, i*120); })();`,
        );
        const state = await pollUntil(
            "three footnotes present with the cursor still on line 30",
            `(() => { const ed=(${EDITOR}).editor; return { ` +
            `line30: ed.getLine(30), cursor: ed.getCursor(), ` +
            `definitions: ['1','2','3'].filter(n => ed.getValue().includes('[^'+n+']: ')).length, ` +
            `popup: !!document.querySelector('.footnote-shortcut-popup:not(.footnote-shortcut-popup-closed)') }; })()`,
            (s) =>
                s &&
                s.line30 === "Paragraph 31[^1][^2][^3] lorem ipsum." &&
                s.definitions === 3 &&
                !s.popup &&
                s.cursor.line === 30,
            10000,
        );
        if (state.cursor.ch === 0) throw new Error("cursor was dumped at the start");
    });

    await test("footnote lands at the caret inside an actively edited table cell", async () => {
        await requireVisibleWindow();
        // regression (reported 2026-07-14): running the command while a
        // table cell sub-editor owned focus raced the cell's sync-back —
        // the insert was swallowed or the row's pipes were displaced and
        // escaped, shredding the table
        resetSettings();
        const table = [
            "| Lorem[^1]     | Ipsum[^2]          | fdssad [^five] [^six] [^2]<br> |",
            "| ------------- | ------------------ | ------------------------------ |",
            "| Dolor[^three] | Sit[^four] [^five] () | fddad [^bobthebuilder]         |",
        ].join("\n");
        // the table widget re-normalizes column padding after load, so a
        // byte-exact setupNote wait would never match — set the content and
        // wait for the "()" landmark on both the editor and the data buffer
        await setupNote("table pending");
        action(`(${EDITOR}).editor.setValue(${JSON.stringify(table)});`);
        await pollUntil(
            "table content in editor",
            `(${EDITOR}).editor.getValue()`,
            (v) => typeof v === "string" && v.includes("()"),
        );
        await pollUntil(
            "table content in data buffer",
            `(${EDITOR}).data`,
            (v) => typeof v === "string" && v.includes("()"),
        );
        // focusing the editor with the caret inside the table opens the
        // cell sub-editor in live preview — the state that triggered the bug
        action(
            `(() => { const v=${EDITOR}; v.editor.focus(); ` +
            `const ch=v.editor.getLine(2).indexOf('()')+1; ` +
            `v.editor.setCursor({line:2, ch}); })();`,
        );
        await pollUntil(
            "table cell sub-editor to open",
            `(() => { const t=document.querySelector('.markdown-source-view table'); ` +
            `return !!(t && t.querySelector('.cm-content')); })()`,
            (v) => v === true,
        );
        action(`app.commands.executeCommandById('${CMD_NAMED}');`);
        await pollUntil(
            "reference inserted between the parens",
            `(${EDITOR}).editor.getLine(2)`,
            (v) => typeof v === "string" && v.includes("([^])"),
        );
        const line = readJson(`(${EDITOR}).editor.getLine(2)`);
        if (line.includes("\\|")) throw new Error(`table pipe got escaped: ${line}`);
        const pipes = (line.match(/\|/g) ?? []).length;
        if (pipes !== 4) throw new Error(`table row has ${pipes} pipes, expected 4: ${line}`);
    });

    await test("lint with only reindex on renumbers and reorders footnotes", async () => {
        resetSettings({ lintFixPunctuation: false, lintMoveToBottom: false });
        await setupNote("Beta[^2] alpha[^1].\n\n[^1]: one\n[^2]: two");
        setCursorAndRun(0, 0, CMD_LINT);
        await expectEditorText("Beta[^1] alpha[^2].\n\n[^1]: two\n[^2]: one");
    });

    await test("lint with only move-to-bottom on relocates a mid-note definition", async () => {
        resetSettings({ lintFixPunctuation: false, lintReindex: false });
        await setupNote("Para one[^1].\n\n[^1]: def\n\nPara two.");
        setCursorAndRun(0, 0, CMD_LINT);
        await expectEditorText("Para one[^1].\n\nPara two.\n\n[^1]: def");
    });

    await test("lint with only punctuation on swaps references across punctuation", async () => {
        resetSettings({ lintMoveToBottom: false, lintReindex: false });
        await setupNote("Word[^1].\n\n[^1]: def");
        setCursorAndRun(0, 0, CMD_LINT);
        await expectEditorText("Word.[^1]\n\n[^1]: def");
    });

    await test("lint command runs all three cleanups and adds the heading", async () => {
        resetSettings({
            enableFootnoteSectionHeading: true,
            footnoteSectionHeading: "# Footnotes",
        });
        await setupNote("Alpha[^2], bravo[^1].\n\n[^2]: two\n\nCharlie tail.");
        setCursorAndRun(0, 0, CMD_LINT);
        // punctuation fixed, definition gathered under the heading at the
        // bottom (blank line above the heading), numbering redone by
        // appearance ([^2]→[^1], [^1]→[^2])
        await expectEditorText(
            "Alpha,[^1] bravo.[^2]\n\nCharlie tail.\n\n# Footnotes\n\n[^1]: two",
        );
    });

    await test("jump works for named footnotes with ':' in the name (issue #50)", async () => {
        resetSettings();
        const note = "Ref [^arXiv:1234.5678] end.\n\n[^arXiv:1234.5678]: Content 2";
        await setupNote(note);
        setCursorAndRun(0, 8, CMD_NAMED); // caret inside the reference
        await pollUntil(
            "cursor on the definition line",
            `(${EDITOR}).editor.getCursor()`,
            (c) => c && c.line === 2,
        );
        const text = readJson(`(${EDITOR}).editor.getValue()`);
        if (text !== note) {
            throw new Error(`jump changed the text: ${JSON.stringify(text)}`);
        }
    });

    await test("popup binds to a named footnote with ':' in the name (issue #50)", async () => {
        resetSettings({ enablePopupEditor: true });
        await setupNote(
            "Ref [^arXiv:1234.5678] end.\n\n[^arXiv:1234.5678]: Content 2",
        );
        setCursorAndRun(0, 8, CMD_NAMED);
        await pollUntil(
            "popup visible with the right definition loaded",
            `(() => { const p = document.querySelector('.footnote-shortcut-popup');
                return { open: !!p, text: p ? p.textContent : '' }; })()`,
            (s) => s && s.open && s.text.includes("Content 2"),
        );
        action(`app.commands.executeCommandById('${CMD_NAMED}');`); // close
        await pollUntil(
            "popup closed again",
            `!document.querySelector('.footnote-shortcut-popup:not(.footnote-shortcut-popup-closed)')`,
            (v) => v === true,
        );
    });

    await test("autonumbering ignores [^x] inside code blocks (issue #41)", async () => {
        // fenced fake reference+definition used to reserve numbers and suppress
        // the first-footnote handling
        resetSettings();
        await setupNote("```\nfake[^7]\n[^9]: fake\n```\nAlpha bravo");
        setCursorAndRun(4, 3, CMD_AUTONUM); // mid "Alpha"
        await expectEditorText(
            "```\nfake[^7]\n[^9]: fake\n```\nAlpha[^1] bravo\n\n[^1]: ",
        );
    });

    await test("new definitions land under the existing footnote group, not at EOF (issue #55)", async () => {
        resetSettings();
        const note = [
            "Alpha[^1] bravo",
            "",
            "#### Citations",
            "[^1]: one",
            "",
            "#### Images",
            "picture here",
        ].join("\n");
        await setupNote(note);
        setCursorAndRun(0, 12, CMD_AUTONUM); // mid "bravo"
        await expectEditorText([
            "Alpha[^1] bravo[^2]",
            "",
            "#### Citations",
            "[^1]: one",
            "[^2]: ",
            "",
            "#### Images",
            "picture here",
        ].join("\n"));
    });

    await test("footnote-prefix property namespaces autonumbered footnotes (issue #31)", async () => {
        resetSettings({ enableFootnotePrefix: true });
        await setupNote("---\nfootnote-prefix: 2-\n---\nAlpha bravo");
        setCursorAndRun(3, 8, CMD_AUTONUM); // mid "bravo"
        await expectEditorText(
            "---\nfootnote-prefix: 2-\n---\nAlpha bravo[^2-1]\n\n[^2-1]: ",
        );
        // the next press right after the reference chains [^2-2]
        setCursorAndRun(3, 17, CMD_AUTONUM);
        await expectEditorText(
            "---\nfootnote-prefix: 2-\n---\nAlpha bravo[^2-1][^2-2]\n\n[^2-1]: \n[^2-2]: ",
        );
    });

    await test("footnote-prefix is ignored while its toggle is off (the default)", async () => {
        resetSettings();
        await setupNote("---\nfootnote-prefix: 2.\n---\nAlpha bravo");
        setCursorAndRun(3, 8, CMD_AUTONUM);
        await expectEditorText(
            "---\nfootnote-prefix: 2.\n---\nAlpha bravo[^1]\n\n[^1]: ",
        );
    });

    await test("lint deletes orphaned definitions when the setting says so", async () => {
        resetSettings({
            lintDeleteOrphanedDefinitions: true,
            lintFixPunctuation: false,
            lintMoveToBottom: false,
        });
        await setupNote("Text[^2].\n\n[^2]: used\n[^9]: orphan");
        setCursorAndRun(0, 0, CMD_LINT);
        await expectEditorText("Text[^1].\n\n[^1]: used");
    });

    await test("orphaned-definition deletion works with reindex OFF (2026-08-10)", async () => {
        // the deletion used to live inside reindex; it is its own rule now
        resetSettings({
            lintDeleteOrphanedDefinitions: true,
            lintReindex: false,
            lintFixPunctuation: false,
            lintMoveToBottom: false,
        });
        await setupNote("Text[^2].\n\n[^2]: used\n[^9]: orphan");
        setCursorAndRun(0, 0, CMD_LINT);
        // no renumbering (reindex off) — just the orphan gone
        await expectEditorText("Text[^2].\n\n[^2]: used");
    });

    await test("lint skips the reindex step when its toggle is off", async () => {
        resetSettings({ lintReindex: false });
        // no reference touches punctuation and definitions sit at the bottom,
        // so with reindex off the whole lint must be a no-op
        await setupNote("Beta[^2] alpha[^1] end.\n\n[^1]: one\n[^2]: two");
        setCursorAndRun(0, 0, CMD_LINT);
        await sleep(800);
        const text = readJson(`(${EDITOR}).editor.getValue()`);
        if (text !== "Beta[^2] alpha[^1] end.\n\n[^1]: one\n[^2]: two") {
            throw new Error(`lint reindexed anyway: ${JSON.stringify(text)}`);
        }
    });

    await test("the lint command does not fire while a table cell is being edited until focus returns", async () => {
        await requireVisibleWindow();
        // the runOutsideTableCell guard: running the whole-document lint
        // while a cell sub-editor owns focus must not corrupt the table.
        // Only the reindex step runs, matching the assertions below.
        resetSettings({ lintFixPunctuation: false, lintMoveToBottom: false });
        const table = [
            "| Head     | Col     |",
            "| -------- | ------- |",
            "| Left[^2] | Right() |",
            "",
            "[^2]: def",
        ].join("\n");
        await setupNote("table pending");
        action(`(${EDITOR}).editor.setValue(${JSON.stringify(table)});`);
        await pollUntil(
            "table content in editor",
            `(${EDITOR}).editor.getValue()`,
            (v) => typeof v === "string" && v.includes("()"),
        );
        // the table widget renders from the data buffer, which lags the
        // editor by a tick — the cell sub-editor can't open before that
        await pollUntil(
            "table content in data buffer",
            `(${EDITOR}).data`,
            (v) => typeof v === "string" && v.includes("()"),
        );
        // editor.focus() can silently no-op when nothing in the editor had
        // DOM focus (same quirk the popup-close path works around), and
        // without real focus the cell editor never opens — focus the CM
        // contentDOM directly and jiggle the cursor until the widget bites
        await pollUntil(
            "table cell sub-editor to open",
            `(() => { const t=document.querySelector('.markdown-source-view table'); ` +
            `const v=${EDITOR}; ` +
            `const cm = !!(t && t.querySelector('.cm-content')); ` +
            `if (!cm) { v.editor.cm.contentDOM.focus(); ` +
            `const ch=v.editor.getLine(2).indexOf('()')+1; ` +
            `v.editor.setCursor({line:2, ch:0}); v.editor.setCursor({line:2, ch}); } ` +
            `return cm; })()`,
            (v) => v === true,
        );
        action(`app.commands.executeCommandById('${CMD_LINT}');`);
        await pollUntil(
            "lint applied without shredding the table",
            `(${EDITOR}).editor.getValue()`,
            (v) =>
                typeof v === "string" &&
                v.includes("[^1]") &&
                !v.includes("\\|") &&
                (v.match(/\|/g) ?? []).length === 9,
        );
    });

    await test("lint on save lints before the write when enabled", async () => {
        resetSettings({ lintOnSave: true });
        await setupNote("Beta[^2] alpha[^1] end\n\n[^1]: one\n[^2]: two");
        setCursorAndRun(0, 0, "editor:save-file");
        await expectEditorText("Beta[^1] alpha[^2] end\n\n[^1]: two\n[^2]: one");
    });

    await test("a clean manual save still reports 'No linting needed.'", async () => {
        // a manual save is an explicit user command, so it reports its
        // outcome either way (Jason, 2026-08-08, revisiting an earlier
        // quiet-on-clean change); only lint-on-footnote-creation is silent
        resetSettings({ lintOnSave: true });
        await setupNote("Alpha[^1] end\n\n[^1]: one");
        setCursorAndRun(0, 0, "editor:save-file");
        await pollUntil(
            "the no-op notice on a clean save",
            `[...document.querySelectorAll('.notice')].map(n => n.textContent).join('|')`,
            (v) => typeof v === "string" && v.includes("No linting needed."),
        );
    });

    await test("saving does not lint while the toggle is off (the default)", async () => {
        resetSettings();
        const note = "Beta[^2] alpha[^1] end\n\n[^1]: one\n[^2]: two";
        await setupNote(note);
        setCursorAndRun(0, 0, "editor:save-file");
        await sleep(800);
        const text = readJson(`(${EDITOR}).editor.getValue()`);
        if (text !== note) {
            throw new Error(`save linted anyway: ${JSON.stringify(text)}`);
        }
    });

    await test("vim :w routes through the save command and lints (Linter parity)", async () => {
        // vim does not exist on mobile — under Obsidian's mobile emulation
        // (app.emulateMobile) the CM5 shim never attaches and this test
        // can only fail confusingly (burned 2026-08-13: an evening chasing
        // "broken vim" that was just the emulator being on)
        if (readJson("app.isMobile") === true) {
            console.log("        (skipped: mobile emulation active, no vim)");
            return;
        }
        resetSettings({ lintOnSave: true });
        // enabling vim loads the CM5 adapter; the plugin's leaf-change hook
        // then redefines :w — reopening the note fires that hook
        action(`app.vault.setConfig('vimMode', true);`);
        await sleep(600);
        await setupNote("Beta[^2] alpha[^1] end\n\n[^1]: one\n[^2]: two");
        try {
            action(
                `(() => { const v=${EDITOR}; const cm5 = v.editor.cm?.cm; ` +
                `if (cm5) window.CodeMirrorAdapter.Vim.handleEx(cm5, 'w'); })();`,
            );
            await expectEditorText(
                "Beta[^1] alpha[^2] end\n\n[^1]: two\n[^2]: one",
            );
        } finally {
            action(`app.vault.setConfig('vimMode', false);`);
        }
    });

    await test("autosave alone never triggers lint on save", async () => {
        // the hook wraps the SAVE COMMAND: Obsidian's background autosave
        // writes through the view directly and must not lint
        resetSettings({ lintOnSave: true });
        const note = "Beta[^2] alpha[^1] end\n\n[^1]: one\n[^2]: two";
        await setupNote(note);
        await sleep(3500); // well past the ~2s autosave debounce
        const text = readJson(`(${EDITOR}).editor.getValue()`);
        if (text !== note) {
            throw new Error(`autosave linted: ${JSON.stringify(text)}`);
        }
    });

    await test("creating a footnote lints the note when enabled", async () => {
        resetSettings({ lintOnFootnoteCreation: true });
        // inserting mid "alpha" puts the new reference BEFORE [^1] in reading
        // order — the creation-time lint renumbers everything and the
        // caret still lands on the (renamed) new empty definition
        await setupNote("alpha bravo[^1] end.\n\n[^1]: one");
        setCursorAndRun(0, 3, CMD_AUTONUM); // mid "alpha"
        await expectEditorText(
            "alpha[^1] bravo[^2] end.\n\n[^1]: \n[^2]: one",
        );
        await pollUntil(
            "caret at the end of the new empty definition",
            `(${EDITOR}).editor.getCursor()`,
            (c) => c && c.line === 2 && c.ch === "[^1]: ".length,
        );
    });

    await test("creating a footnote in a clean note lints nothing, silently", async () => {
        resetSettings({ lintOnFootnoteCreation: true });
        await setupNote("Alpha bravo\n\n");
        setCursorAndRun(0, 8, CMD_AUTONUM); // mid "bravo"
        await expectEditorText("Alpha bravo[^1]\n\n[^1]: ");
    });

    await test("lint gathers definitions under the existing heading, not at EOF (issue #55)", async () => {
        resetSettings({
            enableFootnoteSectionHeading: true,
            footnoteSectionHeading: "# Footnotes",
        });
        // the section lives MID-NOTE with a stray definition at the end;
        // lint pulls the stray UP under the heading and leaves the
        // section where the user put it
        await setupNote(
            "Intro[^2] a[^1]\n\n# Footnotes\n\n[^1]: one\n\n## Other\nstuff\n\n[^2]: two",
        );
        setCursorAndRun(0, 0, CMD_LINT);
        await expectEditorText(
            "Intro[^1] a[^2]\n\n# Footnotes\n\n[^1]: two\n[^2]: one\n\n## Other\nstuff",
        );
    });

    await test("first footnote slots under an existing section heading (QOL)", async () => {
        resetSettings({
            enableFootnoteSectionHeading: true,
            footnoteSectionHeading: "# Footnotes",
        });
        await setupNote("Alpha bravo\n\n# Footnotes\n\ntail here");
        setCursorAndRun(0, 8, CMD_AUTONUM); // mid "bravo"
        // a blank line separates the definition from "tail here" — otherwise
        // Obsidian lazily pulls the prose into the footnote (A4 bug)
        await expectEditorText(
            "Alpha bravo[^1]\n\n# Footnotes\n\n[^1]: \n\ntail here",
        );
    });

    await test("definition slotted above prose keeps a blank line between them (A4 bug)", async () => {
        resetSettings({
            enableFootnoteSectionHeading: true,
            footnoteSectionHeading: "# Footnotes",
        });
        // the heading has prose DIRECTLY below it, no blank line at all
        await setupNote("Alpha bravo\n\n# Footnotes\nprose right after");
        setCursorAndRun(0, 8, CMD_AUTONUM); // mid "bravo"
        await expectEditorText(
            "Alpha bravo[^1]\n\n# Footnotes\n\n[^1]: \n\nprose right after",
        );
    });

    await test("named command prefills the note's prefix into the reference (QOL)", async () => {
        resetSettings({ enableFootnotePrefix: true });
        await setupNote("---\nfootnote-prefix: 2~\n---\nAlpha bravo");
        setCursorAndRun(3, 8, CMD_NAMED); // mid "bravo" → end of word
        await expectEditorText(
            "---\nfootnote-prefix: 2~\n---\nAlpha bravo[^2~]",
        );
        await pollUntil(
            "caret between the prefix and the bracket",
            `(${EDITOR}).editor.getCursor()`,
            (c) => c && c.line === 3 && c.ch === "Alpha bravo[^2.".length,
        );
        // type the name, press again inside → definition for the full name
        action(
            `const v=${EDITOR}; v.editor.replaceRange('tag', v.editor.getCursor());`,
        );
        setCursorAndRun(3, "Alpha bravo[^2.ta".length, CMD_NAMED);
        await expectEditorText(
            "---\nfootnote-prefix: 2~\n---\nAlpha bravo[^2~tag]\n\n[^2~tag]: ",
        );
    });

    await test("press inside the untouched [^2~] placeholder asks for a suffix (QOL)", async () => {
        resetSettings({ enableFootnotePrefix: true });
        const note = "---\nfootnote-prefix: 2~\n---\nAlpha [^2~] bravo";
        await setupNote(note);
        setCursorAndRun(3, 8, CMD_NAMED); // inside the placeholder
        await pollUntil(
            "the add-a-suffix toast",
            `[...document.querySelectorAll('.notice')].map(n => n.textContent).join('|')`,
            (v) => typeof v === "string" && v.includes("footnote suffix"),
        );
        // the caret stays put and nothing was inserted
        const cursor = readJson(`(${EDITOR}).editor.getCursor()`);
        if (!cursor || cursor.line !== 3 || cursor.ch !== 8) {
            throw new Error(`caret moved: ${JSON.stringify(cursor)}`);
        }
        const text = readJson(`(${EDITOR}).editor.getValue()`);
        if (text !== note) {
            throw new Error(`the toast changed the text: ${JSON.stringify(text)}`);
        }
    });

    await test("numbered hotkey inside an inline footnote hops out (QOL)", async () => {
        resetSettings();
        const note = "text ^[inline note] more";
        await setupNote(note);
        setCursorAndRun(0, 9, CMD_AUTONUM); // inside the inline footnote
        await pollUntil(
            "caret just past the closing bracket",
            `(${EDITOR}).editor.getCursor()`,
            (c) => c && c.line === 0 && c.ch === note.indexOf("]") + 1,
        );
        const text = readJson(`(${EDITOR}).editor.getValue()`);
        if (text !== note) {
            throw new Error(`hop changed the text: ${JSON.stringify(text)}`);
        }
    });

    await test("inline hotkey inside a reference navigates like the named key (QOL)", async () => {
        resetSettings();
        const note = "Alpha [^1] end.\n\n[^1]: one";
        await setupNote(note);
        setCursorAndRun(0, 8, CMD_INLINE); // inside the [^1] reference
        await pollUntil(
            "caret at the end of the definition",
            `(${EDITOR}).editor.getCursor()`,
            (c) => c && c.line === 2 && c.ch === "[^1]: one".length,
        );
        const text = readJson(`(${EDITOR}).editor.getValue()`);
        if (text !== note) {
            throw new Error(`navigation changed the text: ${JSON.stringify(text)}`);
        }
    });

    await test("inline hotkey on a definition-less reference creates its definition (QOL)", async () => {
        resetSettings();
        await setupNote("Alpha [^tag] end.");
        setCursorAndRun(0, 8, CMD_INLINE); // inside the [^tag] reference
        await expectEditorText("Alpha [^tag] end.\n\n[^tag]: ");
    });

    await test("clean note lint reports 'No linting needed.'", async () => {
        resetSettings();
        await setupNote("Alpha.[^1] done\n\n[^1]: one");
        setCursorAndRun(0, 0, "obsidian-footnotes:lint-footnotes");
        await pollUntil(
            "the no-op notice",
            `[...document.querySelectorAll('.notice')].map(n => n.textContent).join('|')`,
            (v) => typeof v === "string" && v.includes("No linting needed."),
        );
    });

    await test("an invalid footnote-prefix blocks the insert with a toast only", async () => {
        // it used to fall back to an unprefixed footnote the user then
        // had to delete (reported 2026-08-07)
        resetSettings({ enableFootnotePrefix: true });
        const note = "---\nfootnote-prefix: 10\n---\nAlpha bravo";
        await setupNote(note);
        setCursorAndRun(3, 8, CMD_AUTONUM); // mid "bravo"
        await pollUntil(
            "the no-footnote-created toast",
            `[...document.querySelectorAll('.notice')].map(n => n.textContent).join('|')`,
            (v) => typeof v === "string" && v.includes("No footnote was created"),
        );
        const text = readJson(`(${EDITOR}).editor.getValue()`);
        if (text !== note) {
            throw new Error(`insert still changed the text: ${JSON.stringify(text)}`);
        }
    });

    await test("lint cancels on a digit-ending footnote-prefix (QOL)", async () => {
        resetSettings();
        const note =
            "---\nfootnote-prefix: 10\n---\nb[^2] a[^1] end\n\n[^1]: one\n[^2]: two";
        await setupNote(note);
        setCursorAndRun(3, 0, "obsidian-footnotes:lint-footnotes");
        await pollUntil(
            "the cancellation alert",
            `[...document.querySelectorAll('.notice')].map(n => n.textContent).join('|')`,
            (v) => typeof v === "string" && v.includes("Linting canceled"),
        );
        const text = readJson(`(${EDITOR}).editor.getValue()`);
        if (text !== note) {
            throw new Error(`canceled lint still changed text: ${JSON.stringify(text)}`);
        }
    });

    await test("lint applies the note's footnote prefix to plain footnotes (QOL)", async () => {
        // plain strays adopt the prefix AND the whole namespace renumbers
        // by reading order — the pre-existing [^3=5] is a numbered
        // footnote of the namespace, not a named one; named footnotes
        // keep their name behind the prefix (A6 bug)
        resetSettings({ enableFootnotePrefix: true });
        await setupNote(
            "---\nfootnote-prefix: 3=\n---\nb[^2] a[^1] pre[^3=5] n[^note] end\n\n[^1]: one\n[^2]: two\n[^3=5]: already prefixed\n[^note]: named",
        );
        setCursorAndRun(3, 0, CMD_LINT);
        await expectEditorText(
            "---\nfootnote-prefix: 3=\n---\nb[^3=1] a[^3=2] pre[^3=3] n[^3=note] end\n\n[^3=1]: two\n[^3=2]: one\n[^3=3]: already prefixed\n[^3=note]: named",
        );
    });

    await test("set-footnote-prefix modal validates, then writes the property", async () => {
        resetSettings();
        await setupNote("Modal target note");
        action(`app.commands.executeCommandById('obsidian-footnotes:set-footnote-prefix');`);
        await pollUntil(
            "the modal's text input",
            `!!document.querySelector('.modal-container input[type=\"text\"]')`,
            (v) => v === true,
        );
        // a digit-ending prefix is refused: inline error, modal stays open
        action(
            `(() => { const input = document.querySelector('.modal-container input[type=\"text\"]'); ` +
            `input.value = '10'; input.dispatchEvent(new Event('input', {bubbles: true})); ` +
            `input.dispatchEvent(new KeyboardEvent('keydown', {key: 'Enter'})); })();`,
        );
        await pollUntil(
            "the inline validation error",
            `(() => { const err = document.querySelector('.footnote-shortcut-prefix-error'); ` +
            `return { open: !!document.querySelector('.modal-container'), error: err ? err.textContent : '' }; })()`,
            (s) => s && s.open && s.error.includes("end in a number"),
        );
        // a valid prefix closes the modal and lands in the frontmatter
        action(
            `(() => { const input = document.querySelector('.modal-container input[type=\"text\"]'); ` +
            `input.value = '5.'; input.dispatchEvent(new Event('input', {bubbles: true})); ` +
            `input.dispatchEvent(new KeyboardEvent('keydown', {key: 'Enter'})); })();`,
        );
        await pollUntil(
            "the property in the note",
            `(${EDITOR}).editor.getValue()`,
            // processFrontMatter may quote the YAML value; the plugin's
            // parser strips symmetric quotes, so both forms are fine
            (v) =>
                typeof v === "string" &&
                /footnote-prefix: "?5\."?/.test(v),
        );
    });

    await test("case-variant prefixed reference reserves its number (2026-08-10 A3)", async () => {
        // ids are case-insensitive in Obsidian: [^p-1] lives in prefix
        // "P-"'s namespace, so the next insert must mint 2, not a
        // colliding 1 that silently merges two footnotes
        resetSettings({ enableFootnotePrefix: true });
        await setupNote("---\nfootnote-prefix: P-\n---\nAlpha [^p-1] bravo\n\n[^p-1]: one");
        setCursorAndRun(3, 15, CMD_AUTONUM); // mid "bravo"
        await expectEditorText(
            "---\nfootnote-prefix: P-\n---\nAlpha [^p-1] bravo[^P-2]\n\n[^p-1]: one\n[^P-2]: ",
        );
    });

    await test("press inside a code-span-named reference navigates, never duplicates (2026-08-10 A2)", async () => {
        // the masked scan used to read the name as NUL bytes: the press
        // appended a duplicate definition containing literal NULs instead of
        // jumping to the existing one
        resetSettings();
        const note = "See[^`1`] end\n\n[^`1`]: definition";
        await setupNote(note);
        setCursorAndRun(0, 6, CMD_AUTONUM); // inside the [^`1`] reference
        await pollUntil(
            "cursor on the definition line",
            `(${EDITOR}).editor.getCursor()`,
            (c) => c && c.line === 2,
        );
        const text = readJson(`(${EDITOR}).editor.getValue()`);
        if (text !== note) {
            throw new Error(`navigation changed the text: ${JSON.stringify(text)}`);
        }
    });

    await test("caret after an escaped pipe still counts as inside a reference (2026-08-10 A9)", async () => {
        await requireVisibleWindow();
        // the cell editor shows "\|" as "|", so the caret used to resolve
        // one source column short — read as OUTSIDE the reference, the named
        // command nested a fresh "[^]" into it instead of continuing it
        resetSettings();
        const table = [
            "| Head |",
            "| ---- |",
            "| left \\| right[^note] |",
        ].join("\n");
        await setupNote("table pending");
        action(`(${EDITOR}).editor.setValue(${JSON.stringify(table)});`);
        await pollUntil(
            "table content in editor",
            `(${EDITOR}).editor.getValue()`,
            (v) => typeof v === "string" && v.includes("[^note]"),
        );
        await pollUntil(
            "table content in data buffer",
            `(${EDITOR}).data`,
            (v) => typeof v === "string" && v.includes("[^note]"),
        );
        // caret between "[" and "^" — strictly inside, and past the escape
        action(
            `(() => { const v=${EDITOR}; v.editor.focus(); ` +
            `const ch=v.editor.getLine(2).indexOf('[^note]')+1; ` +
            `v.editor.setCursor({line:2, ch}); })();`,
        );
        await pollUntil(
            "table cell sub-editor to open",
            `(() => { const t=document.querySelector('.markdown-source-view table'); ` +
            `return !!(t && t.querySelector('.cm-content')); })()`,
            (v) => v === true,
        );
        action(`app.commands.executeCommandById('${CMD_NAMED}');`);
        // inside a definition-less reference the press continues the footnote:
        // its definition appears and the row itself stays untouched
        await pollUntil(
            "the created definition line",
            `(${EDITOR}).editor.getValue()`,
            (v) => typeof v === "string" && v.includes("[^note]: "),
        );
        const line = readJson(`(${EDITOR}).editor.getLine(2)`);
        if (line.includes("[^]")) throw new Error(`nested a reference into the reference: ${line}`);
        if (!line.includes("\\|")) throw new Error(`the escaped pipe was lost: ${line}`);
    });

    await test("lint alerts about references with no definition (2026-08-10)", async () => {
        resetSettings(); // "Orphaned references" defaults to Alert
        await setupNote("Ref[^1] and stray[^stray] end\n\n[^1]: one");
        setCursorAndRun(0, 0, CMD_LINT);
        await pollUntil(
            "the orphaned-reference alert",
            `[...document.querySelectorAll('.notice')].map(n => n.textContent).join('|')`,
            (v) =>
                typeof v === "string" &&
                v.includes("no definition") &&
                v.includes("[^stray]"),
        );
        // alert only — the reference itself stays in the text
        const text = readJson(`(${EDITOR}).editor.getValue()`);
        if (!text.includes("[^stray]")) {
            throw new Error(`alert mode removed the reference: ${JSON.stringify(text)}`);
        }
    });

    await test("lint deletes orphaned references when the setting says so (2026-08-10)", async () => {
        resetSettings({ lintDeleteOrphanedReferences: true });
        await setupNote("Keep[^1] drop[^stray] end\n\n[^1]: one");
        setCursorAndRun(0, 0, CMD_LINT);
        await expectEditorText("Keep[^1] drop end\n\n[^1]: one");
    });

    await test("lint alerts about kept orphaned definitions (2026-08-10)", async () => {
        resetSettings(); // orphaned-definition deletion defaults to off
        await setupNote("plain text[^1]\n\n[^1]: used\n[^stray]: unused");
        setCursorAndRun(0, 0, CMD_LINT);
        await pollUntil(
            "the orphaned-definition alert",
            `[...document.querySelectorAll('.notice')].map(n => n.textContent).join('|')`,
            (v) =>
                typeof v === "string" &&
                v.includes("nothing references") &&
                v.includes("[^stray]"),
        );
        const text = readJson(`(${EDITOR}).editor.getValue()`);
        if (!text.includes("[^stray]: unused")) {
            throw new Error(`the kept orphan was altered: ${JSON.stringify(text)}`);
        }
    });

    await test("comment boundary lines stay live outside the comment (2026-08-10 A4)", async () => {
        // the opener/closer lines of a multi-line comment used to be
        // whole-line protected: the swap-worthy reference before "<!--"
        // was invisible and autonumbering reused hidden numbers
        resetSettings({ lintMoveToBottom: false, lintReindex: false });
        await setupNote("Alpha[^1]. <!-- draft\n--> done\n\n[^1]: one");
        setCursorAndRun(0, 0, CMD_LINT);
        await expectEditorText("Alpha.[^1] <!-- draft\n--> done\n\n[^1]: one");
        // and the next autonumber respects a reference on a boundary line
        setCursorAndRun(1, 8, CMD_AUTONUM); // after "done"
        await pollUntil(
            "the [^2] reference",
            `(${EDITOR}).editor.getValue()`,
            (v) => typeof v === "string" && v.includes("done[^2]"),
        );
    });

    await test("a blockquoted fence dies with its quote (2026-08-10 A5/A6)", async () => {
        // the fence used to run to EOF, hiding the rest of the note: the
        // press below saw no live text and autonumbering counted [^9]
        resetSettings();
        await setupNote("> ```\n> fake[^9]\nAlpha done");
        setCursorAndRun(2, 8, CMD_AUTONUM); // mid "done" — LIVE text
        await expectEditorText("> ```\n> fake[^9]\nAlpha done[^1]\n\n[^1]: ");
    });

    await test("footnotes navigate inside a callout (2026-08-10 C22)", async () => {
        resetSettings();
        const note = "> [!note]\n> body[^1] here\n> [^1]: def";
        await setupNote(note);
        setCursorAndRun(1, 8, CMD_AUTONUM); // inside [^1] — must navigate
        await pollUntil(
            "cursor on the callout definition line",
            `(${EDITOR}).editor.getCursor()`,
            (c) => c && c.line === 2,
        );
        const text = readJson(`(${EDITOR}).editor.getValue()`);
        if (text !== note) {
            throw new Error(`navigation duplicated the definition: ${JSON.stringify(text)}`);
        }
    });

    await test("lint leaves math alone, swaps real punctuation (2026-08-10 C20)", async () => {
        resetSettings({ lintMoveToBottom: false, lintReindex: false });
        await setupNote("$x[^9].$ real[^1].\n\n[^1]: one");
        setCursorAndRun(0, 0, CMD_LINT);
        await expectEditorText("$x[^9].$ real.[^1]\n\n[^1]: one");
    });

    // LAST before cleanup: this test flips the view mode, and a failure
    // between flip and flip-back must not poison the tests after it
    await test("deferred creation-lint stays inert after a flip to Reading view (2026-08-10 A7)", async () => {
        resetSettings({
            enablePopupEditor: true,
            lintOnFootnoteCreation: true,
            insertAtEndOfWord: false,
        });
        await setupNote("Alpha, bravo");
        setCursorAndRun(0, 5, CMD_AUTONUM); // just before the comma
        await pollUntil(
            "popup open",
            `!!document.querySelector('.footnote-shortcut-popup')`,
            (v) => v === true,
        );
        const created = "Alpha[^1], bravo\n\n[^1]: ";
        await expectEditorText(created);
        // flip to Reading view WITHOUT a leaf change — the popup stays up
        // and none of the deferred lint's other gates trip
        action(
            `(async () => { const v=${EDITOR}; ` +
            `await v.setState({...v.getState(), mode:'preview'}, {history:false}); })();`,
        );
        await pollUntil("reading view", `(${EDITOR}).getMode()`, (v) => v === "preview");
        // the hotkey's toggle path closes the popup; its settle callback
        // then fires the deferred lint, which must now be inert — the
        // pending punctuation fix ("Alpha[^1]," → "Alpha,[^1]") must NOT
        // be applied to the hidden buffer
        action(`app.commands.executeCommandById('${CMD_AUTONUM}');`);
        await pollUntil(
            "popup closed",
            `!document.querySelector('.footnote-shortcut-popup')`,
            (v) => v === true,
        );
        await sleep(1200); // teardown save + settle beat + would-be lint
        const text = readJson(`(${EDITOR}).editor.getValue()`);
        // flip back BEFORE asserting so a failure can't strand Reading view
        action(
            `(async () => { const v=${EDITOR}; ` +
            `await v.setState({...v.getState(), mode:'source'}, {history:false}); })();`,
        );
        await pollUntil("editing view", `(${EDITOR}).getMode()`, (v) => v === "source");
        if (text !== created) {
            throw new Error(`deferred lint edited the hidden buffer: ${JSON.stringify(text)}`);
        }
    });

    // restore state and clean up (restoreState also covers every abort path)
    restoreState("suite finished");

    const skipNote = skips > 0 ? ` (${skips} skipped — rerun with the Obsidian window visible)` : "";
    console.log(failures === 0 ? `\nall smoke tests passed${skipNote}` : `\n${failures} smoke test(s) FAILED${skipNote}`);
    process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
    console.error(`smoke tests aborted: ${e.message}`);
    restoreState("aborted");
    process.exit(1);
});

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
const CMD_INLINE = "obsidian-footnotes:insert-inline-footnote";
const CMD_PASTE_INLINE = "obsidian-footnotes:paste-inline-footnote";
const CMD_REINDEX = "obsidian-footnotes:reindex-footnotes";
const CMD_MOVE_BOTTOM = "obsidian-footnotes:move-footnotes-to-bottom";
const CMD_AFTER_PUNCT = "obsidian-footnotes:footnotes-after-punctuation";
const CMD_TIDY = "obsidian-footnotes:tidy-footnotes";

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

    await test("hotkey right after an existing marker inserts a consecutive footnote", async () => {
        // issue #49: this used to jump to [^1]'s detail because the caret
        // touching the marker's outer edge counted as "on" it
        resetSettings();
        await setupNote("Alpha bravo[^1] charlie\n\n[^1]: existing");
        setCursorAndRun(0, 15, CMD_AUTONUM); // caret immediately after "[^1]"
        await expectEditorText("Alpha bravo[^1][^2] charlie\n\n[^1]: existing\n[^2]: ");
    });

    await test("hotkey inside an existing marker still navigates to its detail", async () => {
        resetSettings();
        await setupNote("Alpha bravo[^1] charlie\n\n[^1]: existing");
        setCursorAndRun(0, 13, CMD_AUTONUM); // caret inside "[^1]"
        await pollUntil(
            "cursor on the detail line",
            `(${EDITOR}).editor.getCursor()`,
            (c) => c && c.line === 2,
        );
        const text = readJson(`(${EDITOR}).editor.getValue()`);
        if (text !== "Alpha bravo[^1] charlie\n\n[^1]: existing") {
            throw new Error(`navigation changed the text: ${JSON.stringify(text)}`);
        }
    });

    await test("jumping between marker and detail centers the cursor in view", async () => {
        // regression (reported 2026-07-16): Obsidian's minimal scrolling
        // parked the cursor at the very edge of the viewport after a jump —
        // on mobile, nearly off screen. Jumps should land centered.
        resetSettings();
        const lines = Array.from({ length: 120 }, (_, i) => `Paragraph ${i + 1} lorem ipsum.`);
        lines[60] += "[^1]";
        lines.push("", "[^1]: the detail");
        await setupNote(lines.join("\n"));
        // start on the detail line (last line) and jump UP to the marker
        setCursorAndRun(122, 5, CMD_AUTONUM);
        await pollUntil(
            "cursor on the marker line",
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

    await test("second inline-footnote press exits past the closing bracket", async () => {
        resetSettings();
        await setupNote("Alpha bravo charlie");
        setCursorAndRun(0, 8, CMD_INLINE); // creates ^[] with cursor inside
        await expectEditorText("Alpha bravo^[] charlie");
        action(`app.commands.executeCommandById('${CMD_INLINE}');`);
        // exits to ch 14 (just past "]") without inserting anything new
        await pollUntil(
            "cursor just past the inline footnote",
            `(${EDITOR}).editor.getCursor()`,
            (c) => c && c.line === 0 && c.ch === 14,
        );
        const line = readJson(`(${EDITOR}).editor.getLine(0)`);
        if (line !== "Alpha bravo^[] charlie") {
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
        action(
            `Object.defineProperty(navigator.clipboard, 'readText', ` +
            `{ value: async () => ${JSON.stringify("pasted\nsource")}, configurable: true });`,
        );
        try {
            setCursorAndRun(0, 8, CMD_PASTE_INLINE);
            await expectEditorText("Alpha bravo^[pasted source] charlie");
        } finally {
            // restore the real prototype method for whatever runs next
            action(`delete navigator.clipboard.readText;`);
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

    await test("typed popup detail survives an immediately-following footnote", async () => {
        // regression (reported 2026-07-16, third round): the user's real flow
        // — type a detail in the popup, close, immediately insert the next
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
            "both footnotes and the typed detail present",
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
            `details: ['1','2','3'].filter(n => ed.getValue().includes('[^'+n+']: ')).length, ` +
            `popup: !!document.querySelector('.footnote-shortcut-popup:not(.footnote-shortcut-popup-closed)') }; })()`,
            (s) =>
                s &&
                s.line30 === "Paragraph 31[^1][^2][^3] lorem ipsum." &&
                s.details === 3 &&
                !s.popup &&
                s.cursor.line === 30,
            10000,
        );
        if (state.cursor.ch === 0) throw new Error("cursor was dumped at the start");
    });

    await test("footnote lands at the caret inside an actively edited table cell", async () => {
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
            "marker inserted between the parens",
            `(${EDITOR}).editor.getLine(2)`,
            (v) => typeof v === "string" && v.includes("([^])"),
        );
        const line = readJson(`(${EDITOR}).editor.getLine(2)`);
        if (line.includes("\\|")) throw new Error(`table pipe got escaped: ${line}`);
        const pipes = (line.match(/\|/g) ?? []).length;
        if (pipes !== 4) throw new Error(`table row has ${pipes} pipes, expected 4: ${line}`);
    });

    await test("reindex command renumbers and reorders footnotes", async () => {
        resetSettings();
        await setupNote("Beta[^2] alpha[^1].\n\n[^1]: one\n[^2]: two");
        setCursorAndRun(0, 0, CMD_REINDEX);
        await expectEditorText("Beta[^1] alpha[^2].\n\n[^1]: two\n[^2]: one");
    });

    await test("move-to-bottom command relocates a mid-note definition", async () => {
        resetSettings();
        await setupNote("Para one[^1].\n\n[^1]: def\n\nPara two.");
        setCursorAndRun(0, 0, CMD_MOVE_BOTTOM);
        await expectEditorText("Para one[^1].\n\nPara two.\n\n[^1]: def");
    });

    await test("after-punctuation command swaps markers across punctuation", async () => {
        resetSettings();
        await setupNote("Word[^1].\n\n[^1]: def");
        setCursorAndRun(0, 0, CMD_AFTER_PUNCT);
        await expectEditorText("Word.[^1]\n\n[^1]: def");
    });

    await test("tidy command runs all three cleanups and adds the heading", async () => {
        resetSettings({
            enableFootnoteSectionHeading: true,
            footnoteSectionHeading: "# Footnotes",
        });
        await setupNote("Alpha[^2], bravo[^1].\n\n[^2]: two\n\nCharlie tail.");
        setCursorAndRun(0, 0, CMD_TIDY);
        // punctuation fixed, definition gathered under the heading at the
        // bottom, numbering redone by appearance ([^2]→[^1], [^1]→[^2])
        await expectEditorText(
            "Alpha,[^1] bravo.[^2]\n\nCharlie tail.\n# Footnotes\n\n[^1]: two",
        );
    });

    await test("cleanup commands do not fire while a table cell is being edited until focus returns", async () => {
        // the runOutsideTableCell guard: running a whole-document cleanup
        // while a cell sub-editor owns focus must not corrupt the table
        resetSettings();
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
        action(`app.commands.executeCommandById('${CMD_REINDEX}');`);
        await pollUntil(
            "reindex applied without shredding the table",
            `(${EDITOR}).editor.getValue()`,
            (v) =>
                typeof v === "string" &&
                v.includes("[^1]") &&
                !v.includes("\\|") &&
                (v.match(/\|/g) ?? []).length === 9,
        );
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

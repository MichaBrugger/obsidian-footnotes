import { beforeEach, describe, expect, it } from "vitest";

import { fakeEditor } from "./helpers/fake-editor";
import { fakePlugin } from "./helpers/fake-plugin";
import { messages, resetNotices } from "./helpers/notices";
import {
    carryRegister,
    handleCopy,
    handleCut,
    handlePaste,
    resetCarryRegister,
} from "../src/commands/carry-footnotes-hooks";

// The editor side of carrying footnotes (issue #59): the copy, cut and
// paste hooks over the pure seams, driven here with a fake clipboard
// event. Copy remembers what the selection needs in a plugin-side
// register and leaves the clipboard alone (unless the include setting is
// on); cut takes the event over and deletes the selection together with
// the definitions it orphans, in one transaction; paste takes the event
// over when the text matches the register, or when the text itself ends
// in definition lines, and lands body plus definitions in one transaction.

interface FakeClipboardEvent {
    clipboardData: { getData(type: string): string; setData(type: string, value: string): void; types: string[] };
    preventDefault(): void;
    stopPropagation(): void;
    defaultPrevented: boolean;
    written: Record<string, string>;
}

function clipboardEvent(text = "", types = ["text/plain"]): FakeClipboardEvent {
    const event: FakeClipboardEvent = {
        written: {},
        defaultPrevented: false,
        types: undefined as never,
        clipboardData: {
            types,
            getData: (type: string) => (type === "text/plain" ? text : ""),
            setData: (type: string, value: string) => {
                event.written[type] = value;
            },
        },
        preventDefault() {
            event.defaultPrevented = true;
        },
        stopPropagation() {},
    } as FakeClipboardEvent;
    return event;
}

function editor(lines: string[], from: { line: number; ch: number }, to = from) {
    return fakeEditor(lines, {
        wholeDoc: true,
        edits: true,
        cursor: from,
        selection: { anchor: from, head: to },
    });
}

beforeEach(() => {
    resetNotices();
    resetCarryRegister();
});

describe("copy", () => {
    it("remembers the selection's text and the definitions it needs, and leaves the clipboard to the editor", () => {
        const doc = editor(["a[^1] b", "", "[^1]: one"], { line: 0, ch: 0 }, { line: 0, ch: 7 });
        const event = clipboardEvent();
        handleCopy(fakePlugin({ carryFootnotesOnCopy: true }, doc), event as never);
        expect(carryRegister()).toEqual({
            text: "a[^1] b",
            carried: [{ name: "1", lines: ["[^1]: one"] }],
            missing: [],
        });
        expect(event.defaultPrevented).toBe(false);
        expect(event.written).toEqual({});
    });

    it("writes the definitions into the clipboard text when that setting is on", () => {
        const doc = editor(["a[^1] b", "", "[^1]: one"], { line: 0, ch: 0 }, { line: 0, ch: 7 });
        const event = clipboardEvent();
        handleCopy(fakePlugin({ carryFootnotesOnCopy: true, includeDefinitionsInClipboard: true }, doc), event as never);
        expect(event.written["text/plain"]).toBe("a[^1] b\n\n[^1]: one");
        expect(event.defaultPrevented).toBe(true);
    });

    it("does nothing while the feature is off, or with nothing selected", () => {
        const off = editor(["a[^1] b", "", "[^1]: one"], { line: 0, ch: 0 }, { line: 0, ch: 7 });
        handleCopy(fakePlugin({ carryFootnotesOnCopy: false }, off), clipboardEvent() as never);
        expect(carryRegister()).toBeNull();
        const collapsed = editor(["a[^1] b", "", "[^1]: one"], { line: 0, ch: 2 });
        handleCopy(fakePlugin({ carryFootnotesOnCopy: true }, collapsed), clipboardEvent() as never);
        expect(carryRegister()).toBeNull();
    });
});

describe("paste", () => {
    it("takes the paste over when the text matches the register: body and definitions land in ONE transaction, renamed to fit", () => {
        const source = editor(["a[^1] b", "", "[^1]: one"], { line: 0, ch: 0 }, { line: 0, ch: 7 });
        handleCopy(fakePlugin({ carryFootnotesOnCopy: true }, source), clipboardEvent() as never);
        const destination = editor(["x[^1]", "", "[^1]: uno"], { line: 0, ch: 5 });
        const event = clipboardEvent("a[^1] b");
        handlePaste(fakePlugin({ carryFootnotesOnCopy: true }, destination), event as never, destination);
        expect(event.defaultPrevented).toBe(true);
        expect(destination.lines).toEqual(["x[^1]a[^2] b", "", "[^1]: uno", "[^2]: one"]);
        expect(destination.transactions).toBe(1);
        expect(messages()).toContain("Pasted with 1 footnote definition: 1 added, 0 reused, 1 renamed.");
    });

    it("reads definition lines off a clipboard from anywhere when the register does not match", () => {
        const destination = editor(["p"], { line: 0, ch: 1 });
        const event = clipboardEvent("c[^7]\n\n[^7]: seven");
        handlePaste(fakePlugin({ carryFootnotesOnCopy: true }, destination), event as never, destination);
        expect(event.defaultPrevented).toBe(true);
        expect(destination.lines).toEqual(["pc[^7]", "", "[^7]: seven"]);
    });

    it("leaves a plain paste, a paste while the feature is off, and one another plugin already handled, to the editor", () => {
        const plain = editor(["p"], { line: 0, ch: 1 });
        const event = clipboardEvent("just text");
        handlePaste(fakePlugin({ carryFootnotesOnCopy: true }, plain), event as never, plain);
        expect(event.defaultPrevented).toBe(false);
        expect(plain.lines).toEqual(["p"]);
        const off = editor(["p"], { line: 0, ch: 1 });
        handlePaste(fakePlugin({ carryFootnotesOnCopy: false }, off), clipboardEvent("c[^7]\n\n[^7]: seven") as never, off);
        expect(off.lines).toEqual(["p"]);
        const handled = clipboardEvent("c[^7]\n\n[^7]: seven");
        handled.defaultPrevented = true;
        const taken = editor(["p"], { line: 0, ch: 1 });
        handlePaste(fakePlugin({ carryFootnotesOnCopy: true }, taken), handled as never, taken);
        expect(taken.lines).toEqual(["p"]);
    });

    it("says which references travelled without a definition", () => {
        const source = editor(["a[^gone]"], { line: 0, ch: 0 }, { line: 0, ch: 8 });
        handleCopy(fakePlugin({ carryFootnotesOnCopy: true }, source), clipboardEvent() as never);
        const destination = editor(["p"], { line: 0, ch: 1 });
        handlePaste(fakePlugin({ carryFootnotesOnCopy: true }, destination), clipboardEvent("a[^gone]") as never, destination);
        expect(messages().some((m) => m.includes('"[^gone]"') && m.includes("no definition"))).toBe(true);
    });
});

describe("cut", () => {
    it("takes the cut over: the clipboard gets the selection, the register its definitions, and the note loses the selection and what it orphaned in ONE transaction", () => {
        const doc = editor(["a[^1] b[^2]", "", "[^1]: one", "[^2]: two"], { line: 0, ch: 0 }, { line: 0, ch: 6 });
        const event = clipboardEvent();
        handleCut(fakePlugin({ carryFootnotesOnCopy: true }, doc), event as never);
        expect(event.written["text/plain"]).toBe("a[^1] ");
        expect(event.defaultPrevented).toBe(true);
        expect(doc.lines).toEqual(["b[^2]", "", "[^2]: two"]);
        expect(doc.transactions).toBe(1);
        expect(carryRegister()).toMatchObject({ text: "a[^1] ", carried: [{ name: "1", lines: ["[^1]: one"] }] });
    });

    it("leaves a cut that orphans nothing to the editor, but still fills the register", () => {
        const doc = editor(["a[^1] b[^1]", "", "[^1]: one"], { line: 0, ch: 0 }, { line: 0, ch: 6 });
        const event = clipboardEvent();
        handleCut(fakePlugin({ carryFootnotesOnCopy: true }, doc), event as never);
        expect(event.defaultPrevented).toBe(false);
        expect(doc.lines).toEqual(["a[^1] b[^1]", "", "[^1]: one"]);
        expect(carryRegister()).toMatchObject({ text: "a[^1] " });
    });
});

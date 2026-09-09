import { TFile } from "obsidian";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { messages, resetNotices } from "./helpers/notices";

import FootnotePlugin from "../src/main";
import { SetFootnotePrefixModal } from "../src/commands/set-footnote-prefix";

// The Set footnote prefix modal's submit(): validation, the unsaved-buffer
// flush, the frontmatter write (set or delete), the feature-off warning,
// and (review A7, Jason confirmed live 2026-09-08) the write FAILING.
// processFrontMatter rejects on malformed YAML ("bad: [") and when the file
// is gone from disk (ENOENT); submit() was fire-and-forget, so the
// rejection went to the console and the modal sat open with no message.
// The failure now lands on the modal's own error line. Review D4
// (2026-09-09) added the flush, delete, and feature-off branches.

type Submittable = { value: string; submit(): Promise<void> };

function modalWith(options: {
    write?: () => Promise<void>;
    enableFootnotePrefix?: boolean;
    /** the active Markdown view: `sameFile` makes it the modal's own note */
    activeView?: { sameFile: boolean };
}) {
    const file = new TFile();
    const otherFile = new TFile();
    const frontmatters: Record<string, unknown>[] = [];
    const saves: number[] = [];
    let order = 0;
    const view = options.activeView
        ? {
              file: options.activeView.sameFile ? file : otherFile,
              save: () => {
                  saves.push(++order);
                  return Promise.resolve();
              },
          }
        : null;
    const plugin = {
        settings: { enableFootnotePrefix: options.enableFootnotePrefix ?? true },
        app: {
            workspace: { getActiveViewOfType: () => view },
            fileManager: {
                processFrontMatter: (
                    _file: TFile,
                    edit: (frontmatter: Record<string, unknown>) => void,
                ) => {
                    const frontmatter: Record<string, unknown> = { "footnote-prefix": "old" };
                    edit(frontmatter);
                    frontmatters.push({ ...frontmatter, order: ++order });
                    return (options.write ?? (() => Promise.resolve()))();
                },
            },
        },
    } as unknown as FootnotePlugin;
    const modal = new SetFootnotePrefixModal(plugin, file, "old");
    const problems: (string | null)[] = [];
    // onOpen never runs in units (no DOM), so the error line is captured
    // instead of rendered
    Object.assign(modal, {
        showProblem: (problem: string | null) => {
            problems.push(problem);
        },
        close: vi.fn(),
    });
    return {
        modal: modal as unknown as Submittable & { close: () => void },
        problems,
        frontmatters,
        saves,
    };
}

describe("SetFootnotePrefixModal.submit", () => {
    beforeEach(resetNotices);

    it("refuses an invalid prefix inline without writing", async () => {
        const { modal, problems, frontmatters } = modalWith({});
        modal.value = "a b";
        await modal.submit();
        expect(problems).toHaveLength(1);
        expect(problems[0]).toContain("can't contain");
        expect(frontmatters).toEqual([]);
    });

    it("writes a valid prefix, closes, and confirms", async () => {
        const { modal, problems, frontmatters } = modalWith({});
        modal.value = "2-";
        await modal.submit();
        expect(frontmatters.map((f) => f["footnote-prefix"])).toEqual(["2-"]);
        expect(problems).toEqual([]);
        expect(modal.close).toHaveBeenCalled();
        expect(messages()).toEqual(['Footnote prefix set to "2-".']);
    });

    it("an empty value removes the property", async () => {
        const { modal, frontmatters } = modalWith({});
        modal.value = "   ";
        await modal.submit();
        expect(frontmatters).toHaveLength(1);
        expect("footnote-prefix" in frontmatters[0]).toBe(false);
        expect(messages()).toEqual(["Footnote prefix removed."]);
    });

    it("flushes the note's unsaved buffer before writing, and only for its own note", async () => {
        // processFrontMatter edits the FILE; a pending autosave of a stale
        // buffer would overwrite the property right after
        const own = modalWith({ activeView: { sameFile: true } });
        own.modal.value = "2-";
        await own.modal.submit();
        expect(own.saves).toEqual([1]);
        expect(own.frontmatters[0].order).toBe(2);

        const other = modalWith({ activeView: { sameFile: false } });
        other.modal.value = "2-";
        await other.modal.submit();
        expect(other.saves).toEqual([]);
    });

    it("warns when the prefix feature is off, after writing anyway", async () => {
        const { modal, frontmatters } = modalWith({ enableFootnotePrefix: false });
        modal.value = "2-";
        await modal.submit();
        expect(frontmatters.map((f) => f["footnote-prefix"])).toEqual(["2-"]);
        expect(modal.close).toHaveBeenCalled();
        expect(messages()).toEqual([
            'Footnote prefix set to "2-", but the "Per-note footnote prefix" setting is turned off, so it won\'t be used until you enable it.',
        ]);
    });

    it("a failed frontmatter write stays open and says so", async () => {
        const { modal, problems } = modalWith({
            write: () => Promise.reject(new Error("ENOENT: no such file or directory")),
        });
        modal.value = "2-";
        await expect(modal.submit()).resolves.toBeUndefined();
        expect(problems).toHaveLength(1);
        expect(problems[0]).toMatch(/couldn't write|could not write/i);
        expect(modal.close).not.toHaveBeenCalled();
        expect(messages()).toEqual([]);
    });
});

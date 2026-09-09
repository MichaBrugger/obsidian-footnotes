import { TFile } from "obsidian";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { messages, resetNotices } from "./helpers/notices";

import FootnotePlugin from "../src/main";
import { SetFootnotePrefixModal } from "../src/commands/set-footnote-prefix";

// The Set footnote prefix modal's submit(): validation, the frontmatter
// write, and (review A7, Jason confirmed live 2026-09-08) the write
// FAILING. processFrontMatter rejects on malformed YAML ("bad: [") and
// when the file is gone from disk (ENOENT); submit() was fire-and-forget,
// so the rejection went to the console and the modal sat open with no
// message. The failure now lands on the modal's own error line.

type Submittable = { value: string; submit(): Promise<void> };

function modalWith(processFrontMatter: () => Promise<void>, enableFootnotePrefix = true) {
    const written: string[] = [];
    const plugin = {
        settings: { enableFootnotePrefix },
        app: {
            workspace: { getActiveViewOfType: () => null },
            fileManager: {
                processFrontMatter: (
                    _file: TFile,
                    edit: (frontmatter: Record<string, unknown>) => void,
                ) => {
                    const frontmatter: Record<string, unknown> = {};
                    edit(frontmatter);
                    written.push(String(frontmatter["footnote-prefix"]));
                    return processFrontMatter();
                },
            },
        },
    } as unknown as FootnotePlugin;
    const modal = new SetFootnotePrefixModal(plugin, new TFile(), "");
    const problems: (string | null)[] = [];
    // onOpen never runs in units (no DOM), so the error line is captured
    // instead of rendered
    Object.assign(modal, {
        showProblem: (problem: string | null) => {
            problems.push(problem);
        },
        close: vi.fn(),
    });
    return { modal: modal as unknown as Submittable & { close: () => void }, problems, written };
}

describe("SetFootnotePrefixModal.submit", () => {
    beforeEach(resetNotices);

    it("refuses an invalid prefix inline without writing", async () => {
        const { modal, problems, written } = modalWith(() => Promise.resolve());
        modal.value = "a b";
        await modal.submit();
        expect(problems).toHaveLength(1);
        expect(problems[0]).toContain("can't contain");
        expect(written).toEqual([]);
    });

    it("writes a valid prefix, closes, and confirms", async () => {
        const { modal, problems, written } = modalWith(() => Promise.resolve());
        modal.value = "2-";
        await modal.submit();
        expect(written).toEqual(["2-"]);
        expect(problems).toEqual([]);
        expect(modal.close).toHaveBeenCalled();
        expect(messages()).toEqual(['Footnote prefix set to "2-".']);
    });

    it("a failed frontmatter write stays open and says so", async () => {
        const { modal, problems } = modalWith(() =>
            Promise.reject(new Error("ENOENT: no such file or directory")),
        );
        modal.value = "2-";
        await expect(modal.submit()).resolves.toBeUndefined();
        expect(problems).toHaveLength(1);
        expect(problems[0]).toMatch(/couldn't write|could not write/i);
        expect(modal.close).not.toHaveBeenCalled();
        expect(messages()).toEqual([]);
    });
});

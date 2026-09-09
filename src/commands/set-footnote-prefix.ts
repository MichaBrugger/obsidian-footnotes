import { MarkdownView, TFile } from "obsidian";

import type FootnotePlugin from "../main";
import { footnotePrefixProblem } from "../parsing/footnote-prefix";
import { ensureTextPropertyType } from "../editor/obsidian-internals";
import { ValidatedTextModal } from "./validated-text-modal";

import { showNotice } from "../editor/notice";
// The "Set footnote prefix" command's modal: one text input that writes the
// footnote-prefix frontmatter property on Enter (or the Save button). An
// invalid prefix - spaces, brackets, or a trailing digit - shows the reason
// inline and keeps the modal open until the value is fixed (or the user
// cancels with Escape). An empty value removes the property.

export class SetFootnotePrefixModal extends ValidatedTextModal {
    private plugin: FootnotePlugin;
    private file: TFile;

    constructor(plugin: FootnotePlugin, file: TFile, currentPrefix: string) {
        super(plugin.app, {
            title: "Set footnote prefix",
            fieldName: "Prefix",
            fieldDesc:
                'Written to the note\'s footnote-prefix property. With "2." the numbered command inserts [^2.1], then [^2.2], and so on. Leave empty to remove the property.',
            buttonText: "Save",
            placeholder: "2.",
            initialValue: currentPrefix,
        });
        this.plugin = plugin;
        this.file = file;
    }

    protected async submit() {
        const prefix = this.value.trim();
        const problem = footnotePrefixProblem(prefix);
        if (problem) {
            // stay open until the prefix is valid
            this.showProblem(problem);
            return;
        }
        // flush any unsaved editor changes to this file first:
        // processFrontMatter edits the FILE, and a pending autosave of a
        // stale buffer would silently overwrite the property right after
        // (races lost intermittently until pinned by the smoke suite)
        try {
            const view = this.plugin.app.workspace.getActiveViewOfType(MarkdownView);
            if (view?.file === this.file) await view.save();
            await this.plugin.app.fileManager.processFrontMatter(
                this.file,
                (frontmatter: Record<string, unknown>) => {
                    if (prefix) frontmatter["footnote-prefix"] = prefix;
                    else delete frontmatter["footnote-prefix"];
                },
            );
        } catch {
            // the write can reject: malformed YAML in the note's frontmatter
            // (YAMLParseError) or the file gone from disk under the open
            // modal (ENOENT) - both confirmed live by Jason, 2026-09-08
            // (review A7). Enter and the button call submit() fire-and-
            // forget, so an unhandled rejection left the modal open with
            // nothing but a console error; say so on the modal's own line
            this.showProblem(
                "Couldn't write the footnote-prefix property. Check that the note still exists and that its frontmatter is valid YAML.",
            );
            return;
        }
        // a prefix is TEXT even when it looks numeric ("2.") - without an
        // explicit type, Obsidian infers one from occurrences and can
        // register the property as a number (reported 2026-08-12)
        if (prefix) {
            ensureTextPropertyType(this.plugin.app, "footnote-prefix");
        }
        this.close();
        if (prefix && !this.plugin.settings.enableFootnotePrefix) {
            // the property was written but nothing reads it while the
            // feature is off - without this warning the insert commands
            // just silently ignore the prefix the user set
            showNotice(
                `Footnote prefix set to "${prefix}", but the "Per-note footnote prefix" setting is turned off, so it won't be used until you enable it.`,
                8000,
            );
        } else {
            showNotice(
                prefix
                    ? `Footnote prefix set to "${prefix}".`
                    : "Footnote prefix removed.",
            );
        }
    }
}

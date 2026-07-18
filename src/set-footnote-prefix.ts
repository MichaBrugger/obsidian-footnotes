import { Modal, Notice, Setting, TFile } from "obsidian";

import FootnotePlugin from "./main";
import { footnotePrefixProblem } from "./insert-or-navigate-footnotes";

// The "Set footnote prefix" command's modal: one text input that writes the
// footnote-prefix frontmatter property on Enter (or the Save button). An
// invalid prefix — spaces, brackets, or a trailing digit — shows the reason
// inline and keeps the modal open until the value is fixed (or the user
// cancels with Escape). An empty value removes the property.

export class SetFootnotePrefixModal extends Modal {
    private plugin: FootnotePlugin;
    private file: TFile;
    private value: string;
    private errorEl!: HTMLElement;

    constructor(plugin: FootnotePlugin, file: TFile, currentPrefix: string) {
        super(plugin.app);
        this.plugin = plugin;
        this.file = file;
        this.value = currentPrefix;
    }

    onOpen() {
        this.setTitle("Set footnote prefix");
        const { contentEl } = this;

        new Setting(contentEl)
            .setName("Prefix")
            .setDesc(
                'Written to the note\'s footnote-prefix property. With "2." the auto-numbered command inserts [^2.1], then [^2.2], and so on. Leave empty to remove the property.',
            )
            .addText((text) => {
                text.setPlaceholder("2.")
                    .setValue(this.value)
                    .onChange((value) => {
                        this.value = value;
                        this.showProblem(null);
                    });
                text.inputEl.addEventListener("keydown", (evt) => {
                    if (evt.key === "Enter") {
                        evt.preventDefault();
                        void this.submit();
                    }
                });
                text.inputEl.focus();
                text.inputEl.select();
            });

        this.errorEl = contentEl.createDiv({
            cls: "footnote-shortcut-prefix-error",
        });

        new Setting(contentEl).addButton((button) =>
            button
                .setButtonText("Save")
                .setCta()
                .onClick(() => void this.submit()),
        );
    }

    private showProblem(problem: string | null) {
        this.errorEl.setText(problem ?? "");
    }

    private async submit() {
        const prefix = this.value.trim();
        const problem = footnotePrefixProblem(prefix);
        if (problem) {
            // stay open until the prefix is valid
            this.showProblem(problem);
            return;
        }
        await this.plugin.app.fileManager.processFrontMatter(
            this.file,
            (frontmatter: Record<string, unknown>) => {
                if (prefix) frontmatter["footnote-prefix"] = prefix;
                else delete frontmatter["footnote-prefix"];
            },
        );
        this.close();
        new Notice(
            prefix
                ? `Footnote prefix set to "${prefix}".`
                : "Footnote prefix removed.",
        );
    }

    onClose() {
        this.contentEl.empty();
    }
}

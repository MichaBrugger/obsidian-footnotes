import { App, ButtonComponent, Modal } from "obsidian";

// Every dialog in this plugin is the same shape: one text box that gets
// validated, an error line underneath it, and one main button (plus a
// Cancel). Enter, that button, and, where a subclass wires them up, the
// plugin's own hotkeys all end in submit().
//
// The dialog is built the way Obsidian builds its own "Rename heading" and
// "Rename file" dialogs: a "form" modal inside a "confirmation" container.
// Obsidian's stylesheet then does the rest on every platform. On a phone
// the dialog is a sheet at the bottom of the screen with rounded top
// corners, no close cross, and stacked full-width buttons, and its button
// row is lifted by the height of the on-screen keyboard (Obsidian keeps
// that height in a style variable), so the field, the error line, and the
// buttons all stay above the keyboard. Jason's phone recheck (2026-09-11)
// asked for exactly this: the earlier version pinned the dialog to the top
// of the screen, which kept it clear of the keyboard but looked nothing
// like the native sheet; and it was built from settings rows, which one
// theme boxed like a settings list.
//
// Three modals (set-prefix, rename, name-the-selection) each built this
// wiring by hand. Now this base class owns it, and the subclasses own ONLY
// what their submit does, plus any extra behavior on open and close. The
// name modal's active-modal registry and hotkey scope stay in ITS own
// overrides; the prefix modal deliberately takes no part in that.
//
// This file is not in stryker.config.json's mutate list. Modal DOM tested
// against the live app is smoke-test territory, the same policy as
// set-footnote-prefix.ts.

export interface ValidatedTextModalUi {
    title: string;
    /** read out by screen readers for the text box; the box has no visible label, as in Obsidian's own rename dialogs */
    fieldName: string;
    fieldDesc: string;
    buttonText: string;
    placeholder?: string;
    /** fills the box in and selects the text, so replacing it takes one step */
    initialValue?: string;
    /** select only the part of `initialValue` from this position onwards. The rename modal uses it to leave an armed footnote prefix visibly in place. Leave it out to select everything. */
    selectFrom?: number;
}

export abstract class ValidatedTextModal extends Modal {
    protected value: string;
    private errorEl!: HTMLElement;
    private inputEl: HTMLInputElement | null = null;
    private ui: ValidatedTextModalUi;

    constructor(app: App, ui: ValidatedTextModalUi) {
        super(app);
        this.ui = ui;
        this.value = ui.initialValue ?? "";
    }

    onOpen() {
        this.setTitle(this.ui.title);
        // Obsidian's own classes for a small form dialog (see the note at
        // the top of this file), plus one of ours for the stylesheet
        this.containerEl.addClass("mod-confirmation");
        this.modalEl.addClass("mod-form", "footnote-shortcut-text-modal");
        const { contentEl } = this;

        contentEl.createDiv({
            cls: "footnote-shortcut-text-modal-desc",
            text: this.ui.fieldDesc,
        });

        const input = contentEl.createEl("input", {
            type: "text",
            cls: "footnote-shortcut-text-modal-input",
            attr: { "aria-label": this.ui.fieldName },
        });
        if (this.ui.placeholder) input.placeholder = this.ui.placeholder;
        input.value = this.value;
        input.addEventListener("input", () => {
            this.value = input.value;
            this.showProblem(null);
        });
        input.addEventListener("keydown", (evt) => {
            if (evt.key === "Enter") {
                evt.preventDefault();
                void this.submit();
            }
        });
        this.inputEl = input;

        this.errorEl = contentEl.createDiv({
            cls: "footnote-shortcut-prefix-error",
        });

        // the button row Obsidian's own dialogs use: the main button first,
        // then Cancel, which a phone stacks under it full width
        const buttons = this.modalEl.createDiv({ cls: "modal-button-container" });
        new ButtonComponent(buttons)
            .setButtonText(this.ui.buttonText)
            .setCta()
            .onClick(() => void this.submit());
        const cancel = new ButtonComponent(buttons)
            .setButtonText("Cancel")
            .onClick(() => {
                this.close();
            });
        cancel.buttonEl.addClass("mod-cancel");

        input.focus();
        if (this.ui.initialValue !== undefined) {
            input.setSelectionRange(this.ui.selectFrom ?? 0, input.value.length);
        }
    }

    /** Shows an error line under the input. Pass null to clear it. */
    protected showProblem(problem: string | null) {
        this.errorEl.setText(problem ?? "");
        // A refused value keeps the field focused, so on a phone the
        // keyboard stays up (or comes straight back after a tap on the
        // button took the focus) and the fix can be typed at once. The
        // text is selected whole, since a refused name is usually retyped
        // (Jason's phone pass, 2026-09-11).
        if (problem !== null && this.inputEl) {
            this.inputEl.focus();
            this.inputEl.select();
        }
    }

    /** Enter, the main button, and any hotkey a subclass wires up all land here. To keep the modal open, call showProblem and return. To finish, call close(). */
    protected abstract submit(): void | Promise<void>;

    onClose() {
        this.contentEl.empty();
    }
}

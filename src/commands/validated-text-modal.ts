import { App, Modal, Platform, Setting } from "obsidian";

// Every dialog in this plugin is the same shape: one text box that gets
// validated, an error line underneath it, and one main button. Enter, that
// button, and, where a subclass wires them up, the plugin's own hotkeys all
// end in submit().
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
    private ui: ValidatedTextModalUi;
    private keyboardFit: (() => void) | null = null;

    constructor(app: App, ui: ValidatedTextModalUi) {
        super(app);
        this.ui = ui;
        this.value = ui.initialValue ?? "";
    }

    onOpen() {
        this.setTitle(this.ui.title);
        // a hook for the stylesheet: some themes draw a box around a
        // setting row on the phone, and a one-field dialog is not a
        // settings list (Jason's phone pass under Minimal, 2026-09-11)
        this.modalEl.addClass("footnote-shortcut-text-modal");
        // On Android the on-screen keyboard is drawn OVER the webview
        // rather than shrinking it. A modal centered vertically therefore
        // keeps its lower half, which is the error line and the main
        // button, hidden behind the keyboard (Jason's beta report,
        // 2026-08-28).
        //
        // So on mobile, pin the modal to the TOP of the screen and limit
        // its height to what the keyboard leaves visible.
        // visualViewport.height shrinks when the keyboard opens, and its
        // resize event fires both when the keyboard opens AND when it
        // closes.
        if (Platform.isMobile) {
            this.containerEl.addClass("footnote-shortcut-keyboard-aware");
            const viewport = this.containerEl.win.visualViewport;
            if (viewport) {
                this.keyboardFit = () => {
                    this.modalEl.style.setProperty(
                        "--footnote-shortcut-viewport-max",
                        `${viewport.height - 16}px`,
                    );
                };
                this.keyboardFit();
                viewport.addEventListener("resize", this.keyboardFit);
            }
        }
        const { contentEl } = this;

        new Setting(contentEl)
            .setName(this.ui.fieldName)
            .setDesc(this.ui.fieldDesc)
            .addText((text) => {
                if (this.ui.placeholder) text.setPlaceholder(this.ui.placeholder);
                text.setValue(this.value).onChange((value) => {
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
                if (this.ui.initialValue !== undefined) {
                    text.inputEl.setSelectionRange(
                        this.ui.selectFrom ?? 0,
                        text.inputEl.value.length,
                    );
                }
            });

        this.errorEl = contentEl.createDiv({
            cls: "footnote-shortcut-prefix-error",
        });

        new Setting(contentEl).addButton((button) =>
            button
                .setButtonText(this.ui.buttonText)
                .setCta()
                .onClick(() => void this.submit()),
        );
    }

    /** Shows an error line under the input. Pass null to clear it. */
    protected showProblem(problem: string | null) {
        this.errorEl.setText(problem ?? "");
    }

    /** Enter, the main button, and any hotkey a subclass wires up all land here. To keep the modal open, call showProblem and return. To finish, call close(). */
    protected abstract submit(): void | Promise<void>;

    onClose() {
        if (this.keyboardFit) {
            this.containerEl.win.visualViewport?.removeEventListener(
                "resize",
                this.keyboardFit,
            );
            this.keyboardFit = null;
        }
        this.contentEl.empty();
    }
}

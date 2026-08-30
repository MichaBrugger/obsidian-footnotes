import { App, Modal, Platform, Setting } from "obsidian";

// The one-validated-text-field modal every dialog in this plugin is:
// a single Setting with a text input, an inline error line under it,
// and a CTA button - Enter, the button, and (where a subclass wires
// them) the plugin's own hotkeys all land in submit(). Three modals
// (set-prefix, rename, name-the-selection) each hand-rolled this
// wiring; the base owns it, the subclasses own ONLY their submit
// semantics and any extra onOpen/onClose behavior (the name modal's
// active-modal registry and hotkey scope stay in ITS overrides - the
// prefix modal deliberately does not participate in that protocol).
//
// Not in stryker.config.json's mutate list: modal DOM against the live
// app is smoke-test territory, same policy as set-footnote-prefix.ts.

export interface ValidatedTextModalUi {
    title: string;
    fieldName: string;
    fieldDesc: string;
    buttonText: string;
    placeholder?: string;
    /** prefills the input and selects it, so editing is one step */
    initialValue?: string;
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
        // On Android the soft keyboard OVERLAYS the webview instead of
        // resizing it, so a vertically centered modal keeps its lower
        // half - the error line and the CTA button - hidden behind the
        // keyboard (Jason's beta report, 2026-08-28). Anchor the modal to
        // the TOP of the screen on mobile and cap its height to what the
        // keyboard leaves visible: visualViewport.height shrinks when the
        // keyboard opens and its resize event fires on open AND close.
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
                if (this.ui.initialValue !== undefined) text.inputEl.select();
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

    /** the inline error line; null clears it */
    protected showProblem(problem: string | null) {
        this.errorEl.setText(problem ?? "");
    }

    /** Enter, the CTA button, and any subclass-wired hotkey land here. Stay open by returning after showProblem; close() when done. */
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

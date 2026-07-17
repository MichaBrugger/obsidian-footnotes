import { App, Editor, EditorPosition, TFile, Vault } from "obsidian";

// Typed views of the undocumented Obsidian / CodeMirror internals this plugin
// relies on. Only the members actually used are declared, and every entry
// point is optional where a future Obsidian release could remove it, so
// callers degrade gracefully instead of crashing.

/** CodeMirror 6 EditorView, reachable through the undocumented `Editor.cm`. */
export interface ObsidianEditorView {
    state: { selection: { main: { head: number } } };
    coordsAtPos(pos: number): { left: number; top: number; bottom: number } | null;
    /** Maps a DOM node inside the editor — including widget DOM such as the
     * table editor — to a document offset. Standard CM6 API. */
    posAtDOM?(node: Node): number;
    contentDOM: HTMLElement;
    focus(): void;
    /** CM5-compatibility editor attached by the vim extension ("cm two levels deep"). */
    cm?: unknown;
}

export interface EditorWithCm extends Editor {
    cm?: ObsidianEditorView;
}

/** The editable markdown embed produced by the embed registry. */
export interface MarkdownEmbed {
    editable: boolean;
    dirty?: boolean;
    saving?: boolean;
    saveAgain?: boolean;
    subpathNotFound?: boolean;
    editMode?: {
        editor?: {
            focus(): void;
            lastLine?(): number;
            getLine?(line: number): string;
            getValue?(): string;
            setCursor?(pos: EditorPosition): void;
        };
    };
    load(): void;
    unload(): void;
    loadFile(): Promise<void>;
    showEditor(): void;
    /** Immediate save — `requestSave` is its debounced wrapper. */
    save?(): Promise<void> | void;
}

export type EmbedCreator = (
    context: {
        app: App;
        linktext: string;
        sourcePath: string;
        containerEl: HTMLElement;
        depth: number;
    },
    file: TFile,
    subpath: string,
) => MarkdownEmbed;

export interface AppWithEmbedRegistry extends App {
    embedRegistry?: {
        embedByExtension?: Partial<Record<string, EmbedCreator>>;
    };
}

/** The command registry, used to wrap the core save command ("Lint on save"). */
export interface AppWithCommands extends App {
    commands?: {
        commands?: Record<
            string,
            { checkCallback?: (checking: boolean) => boolean | void } | undefined
        >;
    };
}

/** `Vault.getConfig` reads editor config like `vimMode`. */
export interface VaultWithConfig extends Vault {
    getConfig?(key: string): unknown;
}

/** The vim CM5-adapter global, present when vim mode is active. */
export interface WindowWithVim extends Window {
    CodeMirrorAdapter?: {
        Vim: {
            getVimGlobalState_(): {
                jumpList: {
                    add(cm: unknown, from: EditorPosition, to: EditorPosition): void;
                };
            };
        };
    };
}

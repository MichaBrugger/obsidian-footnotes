import {
    App,
    Editor,
    EditorPosition,
    EventRef,
    MarkdownView,
    TFile,
    Vault,
} from "obsidian";

// Typed views of the undocumented Obsidian / CodeMirror internals this plugin
// relies on. Only the members actually used are declared, and every entry
// point is optional where a future Obsidian release could remove it, so
// callers degrade gracefully instead of crashing.

/** CodeMirror 6 EditorView, reachable through the undocumented `Editor.cm`. */
interface ObsidianEditorView {
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

/**
 * `view.editor` as reality has it: the typings promise an Editor, but a
 * deferred MarkdownView (Obsidian 1.7+ lazy tab loading) has none until the
 * view actually loads. Every command entry point guards through this instead
 * of trusting the declared type.
 */
export function viewEditor(view: MarkdownView): Editor | null {
    return (view as { editor?: Editor }).editor ?? null;
}

/** The editable markdown embed produced by the embed registry. */
interface MarkdownEmbed {
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

type EmbedCreator = (
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

/** The community-plugin registry: an id is present exactly while that plugin is enabled. Used to show the Linter-coexistence warning only to Linter users. */
export interface AppWithPlugins extends App {
    plugins?: {
        plugins?: Record<string, unknown>;
    };
}

/** The command registry, used to wrap the core save command ("Lint on save"). */
export interface AppWithCommands extends App {
    commands?: {
        commands?: Record<
            string,
            // boolean | undefined rather than Obsidian's `boolean | void`:
            // wrappers store and forward the result, and void is not a
            // legal union member under strict-type-checked
            | { checkCallback?: (checking: boolean) => boolean | undefined }
            | undefined
        >;
        executeCommandById?(id: string): boolean;
    };
}

/** `Vault.getConfig` reads editor config like `vimMode`. */
export interface VaultWithConfig extends Vault {
    getConfig?(key: string): unknown;
}

/**
 * Vault's undocumented "config-changed" event (fires when e.g. vim mode is
 * toggled). A standalone shape rather than a Vault extension: adding the
 * overload to an interface extending Vault conflicts with the typed event
 * overloads it inherits.
 */
export interface VaultWithConfigEvents {
    on(name: "config-changed", callback: () => void): EventRef;
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
            /** Register (or override) an ex command like ":w". */
            defineEx?(
                name: string,
                shortName: string,
                handler: () => void,
            ): void;
        };
    };
}

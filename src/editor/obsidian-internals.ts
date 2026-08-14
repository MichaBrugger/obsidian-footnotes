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
    /** CM5-compatibility editor attached by the vim extension ("cm two levels deep"). `state.vim.insertMode` is how the popup's Escape handling tells "leave insert mode" apart from "close me" — the editor preventDefaults EVERY Escape, so event state can't (2026-08-13). */
    cm?: { state?: { vim?: { insertMode?: boolean } } };
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

/** The undocumented vault-wide property-type registry behind the Properties panel (Obsidian 1.4+). Optional throughout: a future release renaming any of it must degrade to a no-op, never a crash. */
interface MetadataTypeManager {
    getPropertyInfo?(name: string): { widget?: string } | null | undefined;
    setType?(name: string, type: string): void;
}

interface AppWithMetadataTypeManager extends App {
    metadataTypeManager?: MetadataTypeManager;
}

/**
 * Pin `name`'s vault-wide property type to "text". Obsidian INFERS an
 * unassigned property's type from its occurrences — numeric-looking
 * footnote-prefix values like "2." registered the property as a NUMBER,
 * after which the Properties panel coerces edits numerically (reported
 * 2026-08-12). An explicit assignment persists in types.json and wins over
 * inference. No-op when the type is already text or the registry is
 * unavailable.
 */
export function ensureTextPropertyType(app: App, name: string): void {
    const manager = (app as AppWithMetadataTypeManager).metadataTypeManager;
    if (!manager?.setType) return;
    if (manager.getPropertyInfo?.(name)?.widget === "text") return;
    try {
        manager.setType(name, "text");
    } catch {
        // private API — a shape change must never break the caller
    }
}

/** Whether `mdView` is in Reading view — where every text-editing command must be inert (the editor API would edit the HIDDEN buffer). The structural parameter type keeps getMode honestly optional: bare test fakes without it count as editable. Lives beside viewEditor — both guard against what the view actually is (moved out of doc-context, 2026-08-11 review cleanliness). */
export function readingViewActive(mdView: {
    getMode?: MarkdownView["getMode"];
}): boolean {
    return mdView.getMode?.() === "preview";
}

/** The editable markdown embed produced by the embed registry. */
interface MarkdownEmbed {
    editable: boolean;
    dirty?: boolean;
    saving?: boolean;
    saveAgain?: boolean;
    subpathNotFound?: boolean;
    /** The section text as of the last set() — NOT live editor content. save()'s retry path reads this. */
    text?: string;
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
    /**
     * Immediate save — `requestSave` is its debounced wrapper. The section
     * text and the write flag are REQUIRED: current Obsidian's save(t, n)
     * passes t straight into set(), and set(undefined) both throws deep in
     * the save chain AND poisons `this.text` so the embed's own later
     * saves crash uncaught (the rapid-succession console error, root-caused
     * live 2026-08-13); n defaults to FALSE, which skips the disk write
     * entirely.
     */
    save?(text: string, write: boolean): Promise<void> | void;
    /** The debounced save/fold-save wrappers (Obsidian debounce objects). A timer left armed at unload fires against the CLEARED embed state and throws deep in the save chain (reported 2026-08-13) — teardown cancels both. */
    requestSave?: { cancel?(): void };
    requestSaveFolds?: { cancel?(): void };
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

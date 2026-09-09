// How the popup keeps retrying until it can bind. The logic here is pure,
// and the clock is passed in, so unit tests can pin it down exactly.
//
// The popup is an embed tied to the new definition by subpath, and Obsidian
// resolves that subpath from the metadata cache. The cache only learns
// about the definition once the note has been saved AND re-indexed. The old
// loop waited on a 3 second wall clock, rebuilding the embed every 500ms
// whether or not anything had changed, and fell back to the old jump when
// the clock ran out. On a busy machine saving plus re-indexing takes longer
// than 3 seconds, so the popup setting looked as though it was being
// ignored (Jason's report 2026-09-04; he picked all three options:
// event-driven retries, a waiting notice, and a long safety cap).
//
// So retries now ride the cache's own "changed" events for this file. A
// slow idle retry runs alongside them as belt and braces, because an event
// missed for any reason must not leave the wait stranded. A notice appears
// once the wait is long enough to feel like a dropped keypress. The cap is
// long enough that only a cache which never delivers at all gives up: that,
// not mere slowness, is what the jump fallback is for.

export const PopupWaitingNotice = "Waiting for Obsidian to index the new footnote…";

/**
 * Whether the popup can bind to `footnoteId` at all.
 *
 * The embed is bound by the subpath "#[^id]", and Obsidian splits subpaths
 * on "#". A name that contains a "#" can therefore never resolve, however
 * long the retries wait (Jason's report 2026-09-05: a "[^#chapter-1]" sat
 * behind the waiting notice until the cap ran out, then jumped). Names like
 * that skip the retry loop and take the jump fallback straight away.
 */
export function popupCanBind(footnoteId: string): boolean {
    return !footnoteId.includes("#");
}

export const PopupRetryTiming = {
    /** How long before the wait gets a notice - past the point it feels like a dropped keypress. */
    noticeAfterMs: 1000,
    /** The belt-and-braces retry cadence when no cache event arrives. */
    idleRetryMs: 2000,
    /** The only give-up: a cache that never delivers, not a slow one. */
    capMs: 20000,
} as const;

export interface PopupRetryHooks {
    /** One attempt to bind and show the embed. True means it was shown, or that the popup closed in the meantime, which counts as handled. */
    tryShow(): Promise<boolean>;
    /** Throw away the embed that failed to resolve and build a fresh one. An embed that has loaded never looks up its subpath again. */
    rebuild(): void;
    closed(): boolean;
    now(): number;
    delay(ms: number): Promise<void>;
    /** Listen for the metadata cache's changes to THIS file. Returns the function that stops listening. */
    onCacheChange(listener: () => void): () => void;
    /** Show the waiting notice. Returns the function that hides it again. */
    showWaitingNotice(): () => void;
}

/**
 * Keep trying to show the popup until it binds, until the popup is closed,
 * or until the safety cap runs out. True means the press was handled: the
 * popup was shown, or the user closed it. False means give up, and the
 * caller's fallback takes over the press.
 */
export async function retryUntilShown(
    hooks: PopupRetryHooks,
    timing: typeof PopupRetryTiming = PopupRetryTiming,
): Promise<boolean> {
    // a holder object rather than plain variables: the listener flips
    // `changed` and wakes the sleeping loop from inside a closure, and
    // TypeScript treats plain variables assigned that way as if they never
    // changed
    const pending: { changed: boolean; wake: (() => void) | null } = {
        changed: false,
        wake: null,
    };
    // start listening BEFORE the first attempt: an event that arrives while
    // tryShow is still running must queue the next rebuild, not disappear
    const unsubscribe = hooks.onCacheChange(() => {
        pending.changed = true;
        pending.wake?.();
    });
    let hideNotice: (() => void) | null = null;
    try {
        if (await hooks.tryShow()) return true;
        const start = hooks.now();
        let nextIdleRetry = start + timing.idleRetryMs;
        while (!hooks.closed()) {
            if (pending.changed) {
                pending.changed = false;
                hooks.rebuild();
                if (await hooks.tryShow()) return true;
                continue;
            }
            const now = hooks.now();
            if (now >= start + timing.capMs) return false;
            if (hideNotice === null && now >= start + timing.noticeAfterMs) {
                hideNotice = hooks.showWaitingNotice();
            }
            if (now >= nextIdleRetry) {
                nextIdleRetry = now + timing.idleRetryMs;
                hooks.rebuild();
                if (await hooks.tryShow()) return true;
                continue;
            }
            // sleep until whichever comes first: the next idle retry, the
            // notice, or the cap. A cache event can wake the loop sooner.
            const until = Math.min(
                nextIdleRetry,
                start + timing.capMs,
                hideNotice === null ? start + timing.noticeAfterMs : Infinity,
            );
            await new Promise<void>((resolve) => {
                pending.wake = resolve;
                void hooks.delay(Math.max(0, until - now)).then(resolve);
            });
            pending.wake = null;
        }
        return true;
    } finally {
        unsubscribe();
        hideNotice?.();
    }
}

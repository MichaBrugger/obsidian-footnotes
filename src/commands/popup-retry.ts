// The popup's bind-retry policy, pure and clock-injected so units can pin
// it. The popup is an embed bound to the new definition by subpath, and
// Obsidian resolves that subpath from the metadata cache - which only
// learns about the definition once the note is saved AND re-indexed. The
// old loop waited on a 3s wall clock, rebuilding the embed every 500ms
// whether or not anything had changed, and fell back to the legacy jump
// when the clock ran out; on a busy machine save-plus-reindex takes longer
// than that, so the popup setting looked ignored (Jason's report
// 2026-09-04, his pick of three options: event-driven retries, a waiting
// notice, and a long safety cap).
//
// Retries now ride the cache's own "changed" events for the file, with a
// slow idle cadence as belt and braces (an event missed for any reason
// must not strand the wait), a notice once the wait is long enough to
// feel like a dropped keypress, and a cap long enough that only a cache
// that never delivers gives up - that, not slowness, is what the jump
// fallback is for.

export const PopupWaitingNotice = "Waiting for Obsidian to index the new footnote…";

/**
 * Whether the popup can bind `footnoteId` at all. The embed is bound by
 * the subpath "#[^id]", and Obsidian splits subpaths on "#" - so an id
 * carrying one can never resolve, no matter how long the retries wait
 * (Jason's report 2026-09-05: a "[^#chapter-1]" sat behind the waiting
 * notice until the cap, then jumped). Such ids skip the retry loop and
 * take the jump fallback immediately.
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
    /** One attempt to bind and show the embed: true = shown (or the popup closed meanwhile, which counts as handled). */
    tryShow(): Promise<boolean>;
    /** Throw away the embed that failed to resolve and build a fresh one - a loaded embed never re-resolves its subpath. */
    rebuild(): void;
    closed(): boolean;
    now(): number;
    delay(ms: number): Promise<void>;
    /** Subscribe to the metadata cache's changes for THIS file; returns the unsubscribe. */
    onCacheChange(listener: () => void): () => void;
    /** Show the waiting notice; returns its hide. */
    showWaitingNotice(): () => void;
}

/**
 * Keep trying to show the popup until it binds, the popup is closed, or
 * the safety cap passes. True = handled (shown, or closed by the user);
 * false = give up, the caller's fallback owns the press.
 */
export async function retryUntilShown(
    hooks: PopupRetryHooks,
    timing: typeof PopupRetryTiming = PopupRetryTiming,
): Promise<boolean> {
    // holder object: the listener flips `changed` and wakes the sleeping
    // loop from a closure, and plain variables assigned that way read as
    // never-changing to the type checker's narrowing
    const pending: { changed: boolean; wake: (() => void) | null } = {
        changed: false,
        wake: null,
    };
    // armed BEFORE the first attempt: an event that lands while tryShow is
    // in flight must queue the next rebuild, not vanish
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
            // sleep until the next thing due - idle retry, notice, or
            // cap - unless a cache event wakes the loop first
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

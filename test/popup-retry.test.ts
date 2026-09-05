import { describe, expect, it } from "vitest";

import {
    PopupRetryHooks,
    PopupRetryTiming,
    retryUntilShown,
} from "../src/commands/popup-retry";

// The popup's bind-retry policy, extracted so the slow-machine contract is
// unit-testable (Jason's report 2026-09-04: with the popup ON, a busy PC
// sometimes JUMPED to the definition instead - the old 3s wall-clock
// deadline expired before Obsidian re-indexed the note, and the retry loop
// rebuilt the embed every 500ms, competing for the same CPU). His pick,
// option 3: retries are driven by the metadata cache's change events,
// with a slow idle cadence as belt and braces, a "waiting" notice once the
// wait becomes noticeable, and a long safety cap as the only give-up.

/** A fake clock plus the hooks the policy needs, all recorded. */
function harness(tryShowResults: () => boolean) {
    let now = 0;
    const timers: { at: number; resolve: () => void }[] = [];
    const listeners: (() => void)[] = [];
    let closed = false;
    const log: string[] = [];
    let noticeShown = 0;
    let noticeHidden = 0;
    const hooks: PopupRetryHooks = {
        tryShow: () => {
            log.push(`try@${now}`);
            return Promise.resolve(tryShowResults());
        },
        rebuild: () => {
            log.push(`rebuild@${now}`);
        },
        closed: () => closed,
        now: () => now,
        delay: (ms) =>
            new Promise<void>((resolve) => {
                timers.push({ at: now + ms, resolve });
            }),
        onCacheChange: (listener) => {
            listeners.push(listener);
            return () => {
                const i = listeners.indexOf(listener);
                if (i !== -1) listeners.splice(i, 1);
            };
        },
        showWaitingNotice: () => {
            noticeShown++;
            log.push(`notice@${now}`);
            return () => {
                noticeHidden++;
            };
        },
    };
    const flush = async () => {
        for (let i = 0; i < 20; i++) await Promise.resolve();
    };
    /** Advance the clock, firing due timers in order. */
    const advance = async (ms: number) => {
        const target = now + ms;
        for (;;) {
            const due = timers
                .filter((t) => t.at <= target)
                .sort((a, b) => a.at - b.at)
                .at(0);
            if (!due) break;
            timers.splice(timers.indexOf(due), 1);
            now = due.at;
            due.resolve();
            await flush();
        }
        now = target;
        await flush();
    };
    const cacheChanged = async () => {
        for (const l of [...listeners]) l();
        await flush();
    };
    return {
        hooks,
        log,
        advance,
        cacheChanged,
        flush,
        close: () => {
            closed = true;
        },
        listenerCount: () => listeners.length,
        notices: () => ({ shown: noticeShown, hidden: noticeHidden }),
    };
}

const T = PopupRetryTiming;
const rebuilds = (log: string[]) => log.filter((e) => e.startsWith("rebuild"));

describe("retryUntilShown (popup bind policy)", () => {
    it("a first-try success neither rebuilds nor subscribes anything lasting", async () => {
        const h = harness(() => true);
        expect(await retryUntilShown(h.hooks)).toBe(true);
        expect(h.log).toEqual(["try@0"]);
        expect(h.listenerCount()).toBe(0);
        expect(h.notices()).toEqual({ shown: 0, hidden: 0 });
    });

    it("a cache change wakes an immediate rebuild and retry, well before the idle cadence", async () => {
        let attempts = 0;
        const h = harness(() => ++attempts >= 2);
        const result = retryUntilShown(h.hooks);
        await h.flush();
        await h.advance(100);
        await h.cacheChanged();
        expect(await result).toBe(true);
        expect(h.log).toEqual(["try@0", "rebuild@100", "try@100"]);
        expect(h.listenerCount()).toBe(0);
    });

    it("a slow machine (cache change after 5s) still shows the popup, with the waiting notice shown then hidden", async () => {
        let attempts = 0;
        const h = harness(() => ++attempts >= 4);
        const result = retryUntilShown(h.hooks);
        await h.flush();
        await h.advance(5000);
        expect(h.notices().shown).toBe(1);
        expect(h.notices().hidden).toBe(0);
        await h.cacheChanged();
        expect(await result).toBe(true);
        expect(h.notices()).toEqual({ shown: 1, hidden: 1 });
    });

    it("without cache events it retries on the slow idle cadence, not every half second", async () => {
        const h = harness(() => false);
        const result = retryUntilShown(h.hooks);
        await h.flush();
        await h.advance(T.idleRetryMs - 1);
        expect(rebuilds(h.log)).toEqual([]);
        await h.advance(1);
        expect(rebuilds(h.log)).toEqual([`rebuild@${T.idleRetryMs}`]);
        await h.advance(T.idleRetryMs);
        expect(rebuilds(h.log)).toEqual([
            `rebuild@${T.idleRetryMs}`,
            `rebuild@${T.idleRetryMs * 2}`,
        ]);
        h.close();
        await h.advance(T.idleRetryMs);
        await result;
    });

    it("the waiting notice appears once the wait becomes noticeable, and only once", async () => {
        const h = harness(() => false);
        const result = retryUntilShown(h.hooks);
        await h.flush();
        await h.advance(T.noticeAfterMs - 1);
        expect(h.notices().shown).toBe(0);
        await h.advance(1);
        expect(h.notices().shown).toBe(1);
        await h.advance(T.idleRetryMs * 3);
        expect(h.notices().shown).toBe(1);
        h.close();
        await h.advance(T.idleRetryMs);
        await result;
        expect(h.notices().hidden).toBe(1);
    });

    it("gives up only at the safety cap, unsubscribed and notice hidden", async () => {
        const h = harness(() => false);
        const result = retryUntilShown(h.hooks);
        await h.flush();
        let settled = false;
        void result.then(() => {
            settled = true;
        });
        await h.advance(T.capMs - 1);
        expect(settled).toBe(false);
        await h.advance(1);
        expect(await result).toBe(false);
        expect(h.listenerCount()).toBe(0);
        expect(h.notices().hidden).toBe(1);
    });

    it("the timings suit a genuinely busy machine", () => {
        expect(T.capMs).toBeGreaterThanOrEqual(15000);
        expect(T.idleRetryMs).toBeGreaterThanOrEqual(1000);
        expect(T.noticeAfterMs).toBeLessThan(T.idleRetryMs);
    });

    it("a popup closed while waiting counts as handled: true, no further tries", async () => {
        const h = harness(() => false);
        const result = retryUntilShown(h.hooks);
        await h.flush();
        h.close();
        await h.cacheChanged();
        expect(await result).toBe(true);
        expect(h.log).toEqual(["try@0"]);
        expect(h.listenerCount()).toBe(0);
    });

    it("a cache change landing DURING an attempt is not lost", async () => {
        // the listener is armed before the first try, so an event that
        // fires while tryShow is in flight queues the next rebuild
        let attempts = 0;
        const trigger: { fire: (() => Promise<void>) | null } = { fire: null };
        const h = harness(() => {
            attempts++;
            if (attempts === 1) void trigger.fire?.();
            return attempts >= 2;
        });
        trigger.fire = () => h.cacheChanged();
        const result = retryUntilShown(h.hooks);
        expect(await result).toBe(true);
        expect(h.log).toEqual(["try@0", "rebuild@0", "try@0"]);
    });
});

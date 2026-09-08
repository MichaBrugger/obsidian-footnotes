// Toast assertions, in one place. The obsidian mock's Notice is
// self-recording (test/mocks/obsidian.ts explains why module mocking
// cannot work under `isolate: false`), so every spec that checks a toast
// used to hand-roll the same two one-liners over `noticeCalls` and reset
// the array by hand. These are those one-liners.
//
// `messages()` returns the FIRST constructor argument of every Notice
// built so far, in order - the toast text. Specs that need the other
// arguments (the timeout, say) still read `noticeCalls` directly.
import { noticeCalls } from "../mocks/obsidian";

/** every toast text raised so far, in order */
export function messages(): string[] {
    return noticeCalls.map((args) => args[0] as string);
}

/** did this exact toast text appear? */
export function noticed(message: string): boolean {
    return messages().includes(message);
}

/** forget every recorded toast - call before the press under test */
export function resetNotices(): void {
    noticeCalls.length = 0;
}

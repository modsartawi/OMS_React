/**
 * The lookup's recent searches (ticket 239) — the keys of the last five searches
 * that **resolved a member**, newest first.
 *
 * 🚩 **`sessionStorage`, deliberately, and never `localStorage`.** A loyalty key
 * is a customer's mobile number on a shared back-office workstation. The chips
 * survive a reload and a walk to another screen, and they die with the tab —
 * `features/oms/deliveries/grid-views.ts` persists to `localStorage`, but grid
 * views are the agent's own furniture and these are customers, so that precedent
 * deliberately does not carry (239 decision 1).
 *
 * 🚩 **What is stored is the key the AGENT TYPED**, not a compacted or normalised
 * form. The chip is a record of what they did, and `resolveMember` compacts on the
 * way out exactly as it does for typing — so there is no second normalisation rule
 * here to drift from the first one.
 *
 * The list logic and the storage are split on purpose: `pushRecent` and
 * `parseRecents` are pure and carry the suite, while `readRecents` / `saveRecents`
 * are the thin edge that touches a browser API vitest's node environment does not
 * have.
 */

import { compact } from './resolve-member'

/** Five, not three: five twelve-digit keys sit in one row under the centred
 *  field, and three throws away the member looked at four searches ago. */
export const RECENT_LIMIT = 5

/** 🚩 Per-TAB by construction, and the name says the storage it lives in so a
 *  future reader does not have to open two files to learn it is not on disk. */
export const RECENT_STORAGE_KEY = 'oms.loy.recentSearches.v1'

/**
 * The new list after searching `key` — newest first, deduped, capped.
 *
 * A key already on the bar **moves to the front** rather than appearing twice: the
 * bar is a set of members, and a second chip for the same person is a wasted slot
 * out of five. Blank input is dropped rather than stored as an unclickable chip.
 */
export function pushRecent(list: readonly string[], key: string): string[] {
  const trimmed = key.trim()
  if (!trimmed) return [...list]
  return [trimmed, ...list.filter((entry) => entry !== trimmed)].slice(0, RECENT_LIMIT)
}

/**
 * The stored list, read defensively out of whatever the store actually holds.
 *
 * 🚩 **Anything unreadable is an empty list, never a throw.** This parses a store a
 * human can edit in devtools and a previous version of this code may have written
 * in another shape — and it runs during the render of the screen the whole area
 * hangs off. A `JSON.parse` throw here would take the lookup down over a
 * convenience feature, which is the one outcome this module may not produce.
 */
export function parseRecents(raw: string | null | undefined): string[] {
  if (!raw) return []
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return []
  }
  if (!Array.isArray(parsed)) return []
  return parsed
    .filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0)
    .slice(0, RECENT_LIMIT)
}

/**
 * Read the bar from `sessionStorage`.
 *
 * The try/catch is not defensive dressing: a locked-down profile and some private
 * modes throw on the *access itself*, so degrading to "no chips ever appear" is
 * the correct failure for a feature that decorates a screen it must not be able to
 * break.
 */
export function readRecents(): string[] {
  try {
    return parseRecents(window.sessionStorage.getItem(RECENT_STORAGE_KEY))
  } catch {
    return []
  }
}

/** Write the bar back, swallowing a storage that refuses — see `readRecents`. */
export function saveRecents(list: readonly string[]): void {
  try {
    window.sessionStorage.setItem(RECENT_STORAGE_KEY, JSON.stringify(list.slice(0, RECENT_LIMIT)))
  } catch {
    /* a bar that cannot be saved is a bar that does not appear next time */
  }
}

/**
 * The bar after a member's mobile has been removed (ticket 307) — the chips that
 * are **that number**, gone.
 *
 * 🚩 **This is the last half of honouring the request.** The chips hold the key
 * the agent typed, in `sessionStorage`, on a shared back-office workstation — so
 * the number a customer has just asked to have taken away would otherwise sit in
 * the agent's session, on screen, as a chip that no longer resolves.
 *
 * 🚩 **A chip is keystrokes and a number is a number**, so both sides are
 * compacted before they are compared — `+966 555 000-111` and `966555000111` are
 * the same chip. It is `resolveMember`'s own `compact`, reused rather than
 * re-spelled: a second spelling of that rule is how the bar starts disagreeing
 * with the lookup about what a chip means (decision 225 ruling 4).
 *
 * 🚩 **A loyalty-id chip is deliberately kept.** It still resolves — the member
 * is still there, and after this command the id is the ONLY handle anyone has on
 * them, because the portal's search will not find them by number any more.
 * Dropping it would take away the one way back.
 *
 * A member who had no number to remove leaves the bar exactly as it was.
 */
export function forgetRemovedMobile(
  list: readonly string[],
  removed: string | null | undefined,
): string[] {
  const gone = compact(removed?.trim() ?? '')
  if (!gone) return [...list]
  return list.filter((entry) => compact(entry.trim()) !== gone)
}

/**
 * Who is currently drawing the bar. A `Set`, so a remount cannot register twice.
 *
 * 🚩 **This exists because the bar has two writers and one of them is not the
 * screen that draws it.** `MemberLookupPage` owns the route that renders the
 * chips AND the route that renders a member's tabs — it stays mounted while a
 * **contact removal** runs — so it holds the list in `useState` seeded once at
 * mount. Without a way to be told, a removal that only rewrote `sessionStorage`
 * would leave that state holding the number: the chip would keep rendering, and
 * the agent's next search would `pushRecent` off the stale array and write the
 * removed customer's number straight back into the store. That is precisely the
 * leak the removal exists to close, arriving one search later.
 */
const listeners = new Set<(list: string[]) => void>()

/** Draw the bar from the store, and be told when the store changes underneath.
 *  Returns the unsubscribe, so it drops straight into a `useEffect`. */
export function subscribeRecents(listener: (list: string[]) => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/**
 * Drop the removed number from the bar **in the session** — the whole of the
 * chip half of a mobile removal, in the module that owns the bar.
 *
 * The command calls this and nothing else: reading the store, applying the rule,
 * writing it back and telling whoever is drawing it are four steps a caller
 * should not have to get in the right order, and `readRecents` / `saveRecents`
 * already swallow a storage that refuses, so this cannot throw into a write that
 * has already committed.
 */
export function forgetRemovedMobileInSession(removed: string | null | undefined): void {
  const next = forgetRemovedMobile(readRecents(), removed)
  saveRecents(next)
  // 🚩 The store first, the screen second — a listener that threw would
  // otherwise leave the number in `sessionStorage`, which is the copy that
  // outlives this render.
  for (const listener of listeners) listener(next)
}

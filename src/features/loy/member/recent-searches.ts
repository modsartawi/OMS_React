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

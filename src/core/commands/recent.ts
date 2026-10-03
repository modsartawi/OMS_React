/**
 * The palette's **Recent** group (ticket 394, spec 380 K9 + D11; ruling 364 §1–§2) — the
 * last five deliveries and documents opened through Delivery details, newest first.
 *
 * 🚩 **The number only, and in `localStorage` keyed by user id.** A delivery or document
 * number is an identifier, not a customer: nothing here ever holds the customer, the
 * mobile that found it or an OTP. That is why this survives the tab, where 239's member
 * keys (a loyalty key is a customer's mobile) live in `sessionStorage` and die with it.
 *
 * 🚩 **Anything unreadable is an empty list, never a throw.** The store is a value a
 * human can edit in devtools and an older build may have written in another shape, and
 * it is read while the palette renders: a throw here would take the palette down over a
 * convenience.
 *
 * The list logic is pure (`pushRecent`, `parseRecent`) and the storage is a parameter
 * (`readRecent`, `recordRecentIn`), so vitest's node environment carries the suite; the
 * two thin edges (`recordRecent`, `loadRecent`) reach `window.localStorage` and the session.
 *
 * Which records the palette may SHOW is not decided here: `layout/` re-filters them by
 * the current grants on every open (K12).
 */
import { useSession } from '@/core/session'

/** What was opened — the route it reopens on (`/oms/delivery/:no`, `/oms/document/:no`). */
export type RecentKind = 'delivery' | 'document'

/** One remembered record: its kind and its number, and nothing else. */
export interface RecentRecord {
  kind: RecentKind
  no: string
}

/** K9: the last five. */
export const RECENT_LIMIT = 5

/** The store's key for one user. Versioned, so a future shape can start clean. */
export const recentStorageKey = (userId: string) => `oms.palette.recent.v1:${userId}`

/**
 * A number as the routes take it: one path segment of letters and digits. A value of
 * any other shape is not a record this store wrote, so it is dropped rather than turned
 * into a link.
 */
const NUMBER = /^[0-9A-Za-z]{1,32}$/

const isKind = (value: unknown): value is RecentKind => value === 'delivery' || value === 'document'

/** A record rebuilt from its two fields only — whatever else came along is not kept. */
function recordOf(value: unknown): RecentRecord | null {
  if (typeof value !== 'object' || value === null) return null
  const { kind, no } = value as { kind?: unknown; no?: unknown }
  if (!isKind(kind) || typeof no !== 'string' || !NUMBER.test(no)) return null
  return { kind, no }
}

const same = (a: RecentRecord, b: RecentRecord) => a.kind === b.kind && a.no === b.no

/**
 * The list after opening `record` — newest first, capped at five. A record already on
 * the list **moves to the front** rather than appearing twice. A malformed record leaves
 * the list as it was.
 */
export function pushRecent(list: readonly RecentRecord[], record: RecentRecord): RecentRecord[] {
  const next = recordOf(record)
  if (next === null) return [...list]
  return [next, ...list.filter((entry) => !same(entry, next))].slice(0, RECENT_LIMIT)
}

/** The stored list, read defensively: a malformed or foreign value is an empty list. */
export function parseRecent(raw: string | null | undefined): RecentRecord[] {
  if (!raw) return []
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return []
  }
  if (!Array.isArray(parsed)) return []
  const list: RecentRecord[] = []
  for (const value of parsed) {
    const record = recordOf(value)
    if (record !== null && !list.some((entry) => same(entry, record))) list.push(record)
  }
  return list.slice(0, RECENT_LIMIT)
}

/** The two calls of `Storage` this module makes — a parameter, so the suite runs in node. */
export interface RecentStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

/**
 * One user's list. No user, no list: a session that has not loaded never reads another
 * user's records. A storage that throws on access (a locked-down profile, some private
 * modes) is an empty list too.
 */
export function readRecent(storage: RecentStorage, userId: string | null | undefined): RecentRecord[] {
  if (!userId) return []
  try {
    return parseRecent(storage.getItem(recentStorageKey(userId)))
  } catch {
    return []
  }
}

/** Records `record` at the front of one user's list. A storage that refuses is swallowed. */
export function recordRecentIn(storage: RecentStorage, userId: string | null | undefined, record: RecentRecord): void {
  if (!userId) return
  const next = pushRecent(readRecent(storage, userId), record)
  try {
    storage.setItem(recentStorageKey(userId), JSON.stringify(next))
  } catch {
    /* a list that cannot be saved is a list that does not grow */
  }
}

/** The browser's `localStorage`, or `null` where touching it throws. */
function browserStorage(): RecentStorage | null {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

/**
 * D11: Delivery details records what it opened, once its header has loaded — so a
 * record that is not found or is denied is never recorded. Keyed by the signed-in user.
 */
export function recordRecent(record: RecentRecord): void {
  const storage = browserStorage()
  if (storage) recordRecentIn(storage, useSession.getState().userId, record)
}

/** The signed-in user's list, newest first. */
export function loadRecent(userId: string | null | undefined): RecentRecord[] {
  const storage = browserStorage()
  return storage ? readRecent(storage, userId) : []
}

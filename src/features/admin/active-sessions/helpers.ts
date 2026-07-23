// Pure, framework-free helpers for the Active Sessions screen: the GET Sessions
// query-shaping, the per-channel dormancy rule, last-seen relative-time
// formatting, and the single-distinct-user derivation that gates the revoke-all
// bar. i18n text lives in the active-sessions namespace; these return keys/params
// so the component owns the wording (zero-literal rule). All are the highest,
// cheapest test seam (spec 006 Testing Decisions).

import type { ActiveSessionRow } from '@/core/models/session-monitor'

/** Reads are capped at 50 server-side; the screen shows the first page and the
 *  "refine to narrow" cap note rather than offset-paging. */
const PAGE = { skip: 0, take: 50 }

/**
 * The active filter chip above the grid (ticket 009). `all` is the whole live
 * estate; `web`/`mobile`/`backoffice` narrow to one channel; `idle` surfaces
 * sessions with no recent heartbeat (per-channel rule, spec 006). The chip
 * composes with the search term — e.g. Web + "john".
 */
export type SessionChip = 'all' | 'web' | 'mobile' | 'backoffice' | 'pos' | 'idle'

/**
 * Shape the GET Sessions params from the search term and the active chip. A
 * blank/whitespace term is dropped so a term-less query lists all live sessions
 * (server still caps at 50). The chip maps to the endpoint's `channel` param
 * (`web`/`mobile`/`backoffice`) or `idleOnly` (the Idle chip); `all` adds neither.
 * Paging is fixed. `core/api.buildQuery` drops blanks at the wire too, but shaping
 * here is the pure, assertable seam (and it trims, which buildQuery does not).
 */
export function buildSessionsQuery(term: string, chip: SessionChip = 'all'): Record<string, unknown> {
  const params: Record<string, unknown> = { ...PAGE }
  const trimmed = term.trim()
  if (trimmed) params.term = trimmed
  if (chip === 'idle') params.idleOnly = true
  else if (chip !== 'all') params.channel = chip
  return params
}

// Per-channel "idle" windows (spec 006 idle rule): web dormant after 45m, mobile
// after 8h; POS and BackOffice never count as idle (their idle expiry is disabled,
// issue 370) so they have no entry here. The server owns the idleOnly filter + the
// chip count (ticket 009); this same rule drives the client-side last-seen mark.
const IDLE_THRESHOLD_MINUTES: Record<string, number> = {
  web: 45,
  mobile: 8 * 60,
}

/**
 * Whether a session's last-seen heartbeat is older than its channel's idle window
 * — used to visually mark a dormant row's "last seen". Channels with no window
 * (pos / backoffice / unknown) are never dormant. `now` is injected so the rule
 * stays pure and testable.
 */
export function isDormant(channel: string, lastSeenTime: string, now: Date): boolean {
  const threshold = IDLE_THRESHOLD_MINUTES[channel]
  if (!threshold) return false
  const last = new Date(lastSeenTime).getTime()
  if (Number.isNaN(last)) return false
  const elapsedMinutes = (now.getTime() - last) / 60_000
  return elapsedMinutes > threshold
}

/** A relative-time result: an i18n key under `relative.*` + its `count` param. */
export interface RelativeTime {
  key: 'justNow' | 'minutes' | 'hours' | 'days'
  count: number
}

/**
 * Bucket an elapsed duration into a relative-time key + count (`{{count}}m ago`,
 * etc.). Returns a key/param pair rather than a string so the wording stays in the
 * translation layer (zero-literal). `now` is injected to keep it pure. A blank or
 * future stamp reads as "just now".
 */
export function relativeTime(iso: string, now: Date): RelativeTime {
  const then = new Date(iso).getTime()
  if (Number.isNaN(then)) return { key: 'justNow', count: 0 }
  const minutes = Math.floor(Math.max(0, now.getTime() - then) / 60_000)
  if (minutes < 1) return { key: 'justNow', count: 0 }
  if (minutes < 60) return { key: 'minutes', count: minutes }
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return { key: 'hours', count: hours }
  return { key: 'days', count: Math.floor(hours / 24) }
}

/** The one person a result set resolves to, plus how many of their devices it
 *  holds — what the revoke-all context bar names (ticket 011). */
export interface SingleUser {
  userId: string
  displayName: string
  count: number
}

/**
 * Derive the single distinct user a result set resolves to, or `null` when it is
 * empty or holds more than one `userId`. This gates the "Revoke all for this user"
 * context bar: it appears only when every visible row belongs to one person, so a
 * mixed result never offers the estate-wide hammer. `count` is the number of that
 * person's rows in the current view (the blast radius the confirm states). Pure
 * over the rows — the highest, cheapest seam (spec 006 Testing Decisions).
 */
export function singleDistinctUser(rows: ActiveSessionRow[]): SingleUser | null {
  if (rows.length === 0) return null
  const first = rows[0]
  for (const r of rows) {
    if (r.userId !== first.userId) return null
  }
  return { userId: first.userId, displayName: first.displayName, count: rows.length }
}

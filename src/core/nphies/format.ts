/**
 * How the Nphies area renders a server timestamp — once, for both lists, the
 * response detail and the Refresh readout (tickets 212 · 213 · 214).
 *
 * It lives in `core/` for the same reason the two status axes do: the
 * *authorizations* feature (214) shows the same `ActionDateTime` the eligibility
 * list does, and a feature may never import another feature
 * (`.claude/rules/feature-structure.md`). Two copies would let the two lists
 * disagree about the same instant the moment either was touched.
 *
 * Pure: no React, no i18n, no `@/core/api`.
 */

/** `2026-08-01T10:04:37` → `2026-08-01 10:04`.
 *
 *  Blank stays blank rather than becoming an epoch date, and an unparseable value
 *  is passed through as it arrived — a server string nobody can read is still
 *  more honest than `1970-01-01 03:00`. Local calendar, deliberately: an agent in
 *  Riyadh reads their own clock, not UTC. */
export function formatStamp(raw: string | null | undefined): string {
  const value = (raw ?? '').trim()
  if (value === '') return ''
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(parsed.getDate())} ${pad(parsed.getHours())}:${pad(parsed.getMinutes())}`
}

/**
 * One money field, as the server sent it, to two decimals (ticket 216).
 *
 * 🚩 **This formats, it never computes.** Law 1: amounts are one-way — engine →
 * client, display only. Nothing in the Nphies area sums, totals or derives a
 * figure, and this function takes exactly one server field at a time so that
 * staying true is the path of least resistance.
 *
 * A missing amount renders blank rather than as `0.00`: a line the payer said
 * nothing about and a line the payer allowed nothing on are different facts.
 */
export function formatAmount(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return ''
  return value.toFixed(2)
}

/**
 * The **clock time** of a read, for the load-time readout beside a Refresh
 * button (spec 209 story 76, contract §3.6).
 *
 * Only the time of day: the readout answers *"how stale is what I am looking
 * at"*, and a date on a value that is minutes old is noise. `0` — TanStack
 * Query's "never fetched" — renders blank rather than as the epoch.
 */
export function formatClock(epochMs: number): string {
  if (!epochMs) return ''
  const at = new Date(epochMs)
  if (Number.isNaN(at.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(at.getHours())}:${pad(at.getMinutes())}:${pad(at.getSeconds())}`
}

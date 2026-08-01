/**
 * How this feature renders a server timestamp — once, for the list column and
 * the response detail (tickets 212 + 213).
 *
 * Pure and tiny, but shared on purpose: the two screens show the same field
 * (`ActionDateTime`) and a second copy would let them disagree about the same
 * check's time the moment either was touched.
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

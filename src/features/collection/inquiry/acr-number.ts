/**
 * Which ACR number to show (ADR 0066, spec 2423, ticket 425) — read by the grid and
 * a deposit's lines. (The form header applies the same "absent or blank → the older
 * field" rule through its own cell `fallback`, over the form's string fields.)
 *
 * 🔑 **The server formats the number; the client never does.** A new ACR's `acrNo`
 * reads `<collector id>-YYMM-NNNN` (`6498-2610-0001`) and a legacy one's is its plain
 * number. It is shown exactly as sent: never built from the collector and the month,
 * never parsed, never re-sorted. Rows arrive in the server's order (month newest
 * first, legacy last), and a client comparator over `6498-2610-0001` and `1834` —
 * as strings or as numbers — would scramble it.
 *
 * The fallback is for a SIS.Api from before BackOffice 2427/2428/2429, which sends
 * no `acrNo`: the old plain number is then the whole truth, so it is shown instead.
 * A blank `acrNo` is treated as absent, so a row never reads empty where the old
 * number would have printed.
 *
 * Pure — no React, no i18n.
 */
export function shownAcrNo(acrNo: string | null | undefined, fallback: string): string {
  return typeof acrNo === 'string' && acrNo.trim() !== '' ? acrNo : fallback
}

/** The grid's and a deposit line's reading: `acrNo`, else the bare `acrNumber`. */
export function acrNoText(
  item: { acrNo?: string | null; acrNumber?: number | null } | undefined,
): string {
  if (!item) return ''
  return shownAcrNo(item.acrNo, typeof item.acrNumber === 'number' ? String(item.acrNumber) : '')
}

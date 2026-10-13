/**
 * How a statistics figure reads on screen (ticket 484). Pure, pinned by `figures.test.ts`.
 *
 * 🚩 **A figure the server does not send is not a zero.** An older SIS.Api without `trips`, or a
 * period where nothing was handed over (a `null` average), reads as the dash the caller passes in
 * (the locale's), and only a real 0 reads as 0. The page shows what the door sends and derives
 * nothing: no figure here is computed from another.
 *
 * Counts read in Western digits with their thousands grouped, the way the rest of the app writes
 * numbers; the caller isolates the whole value (`Ltr`).
 */

const COUNT = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 })
// The till rounds the average to two decimals (`OmsStatisticsDashboard`); the web keeps the same.
const AVERAGE = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 })

/** Whether the server sent a figure the page can show — the one test both readers use. */
export const hasFigure = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)

/** A count, or `dash` when the server did not send it. */
export function readFigure(value: number | null | undefined, dash: string): string {
  return hasFigure(value) ? COUNT.format(value) : dash
}

/** An average in minutes, or `dash` when it is `null` (nothing handed over) or absent. */
export function readAverage(value: number | null | undefined, dash: string): string {
  return hasFigure(value) ? AVERAGE.format(value) : dash
}

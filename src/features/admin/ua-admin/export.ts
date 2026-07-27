// The export's two impure halves (ticket 150): walking the current query's FULL
// match set, and handing the finished string to the browser. The writer itself is
// pure and lives in `csv.ts`.
//
// The walk is the pager's own call in a loop — zero new contract surface (ticket
// 144). It deliberately calls `uaAdminApi` directly rather than through the query
// client: exporting must not write to the mounted query's cache, because that
// would make a download a navigation event (spec 147, story 30).
//
// The governing rule, and it is the reason this returns rows rather than writing
// as it goes: **any failure ⇒ no file at all.** A partial CSV is indistinguishable
// from a complete one once it is in Excel, and this file's whole use is spotting
// who is *missing*. The `ApiError` propagates to the caller; nothing is written.

import type { UaEmployeeGridRow, UaEmployeeSearchResult } from '@/core/models/ua-user'
import { pageCountFromTotalMatches } from './pager'

/**
 * A hard stop on the loop. 120 pages is the whole ~6,000-identity estate, so 200
 * can only be reached by a server that keeps saying "more exist" — a runaway, not
 * a big export. It THROWS rather than returning what it has: the export must
 * never silently stop early (spec 147, story 29), and a truncated file is the one
 * outcome this design refuses.
 */
const MAX_PAGES = 200

/**
 * Where a click stops feeling like it worked (ticket 151). Above this many
 * matches the screen asks first, naming the row count and the rough wait, and
 * shows cancellable progress while it walks; at or below, the file just arrives.
 *
 * This is a WAIT-TIME device — it exists so a 45-second walk is something the
 * user chose rather than something that happened to them. It is dismissible and
 * absent on every narrowed card, so it governs nothing (ticket 146).
 */
export const EXPORT_CONFIRM_THRESHOLD = 500

/**
 * Does this export ask first? A predicate rather than a comparison at the call
 * site, so "which exports are long" is one testable fact instead of a `>` the
 * screen could get wrong — including the case where the screen has no count yet.
 */
export function needsConfirm(totalMatches: number): boolean {
  return totalMatches > EXPORT_CONFIRM_THRESHOLD
}

/**
 * Roughly what one 50-row page costs end to end. Calibrated off the shape the
 * spec states: the whole ~6,000-identity estate is 120 pages and takes about 45
 * seconds.
 */
const SECONDS_PER_PAGE = 0.375

/**
 * The "about N seconds" the confirm quotes. Rounded to 5 so it reads as the
 * estimate it is — "about 45 seconds", never "about 47".
 */
export function estimateWalkSeconds(totalMatches: number): number {
  const seconds = pageCountFromTotalMatches(totalMatches) * SECONDS_PER_PAGE
  return Math.max(5, Math.round(seconds / 5) * 5)
}

/**
 * A walk the user stopped. Distinct from an `ApiError` because the outcomes
 * differ — a cancellation says so quietly, a failure says what broke — but the
 * consequence is identical and is the point of throwing at all: **no rows come
 * back, so no file can be written.**
 */
export class ExportCancelledError extends Error {
  constructor() {
    super('ua-users export cancelled')
    this.name = 'ExportCancelledError'
  }
}

/**
 * The runaway guard firing. Its own type because it is the one failure with no
 * server message to show: `apiErrorMessage` would fall back to "unexpected", and
 * "the walk never ended" is a different thing for an administrator to hear than
 * "the server refused".
 */
export class ExportRunawayError extends Error {
  constructor(readonly pages: number) {
    super(`ua-users export walk exceeded ${pages} pages`)
    this.name = 'ExportRunawayError'
  }
}

/** What the walk tells the caller while it runs, and how it is stopped. */
export interface WalkOptions {
  /** Polled before and after every page — a cancel lands within one round trip. */
  isCancelled?: () => boolean
  /** Fired after each page, for the progress toast. */
  onProgress?: (progress: { collected: number; totalMatches: number }) => void
}

/**
 * Every row the query matches, walked from page 1 in the pager's own 50-row
 * steps and terminated by `isCapped` going false ("no row exists past this
 * page"). Takes the page fetcher as a parameter so it can be driven in-memory.
 *
 * Rows are deduped by `employeeId`: a 45-second walk can be overtaken by a
 * concurrent SAP insert, which slides everyone one place down and would
 * otherwise write the person on a page boundary twice (ticket 151).
 *
 * Cancellation and failure both **throw** rather than returning what is in hand.
 * That is the no-partial-file rule expressed where it can be tested — at the
 * walk's edge — instead of trusted to every future call site.
 */
export async function collectAllRows(
  fetchPage: (page: number) => Promise<UaEmployeeSearchResult>,
  options: WalkOptions = {},
): Promise<UaEmployeeGridRow[]> {
  const collected: UaEmployeeGridRow[] = []
  const seen = new Set<string>()
  for (let page = 1; page <= MAX_PAGES; page++) {
    if (options.isCancelled?.()) throw new ExportCancelledError()
    const result = await fetchPage(page)
    // Checked again on the way out: the page in flight when Cancel was clicked
    // must not be able to complete the walk.
    if (options.isCancelled?.()) throw new ExportCancelledError()
    for (const row of result.rows) {
      if (seen.has(row.employeeId)) continue
      seen.add(row.employeeId)
      collected.push(row)
    }
    options.onProgress?.({ collected: collected.length, totalMatches: result.totalMatches })
    if (!result.isCapped) return collected
  }
  throw new ExportRunawayError(MAX_PAGES)
}

/**
 * Hand a finished CSV string to the browser as a download. Kept out of `csv.ts`
 * so the writer stays testable without a DOM. The anchor is parked in the
 * document and the object URL released a tick after the click — a synchronous
 * revoke is fine in Chrome but can abort the download elsewhere.
 */
export function downloadCsv(fileName: string, contents: string): void {
  const url = URL.createObjectURL(new Blob([contents], { type: 'text/csv;charset=utf-8' }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  anchor.style.display = 'none'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

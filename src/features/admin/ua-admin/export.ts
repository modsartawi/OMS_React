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

/**
 * A hard stop on the loop. 120 pages is the whole ~6,000-identity estate, so 200
 * can only be reached by a server that keeps saying "more exist" — a runaway, not
 * a big export. It THROWS rather than returning what it has: the export must
 * never silently stop early (spec 147, story 29), and a truncated file is the one
 * outcome this design refuses. Ticket 151 gives it a proper message alongside the
 * cancellable progress.
 */
const MAX_PAGES = 200

/**
 * Every row the query matches, walked from page 1 in the pager's own 50-row
 * steps and terminated by `isCapped` going false ("no row exists past this
 * page"). Takes the page fetcher as a parameter so it can be driven in-memory.
 */
export async function collectAllRows(
  fetchPage: (page: number) => Promise<UaEmployeeSearchResult>,
): Promise<UaEmployeeGridRow[]> {
  const collected: UaEmployeeGridRow[] = []
  for (let page = 1; page <= MAX_PAGES; page++) {
    const result = await fetchPage(page)
    collected.push(...result.rows)
    if (!result.isCapped) return collected
  }
  throw new Error(`ua-users export walk exceeded ${MAX_PAGES} pages`)
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

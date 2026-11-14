/**
 * The Bupa line outcomes doors (oms 899, BackOffice 3889–3891). Both are cookie-only and behind
 * `BupaLineOutcomes.View`; both take the SAME query (`outcomeParams`), so the export holds exactly the rows the screen
 * shows. The probe lives in `./access`.
 *
 * Through `@/core/api` (`api-envelope`): the envelope, the error taxonomy and 401 are its. The file is the server's
 * `.xlsx` through `api.blob` — never built in the browser.
 *
 * 🚩 Counts are passed through as sent; only a missing list is read as empty, so a bare answer draws an empty grid.
 */
import { api, type FileResponse } from '@/core/api'
import type { BupaOutcomeQuery, BupaOutcomeReport } from '@/core/models/bupa-line-outcome'

/** The query string both doors read. `buildQuery` drops a blank store or kind. */
export function outcomeParams(query: BupaOutcomeQuery): Record<string, string> {
  return { from: query.from, to: query.to, store: query.store ?? '', kind: query.kind ?? '' }
}

export const bupaOutcomeApi = {
  /** `GET BupaLineOutcomes/report` → the summary, the detail lines with their acts, and the totals. */
  async report(query: BupaOutcomeQuery): Promise<BupaOutcomeReport> {
    const data = await api.get<Partial<BupaOutcomeReport> | null>('BupaLineOutcomes/report', outcomeParams(query))
    return {
      from: data?.from ?? query.from,
      to: data?.to ?? query.to,
      summary: data?.summary ?? [],
      details: (data?.details ?? []).map((d) => ({ ...d, acts: d.acts ?? [] })),
      totals: { orders: 0, lines: 0, linesQtyDiffers: 0, ...(data?.totals ?? {}) },
    }
  },

  /** `GET BupaLineOutcomes/report/export` → the two-sheet `.xlsx` (Summary, Detail) for the same query. */
  export(query: BupaOutcomeQuery): Promise<FileResponse> {
    return api.blob('BupaLineOutcomes/report/export', outcomeParams(query))
  },
}

/** The file name when the server sends none — the door's own spelling (3891). */
export const exportFileName = (query: BupaOutcomeQuery): string => `bupa-line-outcomes_${query.from}_${query.to}.xlsx`

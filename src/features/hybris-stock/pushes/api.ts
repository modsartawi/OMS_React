import { api } from '@/core/api'
import type { HybrisStockMaterialSent, HybrisStockPushLinesPage, HybrisStockPushRow, HybrisStockPushesQuery } from '@/core/models/hybris-stock'
import { LINES_PAGE_SIZE, pushesDoorParams, type LinesQuery } from './pushes-query'

// The Hybris stock push log doors (BackOffice 3455), as the door contract writes them — see
// `@/core/models/hybris-stock`.
// View grant. Every call goes through @/core/api (see .claude/rules/api-envelope.md).

export { HYBRIS_STOCK_PUSHES_KEY as PUSHES_KEY } from '@/core/hybris-stock/api'

export type { LinesQuery }

export const pushesApi = {
  /** GET HybrisStockWeb/Pushes?store=&type=&status=&from=&to=&take= — the newest `take`, newest first.
   *  The door takes no `skip` and answers a bare array (no total). */
  async list(query: HybrisStockPushesQuery): Promise<HybrisStockPushRow[]> {
    return (await api.get<HybrisStockPushRow[] | null>('HybrisStockWeb/Pushes', pushesDoorParams(query))) ?? []
  },

  /** GET HybrisStockWeb/Pushes/{pushId}/Lines?store=&material=&skip=&take= — HYS-00020 for no such push;
   *  past the retention `linesKept: false` with no lines. */
  async lines(pushId: string, q: LinesQuery): Promise<HybrisStockPushLinesPage> {
    const page = await api.get<HybrisStockPushLinesPage | null>(`HybrisStockWeb/Pushes/${encodeURIComponent(pushId)}/Lines`, {
      store: q.store,
      material: q.material,
      skip: (q.page - 1) * LINES_PAGE_SIZE,
      take: LINES_PAGE_SIZE,
    })
    return { pushId, linesKept: page?.linesKept !== false, total: page?.total ?? 0, lines: page?.lines ?? [] }
  },

  /** GET HybrisStockWeb/Stores/{storeCode}/Materials/{materialNumber}/History — every quantity sent, newest first. */
  async materialHistory(storeCode: string, materialNumber: string): Promise<HybrisStockMaterialSent[]> {
    return (
      (await api.get<HybrisStockMaterialSent[] | null>(
        `HybrisStockWeb/Stores/${encodeURIComponent(storeCode)}/Materials/${encodeURIComponent(materialNumber)}/History`,
      )) ?? []
    )
  },
}

export const linesKey = (pushId: string, q: LinesQuery) => ['hybris-stock', 'pushLines', pushId, q] as const
export const materialHistoryKey = (storeCode: string, materialNumber: string) => ['hybris-stock', 'materialHistory', storeCode, materialNumber] as const

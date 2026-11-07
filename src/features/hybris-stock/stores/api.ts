import { api } from '@/core/api'
import type {
  HybrisStockPushMaterialsBody,
  HybrisStockPushRow,
  HybrisStockReasonBody,
  HybrisStockStoreChange,
  HybrisStockStoreRow,
  HybrisStockStoresQuery,
} from '@/core/models/hybris-stock'

// The Hybris stock stores doors (BackOffice 3453; push now 3456). 🚩 Guessed routes — see
// `@/core/models/hybris-stock`. The area's shared reads (access, status) live in `@/core/hybris-stock/api`.
//
// Every call goes through @/core/api (see .claude/rules/api-envelope.md).

/** Every store-list query, whatever its filters — a write refreshes them all. */
export const STORES_KEY = ['hybris-stock', 'stores'] as const

export const storePath = (storeCode: string) => `HybrisStockWeb/Stores/${encodeURIComponent(storeCode)}`

export const storesApi = {
  /** GET HybrisStockWeb/Stores?marked=&q= — every store with its flag; `any` is left off. */
  async list(query: HybrisStockStoresQuery): Promise<HybrisStockStoreRow[]> {
    return (
      (await api.get<HybrisStockStoreRow[] | null>('HybrisStockWeb/Stores', {
        marked: query.marked === 'any' ? null : query.marked,
        q: query.q,
      })) ?? []
    )
  },

  /**
   * POST HybrisStockWeb/Stores/{storeCode}/Mark `{ reason }` — the store becomes a Hybris stock
   * store and its first push is a full (full requested). Returns the row.
   * Refusals: HYS-00001 (reason), 00002 (no such store), 00003 (already marked).
   */
  mark(storeCode: string, body: HybrisStockReasonBody): Promise<HybrisStockStoreRow> {
    return api.post<HybrisStockStoreRow>(`${storePath(storeCode)}/Mark`, body)
  },

  /**
   * POST HybrisStockWeb/Stores/{storeCode}/Unmark `{ reason }` — pushes stop; nothing is sent to
   * Hybris, which keeps what it was last sent. Returns the row. Refusals: HYS-00001, 00002, 00003.
   */
  unmark(storeCode: string, body: HybrisStockReasonBody): Promise<HybrisStockStoreRow> {
    return api.post<HybrisStockStoreRow>(`${storePath(storeCode)}/Unmark`, body)
  },

  /** GET HybrisStockWeb/Stores/{storeCode}/History — every mark and unmark, newest first. */
  async history(storeCode: string): Promise<HybrisStockStoreChange[]> {
    return (await api.get<HybrisStockStoreChange[] | null>(`${storePath(storeCode)}/History`)) ?? []
  },

  /**
   * POST HybrisStockWeb/Stores/{storeCode}/PushNow `{ reason }` — a full of the store now (type `S`),
   * counting as its full (ticket 850). Returns the push row.
   * Refusals: HYS-00001, 00009 (not marked), 00010 (rail off), 502 HYS-00011 (recorded as failed),
   * 409 HybrisStockPushBusy (nothing recorded).
   */
  pushStore(storeCode: string, body: HybrisStockReasonBody): Promise<HybrisStockPushRow> {
    return api.post<HybrisStockPushRow>(`${storePath(storeCode)}/PushNow`, body)
  },

  /**
   * POST HybrisStockWeb/Pushes/Materials `{ storeCodes, materialNumbers, reason }` — current ATP of
   * chosen materials across chosen stores (type `M`, no anchor moves; ticket 850). Returns the push.
   * Refusals: as `pushStore`, plus HYS-00004 (an unknown material).
   */
  pushMaterials(body: HybrisStockPushMaterialsBody): Promise<HybrisStockPushRow> {
    return api.post<HybrisStockPushRow>('HybrisStockWeb/Pushes/Materials', body)
  },
}

/** One store's mark / unmark history. */
export const historyKey = (storeCode: string) => ['hybris-stock', 'storeHistory', storeCode] as const

/** The mutation key of one store's push now — the row's action reads it to show the push running. */
export const pushStoreKey = (storeCode: string) => ['hybris-stock', 'pushStore', storeCode] as const

export const PUSH_MATERIALS_KEY = ['hybris-stock', 'pushMaterials'] as const

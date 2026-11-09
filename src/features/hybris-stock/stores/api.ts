import { api } from '@/core/api'
import type {
  HybrisStockPushMaterialsBody,
  HybrisStockPushNowResult,
  HybrisStockReasonBody,
  HybrisStockStoreChange,
  HybrisStockStoreRow,
  HybrisStockStoresQuery,
} from '@/core/models/hybris-stock'
import { storesDoorParams } from './stores-query'

// The Hybris stock stores doors (BackOffice 3453; push now 3456), as the door contract writes them —
// see `@/core/models/hybris-stock`. The area's shared reads (access, status) live in `@/core/hybris-stock/api`.
//
// Every call goes through @/core/api (see .claude/rules/api-envelope.md).

/** Every store-list query, whatever its filters — a write refreshes them all. */
export const STORES_KEY = ['hybris-stock', 'stores'] as const

export const storePath = (storeCode: string) => `HybrisStockWeb/Stores/${encodeURIComponent(storeCode)}`

export const storesApi = {
  /** GET HybrisStockWeb/Stores?flag=&health=&q= — every open store, plus every marked one even closed; `any` left off. */
  async list(query: HybrisStockStoresQuery): Promise<HybrisStockStoreRow[]> {
    return (await api.get<HybrisStockStoreRow[] | null>('HybrisStockWeb/Stores', storesDoorParams(query))) ?? []
  },

  /**
   * POST HybrisStockWeb/Stores/{storeCode}/Mark `{ reason }` — the store becomes a Hybris stock
   * store and its first push is a full (full requested). Returns the row.
   * Refusals, in order: HYS-00001 (reason), 00002 (404 no such store), 00003 (closed), 00004 (409 already marked).
   */
  mark(storeCode: string, body: HybrisStockReasonBody): Promise<HybrisStockStoreRow> {
    return api.post<HybrisStockStoreRow>(`${storePath(storeCode)}/Mark`, body)
  },

  /**
   * POST HybrisStockWeb/Stores/{storeCode}/Unmark `{ reason }` — pushes stop; nothing is sent to
   * Hybris, which keeps what it was last sent. Returns the row (`health: null`). Refusals: HYS-00001, 00002, 00005 (409 not marked).
   */
  unmark(storeCode: string, body: HybrisStockReasonBody): Promise<HybrisStockStoreRow> {
    return api.post<HybrisStockStoreRow>(`${storePath(storeCode)}/Unmark`, body)
  },

  /** GET HybrisStockWeb/Stores/{storeCode}/History — every mark and unmark, newest first (the door's default take, 50). */
  async history(storeCode: string): Promise<HybrisStockStoreChange[]> {
    return (await api.get<HybrisStockStoreChange[] | null>(`${storePath(storeCode)}/History`)) ?? []
  },

  /**
   * POST HybrisStockWeb/Stores/{storeCode}/PushNow `{ reason }` — a full of the store now (type `S`),
   * counting as its full (ticket 850). Answers the push as recorded — a failed upload is a 200 with
   * `status: "E"`, not a refusal. Refusals, in order: HYS-00001, 00002 (404), 00034 (409 rail off),
   * 00031 (409 not marked), 00030 (409 busy; nothing recorded).
   */
  pushStore(storeCode: string, body: HybrisStockReasonBody): Promise<HybrisStockPushNowResult> {
    return api.post<HybrisStockPushNowResult>(`${storePath(storeCode)}/PushNow`, body)
  },

  /**
   * POST HybrisStockWeb/Pushes/MaterialsNow `{ storeCodes, materialNumbers, reason }` — current ATP of
   * chosen materials across chosen stores (type `M`, moves nothing on the stores; ticket 850). Answers the
   * push as `pushStore` does. Refusals, in order: HYS-00001, 00033 (selection), 00002 (404), 00034,
   * 00031, 00032 (a material not enabled), 00030.
   */
  pushMaterials(body: HybrisStockPushMaterialsBody): Promise<HybrisStockPushNowResult> {
    return api.post<HybrisStockPushNowResult>('HybrisStockWeb/Pushes/MaterialsNow', body)
  },
}

/** One store's mark / unmark history. */
export const historyKey = (storeCode: string) => ['hybris-stock', 'storeHistory', storeCode] as const

/** The mutation key of one store's push now — the row's action reads it to show the push running. */
export const pushStoreKey = (storeCode: string) => ['hybris-stock', 'pushStore', storeCode] as const

export const PUSH_MATERIALS_KEY = ['hybris-stock', 'pushMaterials'] as const

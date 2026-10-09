import { api, apiErrorCode } from '@/core/api'
import { MATERIAL_ERRORS, type MaterialStockRequest, type MaterialStockResult } from '@/core/models/materials'

// The stock door, shared by two features (spec 2544, ticket 453): the stock check asks it for a
// basket × a store choice, and the material detail's Stock tab (452) asks it for one material at
// every store. A feature may never import another (.claude/rules/feature-structure.md), so the
// call, the request builder and the MAT-00004 test live here, beside the 50-material cap; the
// "Stock Visibility unavailable" panel both screens show is `./StockUnavailable`.
//
// Every call goes through @/core/api (see .claude/rules/api-envelope.md).

/** What a screen has chosen, before it is a request. */
export interface StockInputs {
  /** Material numbers as typed — strings, leading zeros kept. */
  materials: readonly string[]
  /** `null` is "All stores": every store, filtered by `includeClosed`. */
  stores: readonly string[] | null
  includeZero: boolean
  includeClosed: boolean
}

/**
 * The exact `POST MaterialWeb/Stock` body (contract § Stock). Each material and store is trimmed
 * and sent once, in the order given; nothing is `Number()`-ed. `stores: null` stays `null` — it is
 * "every store", not "no store" — and the two toggles always travel, `false` included.
 */
export function stockRequest(inputs: StockInputs): MaterialStockRequest {
  const once = (values: readonly string[]) => [...new Set(values.map((v) => v.trim()).filter((v) => v !== ''))]
  return {
    materials: once(inputs.materials),
    stores: inputs.stores === null ? null : once(inputs.stores),
    includeZero: inputs.includeZero,
    includeClosed: inputs.includeClosed,
  }
}

/** True when the door said Stock Visibility is unavailable (`MAT-00004`, 502). 🚩 Such an answer is
 *  NEVER drawn as an empty grid: an outage must not read as "no stock" (spec 2544 story 32). */
export const isStockUnavailable = (err: unknown): boolean => apiErrorCode(err) === MATERIAL_ERRORS.stockUnavailable

export const materialStockApi = {
  /**
   * `POST MaterialWeb/Stock` → `{ cells, storesAsked, materialsAsked }`. Read-only: a POST only
   * because a 50-material basket does not fit a query string. A refusal (`MAT-00002`/`00003`/`00004`)
   * arrives as an `ApiError` — branch with `apiErrorCode`, show with `apiErrorMessage`.
   */
  async stock(request: MaterialStockRequest): Promise<MaterialStockResult> {
    const data = await api.post<MaterialStockResult | null>('MaterialWeb/Stock', request)
    return {
      cells: data?.cells ?? [],
      storesAsked: data?.storesAsked ?? 0,
      materialsAsked: data?.materialsAsked ?? 0,
    }
  },
}

/** The stock query's options: keyed on the whole request, never retried (a 502 is an answer the
 *  screen shows with its own "try again", not one to hammer), and refetched only when asked. */
export function materialStockQuery(request: MaterialStockRequest | null) {
  return {
    queryKey: ['materials', 'stock', request] as const,
    queryFn: () => materialStockApi.stock(request as MaterialStockRequest),
    enabled: request !== null,
    retry: false,
    staleTime: 0,
    refetchOnWindowFocus: false,
  } as const
}

/**
 * The stock check's own server calls (ticket 453, BackOffice spec 2544): the store-set shortcuts.
 * The stock door itself is shared with the material detail's Stock tab and lives in
 * `@/core/materials/stock`; the store list is the ungated, session-cached
 * `lookupQueries.storeDetails()` in `@/core/services/lookups`.
 *
 * Through `@/core/api` (`api-envelope`). Both doors are BackOffice 2548; their
 * contract is `C:\Work\DMSCO\BackOffice\.issues\assets\2544-material-web-door-contract.md`. The
 * stubbed drive pins the screen; `tools/materials-live-drive.mjs` meets the real doors (ticket 455).
 */
import { api } from '@/core/api'
import type { MaterialStoreSet, MaterialStoreSetKind, MaterialStoreSetStore } from '@/core/models/materials'

/** The four kinds of store set, in the contract's order. */
export const STORE_SET_KINDS: readonly MaterialStoreSetKind[] = ['area', 'city', 'district', 'supervisor']

export const stockCheckApi = {
  /** `GET MaterialWeb/StoreSets?kind=…` → `[{ value, label, storeCount }]`. */
  async storeSets(kind: MaterialStoreSetKind): Promise<MaterialStoreSet[]> {
    const data = await api.get<MaterialStoreSet[] | null>('MaterialWeb/StoreSets', { kind })
    return data ?? []
  },

  /**
   * `GET MaterialWeb/StoreSets/{kind}/{value}?includeClosed=…` → the set's stores. The value is a
   * path segment, so it is encoded; `includeClosed` always travels, `false` included.
   */
  async storeSetStores(kind: MaterialStoreSetKind, value: string, includeClosed: boolean): Promise<MaterialStoreSetStore[]> {
    const data = await api.get<MaterialStoreSetStore[] | null>(
      `MaterialWeb/StoreSets/${encodeURIComponent(kind)}/${encodeURIComponent(value)}`,
      { includeClosed },
    )
    return data ?? []
  },
}

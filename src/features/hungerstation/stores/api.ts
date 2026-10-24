import { api } from '@/core/api'
import type {
  HungerStationEditBody,
  HungerStationOnboardBody,
  HungerStationStoreRow,
  HungerStationStoresQuery,
} from '@/core/models/hungerstation'
import { removePath } from './remove'

// The HungerStation stores doors (BackOffice 3030; contract § Stores). The area's shared reads —
// the access probe and the chain list — live in `@/core/hungerstation/api`. 552 (remove), 553
// (pause / resume, sync now) and 554 (logs, lines, material history) add their doors here; every
// shape is already typed in `@/core/models/hungerstation`.
//
// Every call goes through @/core/api (see .claude/rules/api-envelope.md).

/** Every store-list query, whatever its filters — the page keys each list under it, and a write
 *  refreshes them all. */
export const STORES_KEY = ['hungerstation', 'stores'] as const

export const storePath = (storeCode: string) => `HungerStationWeb/Stores/${encodeURIComponent(storeCode)}`

export const storesApi = {
  /** GET HungerStationWeb/Stores?chain=&sync=&health=&q= — `any` is each filter's default and is left off. */
  async list(query: HungerStationStoresQuery): Promise<HungerStationStoreRow[]> {
    return (
      (await api.get<HungerStationStoreRow[] | null>('HungerStationWeb/Stores', {
        chain: query.chain,
        sync: query.sync === 'any' ? null : query.sync,
        health: query.health === 'any' ? null : query.health,
        q: query.q,
      })) ?? []
    )
  },

  /**
   * POST HungerStationWeb/Stores — onboard; a removed store is revived on the body's chain and
   * vendor id. Returns the store row.
   * Refusals: DHS-00001, 00002, 00003, 00004, 00005, 00006, 00008.
   */
  onboard(body: HungerStationOnboardBody): Promise<HungerStationStoreRow> {
    return api.post<HungerStationStoreRow>('HungerStationWeb/Stores', body)
  },

  /**
   * PUT HungerStationWeb/Stores/{storeCode} — edit the vendor id or chain. Returns the store row.
   * Refusals: DHS-00001, 00005, 00006, 00007, 00008.
   */
  edit(storeCode: string, body: HungerStationEditBody): Promise<HungerStationStoreRow> {
    return api.put<HungerStationStoreRow>(storePath(storeCode), body)
  },

  /**
   * DELETE HungerStationWeb/Stores/{storeCode}?reason= — remove onboarding (ticket 552). The reason
   * rides the query string (`removePath`). Answers `data: null`; a removed store is never listed.
   * Refusals: DHS-00007, 00008.
   */
  async remove(storeCode: string, reason: string): Promise<void> {
    await api.del<null>(removePath(storeCode, reason))
  },
}

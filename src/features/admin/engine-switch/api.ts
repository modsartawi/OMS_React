import { api } from '@/core/api'
import type { StoreEngineFlip, StoreEngineHistoryEntry, StoreEngineInFlight, StoreEngineRow } from '@/core/models/rule-campaign'

// The store engine switch's doors (ticket 517, BackOffice 2745, ADR 0093): ONE place for the family,
// so ticket 520 re-points this file. A reader without the (unseeded) Ua permission is refused by the
// server; the screen shows that refusal through `apiErrorMessage`.
// PROVISIONAL - shapes invented ahead of BackOffice 2745; re-point in ticket 520
const BASE = 'StorePromotionEngine'

export const engineSwitchApi = {
  /** GET StorePromotionEngine/Stores — every store with its engine and its last flip. */
  // PROVISIONAL - shapes invented ahead of BackOffice 2745; re-point in ticket 520
  stores(): Promise<StoreEngineRow[]> {
    return api.get<StoreEngineRow[]>(`${BASE}/Stores`)
  },

  /** GET StorePromotionEngine/InFlight?storeCode= — what a flip back to bonus buys would leave in
   *  flight at the store (live campaigns, open call-center sessions, store-scope budgets). */
  // PROVISIONAL - shapes invented ahead of BackOffice 2745; re-point in ticket 520
  inFlight(storeCode: string): Promise<StoreEngineInFlight> {
    return api.get<StoreEngineInFlight>(`${BASE}/InFlight`, { storeCode })
  },

  /** POST StorePromotionEngine/Flip — moves the store to the engine from its next shift open, with
   *  the reason; answers the store's row as HQ now holds it. */
  // PROVISIONAL - shapes invented ahead of BackOffice 2745; re-point in ticket 520
  flip(body: StoreEngineFlip): Promise<StoreEngineRow> {
    return api.post<StoreEngineRow>(`${BASE}/Flip`, body)
  },

  /** GET StorePromotionEngine/History?storeCode= — the store's flips, newest first. */
  // PROVISIONAL - shapes invented ahead of BackOffice 2745; re-point in ticket 520
  history(storeCode: string): Promise<StoreEngineHistoryEntry[]> {
    return api.get<StoreEngineHistoryEntry[]>(`${BASE}/History`, { storeCode })
  },
}

/** Every engine-switch query: a flip refreshes them all. */
export const ENGINE_SWITCH_KEY = ['engine-switch'] as const

export const storeEnginesQuery = () => ({
  queryKey: [...ENGINE_SWITCH_KEY, 'stores'] as const,
  queryFn: () => engineSwitchApi.stores(),
})

export const storeEngineHistoryQuery = (storeCode: string) => ({
  queryKey: [...ENGINE_SWITCH_KEY, 'history', storeCode] as const,
  queryFn: () => engineSwitchApi.history(storeCode),
})

/** Asked afresh each time the flip-back warning shows (what is in flight moves by the minute); a
 *  Back to it shows the answer already read while the new one comes. */
export const storeInFlightQuery = (storeCode: string) => ({
  queryKey: [...ENGINE_SWITCH_KEY, 'in-flight', storeCode] as const,
  queryFn: () => engineSwitchApi.inFlight(storeCode),
  staleTime: 0,
})

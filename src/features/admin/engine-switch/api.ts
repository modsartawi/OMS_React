import { keepPreviousData } from '@tanstack/react-query'
import { api } from '@/core/api'
import type { StoreEngineChange, StoreEngineFlip, StoreEngineHistory, StoreEngineLookupItem } from '@/core/models/rule-campaign'

// The store engine switch's doors (ticket 517, re-pointed in 528; BackOffice 2745, ADR 0093): ONE
// place for the family. Flip and History need the RuleEngineSwitch grant (02 / 03); a session
// without it is a BARE 403, which the screen names through `isBareDenial`.
const FLIP = 'Rules/Switch/Flip'
const HISTORY = 'Rules/Switch/History'
// No store list sits behind RuleEngineSwitch (BO ask C): the builder's stores lookup answers each
// open store with its engine in `detail`, behind the RuleAuthoring grant (ticket 528 records it).
const STORES = 'Rules/Authoring/Lookups/stores'

export const engineSwitchApi = {
  /** POST Rules/Authoring/Lookups/stores { q } — open stores by code (prefix) or name, at most 50,
   *  each with the engine HQ holds it on. */
  stores(q: string): Promise<StoreEngineLookupItem[]> {
    return api.post<StoreEngineLookupItem[]>(STORES, { q })
  },

  /** POST Rules/Switch/Flip { storeCode, engine, reason } — moves the store to the engine from its
   *  next shift open. A flip from Rule back to BonusBuy answers what is in flight; never blocked. */
  flip(body: StoreEngineFlip): Promise<StoreEngineChange> {
    return api.post<StoreEngineChange>(FLIP, body)
  },

  /** GET Rules/Switch/History?storeCode= — the store's engine now and its flips, newest first. */
  history(storeCode: string): Promise<StoreEngineHistory> {
    return api.get<StoreEngineHistory>(HISTORY, { storeCode })
  },
}

/** Every engine-switch query: a flip refreshes them all. */
export const ENGINE_SWITCH_KEY = ['engine-switch'] as const

export const storeEnginesQuery = (q: string) => ({
  queryKey: [...ENGINE_SWITCH_KEY, 'stores', q] as const,
  queryFn: () => engineSwitchApi.stores(q),
  // A new search keeps the last answer on screen until HQ answers it.
  placeholderData: keepPreviousData,
})

export const storeEngineHistoryQuery = (storeCode: string) => ({
  queryKey: [...ENGINE_SWITCH_KEY, 'history', storeCode] as const,
  queryFn: () => engineSwitchApi.history(storeCode),
})

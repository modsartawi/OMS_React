import { api } from '@/core/api'
import type { HungerStationAccessResult, HungerStationChains } from '@/core/models/hungerstation'

// The HungerStation area's shared reads (BackOffice spec 3028, ticket 551). They live in `@/core/`
// rather than with a feature because several features read each one, and a feature may never
// import another (.claude/rules/feature-structure.md):
//
// - the access probe — every HungerStation leaf and page (551–556): ONE key, ONE call, and a
//   per-leaf predicate per flag in `./access`;
// - `Chains` — the stores page's filter and its onboard / edit field (551), and the orders
//   monitor's chain filter (556).
//
// Every call goes through @/core/api (see .claude/rules/api-envelope.md).

/** The ONE cache key the menu leaves and every HungerStation page share. Exported rather than
 *  re-spelled: a typo in a literal would silently split the cache entry. */
export const HUNGERSTATION_ACCESS_KEY = ['hungerstation', 'access'] as const

export const HUNGERSTATION_CHAINS_KEY = ['hungerstation', 'chains'] as const

export const hungerStationApi = {
  /**
   * GET HungerStationWeb/Access → the three flags.
   *
   * ⚠️ **Fails closed, deliberately** — no 404/network-tolerant catch (the Deliverect precedent):
   * the door (BackOffice 3030) is not on staging yet, and a probe that degraded to *shown* while its
   * endpoint was missing would advertise screens nobody can hold the grant for. A rejected promise
   * leaves every HungerStation leaf hidden and each page on its denied card.
   */
  access(): Promise<HungerStationAccessResult> {
    return api.get<HungerStationAccessResult>('HungerStationWeb/Access')
  },

  /** GET HungerStationWeb/Chains — the configured chains. Behind `canManageStores`. */
  async chains(): Promise<HungerStationChains> {
    return (await api.get<HungerStationChains | null>('HungerStationWeb/Chains')) ?? []
  },
}

/**
 * The probe's query options, passed WHOLE by every page gate (react-query merges concurrent
 * observers' options, so one that dropped `retry: false` would retry a refusal). `staleTime:
 * Infinity` because a grant does not change inside a page life.
 */
export function hungerStationAccessQuery() {
  return {
    queryKey: HUNGERSTATION_ACCESS_KEY,
    queryFn: () => hungerStationApi.access(),
    staleTime: Infinity,
    retry: false,
  } as const
}

/** The chain list's query options. `retry: false`: a 403 is an answer, not an outage. */
export function hungerStationChainsQuery() {
  return {
    queryKey: HUNGERSTATION_CHAINS_KEY,
    queryFn: () => hungerStationApi.chains(),
    staleTime: 5 * 60_000,
    retry: false,
  } as const
}

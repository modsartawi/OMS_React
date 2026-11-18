import { api } from '@/core/api'
import type { HungerStationChains } from '@/core/models/hungerstation'

// The HungerStation area's shared reads (BackOffice spec 3028, ticket 551). They live in `@/core/`
// rather than with a feature because several features read each one, and a feature may never
// import another (.claude/rules/feature-structure.md):
//
// - `Chains` — the stores page's filter and its onboard / edit field (551), and the orders
//   monitor's chain filter (556).
//
// Every call goes through @/core/api (see .claude/rules/api-envelope.md).

export const HUNGERSTATION_CHAINS_KEY = ['hungerstation', 'chains'] as const

export const hungerStationApi = {
  /** GET HungerStationWeb/Chains — the configured chains. Behind `canManageStores`. */
  async chains(): Promise<HungerStationChains> {
    return (await api.get<HungerStationChains | null>('HungerStationWeb/Chains')) ?? []
  },
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

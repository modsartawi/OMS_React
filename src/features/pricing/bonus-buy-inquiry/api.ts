import { api } from '@/core/api'
import type { BbyListResult } from '@/core/models/bonus-buy-inquiry'

// Every server call goes through @/core/api (see .claude/rules/api-envelope.md): it
// unwraps the SIS.Api envelope, returns `.data`, and maps failures to ApiError. The
// inquiry read endpoints share the `Bby/*` prefix (contracts 057/058) — this module
// owns the one the SCREEN alone needs: the list search. Detail and GroupingMembers
// moved to `@/core/bonus-buy/api` with the modal they feed (ticket 112), and the ACCESS
// PROBE followed them there (ticket 118) once the Simulation screen became a second
// consumer — a feature may never import another feature. Its behaviour is unchanged by
// the move; `bonusBuyAccessApi.access` is the same call, read from the shared layer.
// All are DESIGNED contracts, built later on SIS.Api.
const BASE = 'Bby'

export const bonusBuyInquiryApi = {
  // The list/search. `params` comes from the pure `buildListParams` (list-params.ts);
  // buildQuery drops empty entries, so the client never pre-filters. Response carries
  // { rows (≤1000, CreatedAt desc), capReached }.
  list(params: Record<string, unknown>): Promise<BbyListResult> {
    return api.get<BbyListResult>(`${BASE}/List`, params)
  },
}

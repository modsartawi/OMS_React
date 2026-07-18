import { api } from '@/core/api'
import type { ActiveSessionSearchResult, SessionAccessResult } from '@/core/models/session-monitor'
import { buildSessionsQuery } from './helpers'

const BASE = 'UaAdminWeb'

export const sessionMonitorApi = {
  // Screen-open grant probe. Drives BOTH the in-page route-guard (the "no
  // access" card) AND the shell's permission-aware nav hiding — the shell's
  // probe shares this exact ['active-sessions','access'] cache entry, so it's
  // one call, not two. `Access` is cookie-gated, NOT grant-gated (it REPORTS the
  // BackOfficeScreen[UaSessions,03] grant); the server enforces the grant on
  // every other UaAdminWeb/Sessions* route via UaSessionsGrantEndpointFilter.
  access(): Promise<SessionAccessResult> {
    return api.get<SessionAccessResult>(`${BASE}/Sessions/Access`)
  },

  // Estate-wide live-session search. `term` matches userId / display name / store
  // code / IP; the server searches + caps at 50 and reports the true total, so a
  // broad query stays fast. Rows come back most-recently-seen first (the grid does
  // not re-sort). Query shaping lives in the pure `buildSessionsQuery` seam.
  search(term: string): Promise<ActiveSessionSearchResult> {
    return api.get<ActiveSessionSearchResult>(`${BASE}/Sessions`, buildSessionsQuery(term))
  },
}

import { api } from '@/core/api'
import type { SessionAccessResult } from '@/core/models/session-monitor'

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
}

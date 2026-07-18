import { api } from '@/core/api'
import type {
  ActiveSessionSearchResult,
  RevokeAllForUserResult,
  SessionAccessResult,
  SessionCountsResult,
} from '@/core/models/session-monitor'
import { buildSessionsQuery, type SessionChip } from './helpers'

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
  // broad query stays fast. The active `chip` narrows to one channel or to idle
  // sessions and composes with the term. Rows come back most-recently-seen first
  // (the grid does not re-sort). Query shaping lives in the pure
  // `buildSessionsQuery` seam.
  search(term: string, chip: SessionChip = 'all'): Promise<ActiveSessionSearchResult> {
    return api.get<ActiveSessionSearchResult>(`${BASE}/Sessions`, buildSessionsQuery(term, chip))
  },

  // The filter-chip counts — true estate-wide totals per channel plus idle,
  // independent of the 50-row page, server-computed like ua-admin's ReportCounts.
  // Drives the counts shown on the All / Web / Mobile / BackOffice chips.
  counts(): Promise<SessionCountsResult> {
    return api.get<SessionCountsResult>(`${BASE}/Sessions/Counts`)
  },

  // Sign one device out — the SAME existing door ua-admin's per-user revoke uses
  // (no new server route, ticket 010). Actor is the cookie UserId server-side; the
  // body carries only the sessionId. This is a SESSION action, not an account one:
  // the person stays enabled and can sign in again. Revoking an already-dead
  // session is a server-side no-op that still answers success (not an error).
  revoke(sessionId: string): Promise<unknown> {
    return api.post(`${BASE}/Sessions/Revoke`, { sessionId })
  },

  // Sign one person out of EVERY device and channel at once — the lost-phone /
  // leaver hammer (ticket 011). A NEW thin door over the domain's
  // `RevokeSessionsForUser`; the body carries only the userId, actor is the cookie
  // UserId server-side. Each killed device is audited individually (one
  // `ADMIN_SESSION_REVOKE` per session), and the server reports how many it ended
  // in `revokedCount`. Like the single revoke this is a SESSION action: the person
  // stays enabled and can sign in again.
  revokeAllForUser(userId: string): Promise<RevokeAllForUserResult> {
    return api.post<RevokeAllForUserResult>(`${BASE}/Sessions/RevokeAllForUser`, { userId })
  },
}

import { api } from '@/core/api'
import type {
  ActiveSessionSearchResult,
  RevokeAllForUserResult,
  SessionCountsResult,
} from '@/core/models/session-monitor'
import type { Permissions } from '@/core/permissions'
import { buildSessionsQuery, type SessionChip } from './helpers'

const BASE = 'UaAdminWeb'

/**
 * May open the active-sessions screen (`UaSessions:03`): the in-page guard and the shell's nav leaf read this one
 * predicate off the one permissions answer (oms 909). The server enforces the grant on every UaAdminWeb/Sessions* route
 * via UaSessionsGrantEndpointFilter.
 */
export const canOpenActiveSessions = (p: Permissions): boolean => p.has('UaSessions:03')

export const sessionMonitorApi = {

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

import { api } from '@/core/api'
import type {
  UaAuditHistoryResult,
  UaEmployeeInput,
  UaEmployeeSearchResult,
  UaEmployeeStatusResult,
  UaReportCountsResult,
  UaSessionModel,
} from '@/core/models/ua-user'
import type { RoleCatalogEntry } from '@/core/models/authz-admin'

import { skipForPage } from '@/core/ui/pager'
import type { Permissions } from '@/core/permissions'

import { PAGE_SIZE } from './page-size'

const BASE = 'UaAdminWeb'
// The two role doors bulk create needs live on the Authz surface. Called here,
// not imported from `authz-admin` — features never import features; the endpoint
// string is the only thing shared. Both are gated on the AuthzAdmin screen grant
// server-side, so an admin without it gets a coded refusal, not a silent skip.
const AUTHZ = 'AuthzAdminWeb'
const encode = (segment: string) => encodeURIComponent(segment)

// The people reads offset-page: both endpoints already bind `skip` and clamp
// only `take` (research 140), so paging cost zero server change (ticket 148).
const pageArgs = (page: number) => ({ skip: skipForPage(page, PAGE_SIZE), take: PAGE_SIZE })

// The per-person audit tab keeps its own single 50-row read — paging it was
// ruled out of scope (spec 147).
const FIRST_PAGE = pageArgs(1)

/**
 * May open the Ua users screen (`UaUsers:03`): the in-page guard and the shell's nav leaf read this one predicate off
 * the one permissions answer (oms 909). The server enforces the grant on every UaAdminWeb/* call regardless.
 */
export const canOpenUaAdmin = (p: Permissions): boolean => p.has('UaUsers:03')

export const uaAdminApi = {
  reportCounts(): Promise<UaReportCountsResult> {
    return api.get<UaReportCountsResult>(`${BASE}/ReportCounts`)
  },
  search(term: string, page = 1): Promise<UaEmployeeSearchResult> {
    return api.get<UaEmployeeSearchResult>(`${BASE}/Employees`, { term, ...pageArgs(page) })
  },
  worklist(card: string, page = 1): Promise<UaEmployeeSearchResult> {
    return api.get<UaEmployeeSearchResult>(`${BASE}/ReportCards/${encode(card)}`, pageArgs(page))
  },
  status(employeeId: string): Promise<UaEmployeeStatusResult> {
    return api.get<UaEmployeeStatusResult>(`${BASE}/Employees/${encode(employeeId)}`)
  },
  sessions(employeeId: string): Promise<UaSessionModel[]> {
    return api.get<UaSessionModel[]>(`${BASE}/Employees/${encode(employeeId)}/Sessions`)
  },
  audit(employeeId: string): Promise<UaAuditHistoryResult> {
    return api.get<UaAuditHistoryResult>(`${BASE}/Employees/${encode(employeeId)}/Audit`, FIRST_PAGE)
  },

  // Mutations — actor is the cookie UserId server-side; body carries no actor.
  // Each returns { success: true } (no domain body); callers re-read after.
  upsert(input: UaEmployeeInput): Promise<unknown> {
    return api.post(`${BASE}/Employees`, input)
  },
  deactivate(employeeId: string): Promise<unknown> {
    return api.post(`${BASE}/Employees/Deactivate`, { employeeId })
  },
  reactivate(employeeId: string): Promise<unknown> {
    return api.post(`${BASE}/Employees/Reactivate`, { employeeId })
  },
  setPassword(employeeId: string, temporaryPassword: string): Promise<unknown> {
    return api.post(`${BASE}/Employees/SetPassword`, { employeeId, temporaryPassword })
  },
  clearTotp(employeeId: string): Promise<unknown> {
    return api.post(`${BASE}/Employees/ClearTotp`, { employeeId })
  },
  revokeSession(sessionId: string): Promise<unknown> {
    return api.post(`${BASE}/Sessions/Revoke`, { sessionId })
  },

  // ----- bulk create (External identities) --------------------------------
  roleCatalog(): Promise<RoleCatalogEntry[]> {
    return api.get<RoleCatalogEntry[]>(`${AUTHZ}/Roles`)
  },
  /** First assignment auto-creates the UaUser shell from the identity just upserted. */
  assignRole(userId: string, roleName: string): Promise<unknown> {
    return api.post(`${AUTHZ}/Users/AssignRole`, { userId, roleName })
  },
}

import { api } from '@/core/api'
import type {
  UaAccessResult,
  UaAuditHistoryResult,
  UaEmployeeInput,
  UaEmployeeSearchResult,
  UaEmployeeStatusResult,
  UaReportCountsResult,
  UaSessionModel,
} from '@/core/models/ua-user'

const BASE = 'UaAdminWeb'
const encode = (segment: string) => encodeURIComponent(segment)

// Reads are capped at 50 server-side (take clamps down); the screen shows the
// first page and the "refine to narrow" cap note rather than offset-paging.
const PAGE = { skip: 0, take: 50 }

export const uaAdminApi = {
  // Screen-open grant probe. Drives the in-page route-guard (the "no access"
  // card) for UX; the server enforces the grant on every UaAdminWeb/* call
  // regardless. Permission-aware menu hiding is a program-wide concern (not
  // built here) — see map 413 fog.
  access(): Promise<UaAccessResult> {
    return api.get<UaAccessResult>(`${BASE}/Access`)
  },
  reportCounts(): Promise<UaReportCountsResult> {
    return api.get<UaReportCountsResult>(`${BASE}/ReportCounts`)
  },
  search(term: string): Promise<UaEmployeeSearchResult> {
    return api.get<UaEmployeeSearchResult>(`${BASE}/Employees`, { term, ...PAGE })
  },
  worklist(card: string): Promise<UaEmployeeSearchResult> {
    return api.get<UaEmployeeSearchResult>(`${BASE}/ReportCards/${encode(card)}`, PAGE)
  },
  status(employeeId: string): Promise<UaEmployeeStatusResult> {
    return api.get<UaEmployeeStatusResult>(`${BASE}/Employees/${encode(employeeId)}`)
  },
  sessions(employeeId: string): Promise<UaSessionModel[]> {
    return api.get<UaSessionModel[]>(`${BASE}/Employees/${encode(employeeId)}/Sessions`)
  },
  audit(employeeId: string): Promise<UaAuditHistoryResult> {
    return api.get<UaAuditHistoryResult>(`${BASE}/Employees/${encode(employeeId)}/Audit`, PAGE)
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
}

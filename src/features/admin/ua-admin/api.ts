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

import { PAGE_SIZE, skipForPage } from './pager'

const BASE = 'UaAdminWeb'
const encode = (segment: string) => encodeURIComponent(segment)

// The people reads offset-page: both endpoints already bind `skip` and clamp
// only `take` (research 140), so paging cost zero server change (ticket 148).
const pageArgs = (page: number) => ({ skip: skipForPage(page), take: PAGE_SIZE })

// The per-person audit tab keeps its own single 50-row read — paging it was
// ruled out of scope (spec 147).
const FIRST_PAGE = pageArgs(1)

export const uaAdminApi = {
  // Screen-open grant probe. Drives BOTH the in-page route-guard (the "no
  // access" card) AND the shell's permission-aware nav hiding (issue 429) —
  // the shell's probe shares this exact ['ua-admin','access'] cache entry, so
  // it's one call, not two. The server enforces the grant on every UaAdminWeb/*
  // call regardless; the menu hide is show/hide hygiene only.
  access(): Promise<UaAccessResult> {
    return api.get<UaAccessResult>(`${BASE}/Access`)
  },
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
}

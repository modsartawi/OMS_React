// Wire shapes for the UaAdminWeb/Sessions* endpoints (map 001, spec 006). Field
// casing is the camelCase ASP.NET Core emits. The estate-wide session monitor is
// gated by its OWN grant (BackOfficeScreen[UaSessions,03]), separate from Ua Users.
//
// Ticket 007 landed the access spine (the grant probe). Ticket 008 adds the
// search-first, 50-capped live-session list (ActiveSessionRow + its wrapper).
// Ticket 009 adds the server-computed chip counts (SessionCountsResult).

/** GET UaAdminWeb/Sessions/Access — the screen-open grant probe (show/hide only). */
export interface SessionAccessResult {
  canOpen: boolean
}

/**
 * One live-session grid row (ActiveSessionRow) = the existing `ActiveSessionModel`
 * fields PLUS `displayName` (joined from UaEmployee, as SearchEmployees does). A
 * row is the whole record — the table is flat, no detail pane (spec 006).
 */
export interface ActiveSessionRow {
  sessionId: string
  userId: string
  displayName: string
  currentStoreCode: string
  channel: string // web | mobile | backoffice | pos
  createdTime: string
  lastSeenTime: string // the session heartbeat (server TouchSession bumps it)
  ipAddress: string
  userAgent: string
}

/**
 * GET UaAdminWeb/Sessions — the search-first, server-capped list wrapper
 * (mirrors `UaEmployeeSearchResult`). The browser never receives the estate:
 * the server searches + caps at `rowCap` (50) and reports the true `totalMatches`
 * so the grid can show the "first 50 of N — refine to narrow" note.
 */
export interface ActiveSessionSearchResult {
  rows: ActiveSessionRow[]
  totalMatches: number
  rowCap: number
  isCapped: boolean // more rows exist beyond this page
}

/**
 * GET UaAdminWeb/Sessions/Counts — the filter-chip counts, server-computed like
 * `ReportCounts`. These are true estate-wide totals, independent of the 50-row
 * page, so a chip reports the real total even when the grid shows only a sample.
 * `idle` is **per-channel-relative** (web no heartbeat > 45m, mobile > 8h;
 * POS/BackOffice never idle), not a single blunt scalar (spec 006 idle rule).
 */
export interface SessionCountsResult {
  all: number
  web: number
  mobile: number
  backoffice: number
  pos: number
  idle: number
}

/**
 * POST UaAdminWeb/Sessions/RevokeAllForUser — the "sign this person out of every
 * device, every channel" hammer (ticket 011). A thin door over the domain's
 * `RevokeSessionsForUser`; the server audits ONE `ADMIN_SESSION_REVOKE` row per
 * killed session (not an aggregate) and reports how many it ended in
 * `revokedCount`. A user with no live sessions answers success with count 0.
 */
export interface RevokeAllForUserResult {
  success: boolean
  revokedCount: number
}

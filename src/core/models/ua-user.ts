// Wire shapes for the UaAdminWeb/* endpoints (map 413, ticket 416). Field casing
// is the camelCase ASP.NET Core emits; every classification comes back as a RAW
// string code (the client owns the code→label mapping — contract 414 §5).

/** One search / worklist grid row (UaEmployeeGridRow). */
export interface UaEmployeeGridRow {
  employeeId: string
  displayName: string
  phone: string
  phoneClass: string // UaPhoneClasses: missing | placeholder | usable
  email: string // '' = none (ticket 721)
  deliveryChannel: string // UaDeliveryChannels: sms | email — NORMALIZED server-side
  isActive: boolean
  isSeeded: boolean
  credentialState: string // UaCredentialStates: none | temporary-must-change | active
  isTotpEnrolled: boolean
  lastLoginAt: string | null // null = never signed in
}

/** Search box AND card worklist share this wrapper (UaEmployeeSearchResult). */
export interface UaEmployeeSearchResult {
  rows: UaEmployeeGridRow[]
  totalMatches: number
  rowCap: number
  isCapped: boolean // more rows exist beyond this page
}

/** Detail-pane identity/credential/TOTP status (UaEmployeeStatusResult). */
export interface UaEmployeeStatusResult {
  found: boolean // false ⇒ unknown id (200, not 404); rest unset
  employeeId: string
  displayName: string
  phone: string
  phoneClass: string
  email: string // '' = none (ticket 721)
  deliveryChannel: string // sms | email — always the NORMALIZED word, never blank
  isActive: boolean
  createdAt: string
  updatedAt: string
  disabledAt: string | null
  disabledBy: string
  credentialState: string
  credentialCreatedAt: string | null
  isTotpEnrolled: boolean
  lastLoginAt: string | null
}

/**
 * The six report-card counts (UaReportCountsResult). NOTE the one asymmetry:
 * the `mustChange` card key backs the property `mustChangePassword`.
 */
export interface UaReportCountsResult {
  allPeople: number
  notSeeded: number
  phoneGap: number
  awaitingActivation: number
  mustChangePassword: number
  disabled: number
}

/** One audit row (UaAuditEntry). `action` is a code; `targetId` is polymorphic. */
export interface UaAuditEntry {
  actionId: string
  action: string
  actor: string
  targetId: string // employeeId, or a sessionId on ADMIN_SESSION_REVOKE
  actionTime: string // as-stored, mixes local + legacy-UTC — NEVER convert
}

/** Audit tab wrapper — note `entries`/`totalEntries` (NOT `rows`/`totalMatches`). */
export interface UaAuditHistoryResult {
  entries: UaAuditEntry[]
  totalEntries: number
  rowCap: number
  isCapped: boolean
}

/** One live session (ActiveSessionModel); the per-user Sessions read is an array. */
export interface UaSessionModel {
  sessionId: string
  userId: string
  currentStoreCode: string
  channel: string // web | mobile
  createdTime: string
  lastSeenTime: string
  ipAddress: string
  userAgent: string
}

/**
 * Create/edit identity body (UaEmployeeInput).
 *
 * `email` / `deliveryChannel` are OPTIONAL on the wire and an OMITTED one means
 * NOT SUPPLIED — the server leaves the stored value alone (ticket 721). For
 * `email` only, the empty string is the CLEAR. There is no clear for the channel:
 * an unrecognised word is refused at the door rather than normalized to sms, so
 * only ever send `sms` | `email` or nothing at all.
 */
export interface UaEmployeeInput {
  employeeId: string
  displayName: string
  phone: string
  email?: string
  deliveryChannel?: string
  isActive: boolean
}

/** GET UaAdminWeb/Access — the screen-open grant probe (show/hide only). */
export interface UaAccessResult {
  canOpen: boolean
}

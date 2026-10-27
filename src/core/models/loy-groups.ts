/**
 * Loyalty groups (BackOffice spec 3173; brief `3173-oms-react-loyalty-groups-brief.md`). A named set of
 * mobiles a bonus-buy can be offered to. The shapes are the brief's door sketches — the BackOffice ticket
 * that builds each door (3174 list, 3179 `liveBonusBuys`) owns the final spelling and edits the brief.
 *
 * In `@/core/` because the Loyalty groups screen (629+), bonus-buy maintenance (636), simulation (637)
 * and the member screen (635) all read them, and a feature may never import another.
 */

/** `GET LoyGroupWeb/Access`. Reads need `canView`; writes need `canMaintain` ON TOP of it. */
export interface LoyGroupAccess {
  canView: boolean
  canMaintain: boolean
}

/** A live bonus-buy that names the group (BackOffice 3179; `[]` until it ships). */
export interface LoyGroupBonusBuy {
  promoNumber: string
  description: string
}

/** One row of `GET LoyGroupWeb/Groups?includeInactive=bool`. */
export interface LoyGroup {
  groupId: string
  /** Upper-case `[A-Z0-9_-]{1,20}`, set at create and never changed. */
  code: string
  nameEn: string
  /** Shown as stored — Arabic-Indic digits included. */
  nameAr: string
  isActive: boolean
  mobileCount: number
  /** 🚩 May be absent from an older door; read through `liveBonusBuysOf`, never directly. */
  liveBonusBuys: LoyGroupBonusBuy[]
}

// ── Group editor (oms ticket 630; door BackOffice 3174) ──────────────────────────────────────

/** `GET LoyGroupWeb/Groups/{groupId}`: a list row plus who made and last changed it (local, no `Z`). */
export interface LoyGroupDetail extends LoyGroup {
  createdBy: string
  createdAt: string
  updatedBy: string | null
  updatedAt: string | null
}

/** `POST LoyGroupWeb/Groups/Create` — answers the new group. */
export interface LoyGroupCreateRequest {
  code: string
  nameEn: string
  nameAr: string
}

/** `POST LoyGroupWeb/Groups/Rename`. 🚩 No `code`: a group's code never changes after create. */
export interface LoyGroupRenameRequest {
  groupId: string
  nameEn: string
  nameAr: string
}

/** `POST LoyGroupWeb/Groups/SetActive` (oms ticket 631). There is no delete door. */
export interface LoyGroupSetActiveRequest {
  groupId: string
  isActive: boolean
}

/** One row of `GET LoyGroupWeb/Mobile/{mobile}/Groups` (BackOffice 3176): every group the mobile is in. */
export interface LoyMobileGroup {
  groupId: string
  code: string
  nameEn: string
  /** Shown as stored — Arabic-Indic digits included. */
  nameAr: string
  /** Inactive groups are listed too, marked — "why did this customer get that offer". */
  isActive: boolean
}

// ── Group members (oms ticket 632; door BackOffice 3174) ─────────────────────────────────────

/** One row of `GET LoyGroupWeb/Groups/{groupId}/Members`. */
export interface LoyGroupMember {
  /** Canonical `9665XXXXXXXX`, as the server returns it — never reformatted on the client. */
  mobile: string
  isEnrolled: boolean
  loyId?: string | null
  addedBy: string
  /** Local wall-clock, no `Z`. */
  addedAt: string
}

/** One page of a group's members. `total` is the real count of the (searched) members. */
export interface LoyGroupMembersPage {
  total: number
  rows: LoyGroupMember[]
}

/** `POST LoyGroupWeb/Groups/Members/Add` and `…/Remove` — the mobile in any spelling. */
export interface LoyGroupMemberRequest {
  groupId: string
  mobile: string
}

/** `POST LoyGroupWeb/Groups/Members/Add` answers `{ outcome }`. */
export interface LoyGroupMemberAddResult {
  outcome: string
}

// ── Bulk load (oms ticket 633; door BackOffice 3175) ─────────────────────────────────────────

/** `POST LoyGroupWeb/Groups/Members/Bulk` — the lines as the browser read them (trimmed, blanks dropped). */
export interface LoyGroupBulkRequest {
  groupId: string
  lines: string[]
}

/** One line the load did not add, with the server's outcome (`NotAMobile`, `Placeholder`, …). */
export interface LoyGroupBulkRejected {
  line: string
  outcome: string
}

/** What a load did: a count per outcome, and every line not added. Valid lines are added even when others are not. */
export interface LoyGroupBulkResult {
  added: number
  alreadyInGroup: number
  duplicateInBatch: number
  notAMobile: number
  placeholder: number
  rejected: LoyGroupBulkRejected[]
}

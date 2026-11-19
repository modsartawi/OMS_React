/**
 * The operations lead's Mini POS screens (oms 927, BackOffice spec 4063, doors 4074) — wire shapes mirrored field for
 * field, camelCase, from BackOffice `Sartawi.Retail.Data\Modules\Pos\Services\MiniPos\MiniPosAdminService.cs` and its
 * `Data\MiniPosAllowedCategory.cs` / `Data\MiniPosRefusedItem.cs`. A shape change goes there first, then here.
 *
 * Every door is `MiniPosAdmin/*` on SIS.Api (`Services\SIS.Api\Endpoints\MiniPos\MiniPosAdminEndpoints.cs`): cookie session
 * only, reads behind `BackOfficeScreen[MiniPosAdmin, 03]`, writes and the printed code behind `[MiniPosAdmin, 06]`. A
 * refusal is the 400 envelope with a `MINIPOS_*` code; an overlap carries the clashing row in `data`.
 *
 * ⚠️ Dates and timestamps are the estate's local wall-clock with no offset; they stay strings.
 */

/** One assignment row: a promoter at a pharmacy for whole days. Ended rows are kept, never deleted. */
export interface MiniPosAssignment {
  assignmentId: string
  promoterLoginId: string
  promoterStaffId: string
  promoterName: string
  storeCode: string
  fromDate: string
  toDate: string
  plannedHoursPerDay: number
  enteredBy: string
  enteredAt: string
  endedBy: string | null
  endedAt: string | null
}

/** `POST MiniPosAdmin/Assignments`' body. The "who" is the session's, never the body's. */
export interface MiniPosAssignmentRequest {
  promoterLoginId: string
  promoterStaffId?: string
  storeCode: string
  /** `yyyy-MM-dd`, local. */
  fromDate: string
  /** `yyyy-MM-dd`, local, inclusive. */
  toDate: string
  plannedHoursPerDay: number
}

/** "End this promoter now"'s answer. */
export interface MiniPosEndPromoterResult {
  promoterLoginId: string
  endedAssignmentIds: string[]
  revokedSessions: number
}

/** The trial roles a pharmacy can carry; `''` is none. */
export const MINI_POS_TRIAL_ROLES = ['Trial', 'Control', ''] as const
export type MiniPosTrialRole = (typeof MINI_POS_TRIAL_ROLES)[number]

/** One Mini POS store row. The key never leaves the server: `hasKey` only. */
export interface MiniPosStore {
  storeCode: string
  isEnabled: boolean
  trialRole: string
  printedCodeVersion: number
  hasKey: boolean
  updatedBy: string
  updatedAt: string
}

/** The signed code a pharmacy prints, to draw as a QR. */
export interface MiniPosPrintedCode {
  storeCode: string
  version: number
  code: string
}

/** One A-level category on the allow-list. */
export interface MiniPosAllowedCategory {
  aCode: string
  enteredBy: string
  enteredAt: string
}

/** One item on the refusal list, with its reason. */
export interface MiniPosRefusedItem {
  itemNumber: string
  reasonNote: string
  enteredBy: string
  enteredAt: string
}

/** The refusal codes the doors answer (`MiniPosAdminErrors`). */
export const MINI_POS_ERRORS = {
  invalid: 'MINIPOS_ADMIN_INVALID',
  promoterUnknown: 'MINIPOS_PROMOTER_UNKNOWN',
  storeNotEnabled: 'MINIPOS_STORE_NOT_ENABLED',
  storeKeyUnavailable: 'MINIPOS_STORE_KEY_UNAVAILABLE',
  assignmentOverlap: 'MINIPOS_ASSIGNMENT_OVERLAP',
  assignmentPast: 'MINIPOS_ASSIGNMENT_PAST',
  assignmentNotFound: 'MINIPOS_ASSIGNMENT_NOT_FOUND',
  assignmentEnded: 'MINIPOS_ASSIGNMENT_ENDED',
  itemUnknown: 'MINIPOS_ITEM_UNKNOWN',
  categoryUnknown: 'MINIPOS_CATEGORY_UNKNOWN',
} as const

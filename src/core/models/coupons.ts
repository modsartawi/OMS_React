// Wire shapes for the CouponsAdminWeb/* endpoints (map 497 / spec 505; server slices
// 517 templates + 519 import). Field casing is the camelCase ASP.NET Core emits. The
// two screens are gated by their OWN new-engine grants (CouponsAdmin / CouponsSupport) —
// the server re-checks every mutation; Access only shapes nav visibility + tab tiering.

/**
 * GET CouponsAdminWeb/Access — the entry probe (CouponsAdminAccess). `canAdmin` opens
 * the Templates + Import workspaces (admin-only); `canSupport` opens Inquiry (support
 * OR admin, ticket 521). The server enforces the grant on every mutation regardless.
 */
export interface CouponsAccessResult {
  canAdmin: boolean
  canSupport: boolean
}

/**
 * A coupon template (CouponTemplate) — the load-then-edit form model. Times come back
 * as local ISO strings (no-utc-time rule); the form binds the date part only.
 * `maxRedemptions*` and `codePrefix` are set at create and immutable after.
 */
export interface CouponTemplate {
  templateId: string
  materialNumber: string
  description: string
  maxRedemptionsPerCode: number
  maxRedemptionsTotal: number
  totalRedemptionCount: number
  codePrefix: string
  isDisabled: boolean
  validFrom: string | null
  validTo: string | null
  originFilter: string
  createdAt: string
  createdBy: string
  updatedAt: string | null
  updatedBy: string
}

/**
 * POST CouponsAdminWeb/Templates. `createdBy` is stamped server-side from the cookie
 * actor — the client never sends it (the browser cannot forge attribution). Dates go
 * up as `YYYY-MM-DD` strings (the model binder parses them to local DateTime).
 */
export interface CreateTemplateRequest {
  templateId: string
  materialNumber: string
  description: string
  maxRedemptionsPerCode: number
  maxRedemptionsTotal: number
  codePrefix: string
  validFrom: string | null
  validTo: string | null
  originFilter: string
}

/**
 * PUT CouponsAdminWeb/Templates/{id}. The mutable subset — the route id wins over this
 * `templateId`. `isDisabled` is nullable server-side (null = leave unchanged); the form
 * always sends the current toggle. `updatedBy` is stamped server-side.
 */
export interface UpdateTemplateRequest {
  templateId: string
  materialNumber: string
  description: string
  isDisabled: boolean
  validFrom: string | null
  validTo: string | null
  originFilter: string
}

// ── Inquiry + support/destructive (server slice 518 / client ticket 521) ────────────

/** A single coupon instance (CouponInstance) — the code that was issued. */
export interface CouponInstance {
  couponCode: string
  templateId: string
  redeemCount: number
  lastRedeemTransactionId: string
  customerId: string
  isDisabled: boolean
  createdAt: string
  createdBy: string
  updatedAt: string | null
  updatedBy: string
}

/** CouponTransaction.RedemptionType — the ledger row kind. */
export type RedemptionType = 'Redeem' | 'Refund' | 'Reactivate'

/**
 * One row of the coupon's redemption ledger (CouponTransaction) — the "where redeemed"
 * view. A `Redeem` row that `isSuccessful` and is not already reversed is the refundable
 * one; the server guards the rest (already-refunded → CUP-09030, wrong type → CUP-09029).
 */
export interface CouponTransaction {
  transactionId: string
  refTransactionId: string
  couponCode: string
  redemptionType: RedemptionType
  transactionReference: string
  storeCode: string
  redemptionTime: string
  userId: string
  staffId: string
  isSuccessful: boolean
  errorMessage: string
}

/**
 * GET CouponsAdminWeb/Coupons/{code} — instance + its template + redemption ledger.
 *
 * Spec 2463 (BackOffice 2466, ticket 439): a code whose coupon an upload delete removed still
 * answers. `isDeleted` then says no coupon holds the code now, `instance`/`template` are null, and
 * the history lives in `earlierUploads`. A code re-uploaded after a delete has both: the current
 * coupon's `transactions` and the deleted uploads' sections. The server does the grouping (a refund
 * booked after a delete sits under the redemption it reverses), so the client never re-splits it.
 */
export interface CouponDetails {
  instance: CouponInstance | null
  template: CouponTemplate | null
  /** The CURRENT coupon's ledger only. */
  transactions: CouponTransaction[]
  isDeleted: boolean
  /** Always present, oldest first, may be empty. */
  earlierUploads: EarlierUpload[]
}

/** One deleted upload's coupon of this code, with the ledger it carried (ADR 0070). */
export interface EarlierUpload {
  deletedAt: string
  deletedBy: string
  reason: string
  templateId: string
  redeemCount: number
  transactions: CouponTransaction[]
}

// ── Bulk import (server slice 519 / client ticket 522) ──────────────────────────────

/**
 * POST CouponsAdminWeb/Templates/{id}/Import — JSON transport (the browser parses the
 * file; there is no multipart route). `codes` is the client-parsed, de-duped list; the
 * server re-dedupes and re-enforces the 100k cap as the backstop. `customerId` is
 * optional (a customer-scoped batch). `createdBy` is stamped server-side.
 */
export interface CreateImportJobRequest {
  codes: string[]
  customerId?: string | null
}

/** ImportJob.Status — the lifecycle the background worker drives; `Deleted` is an admin's delete
 *  of a finished upload (spec 2463, ticket 439). */
export type ImportJobStatus = 'Pending' | 'Processing' | 'Completed' | 'Failed' | 'Deleted'

/** `Pending`/`Processing` = still in flight (poll); `Completed`/`Failed`/`Deleted` = terminal. */
export function isTerminalJob(status: ImportJobStatus): boolean {
  return status === 'Completed' || status === 'Failed' || status === 'Deleted'
}

/**
 * An import job (ImportJob) — a jobs-grid / polling row. `totalAdded`/`totalSkipped`
 * fill in as the worker processes; `errorMessage` is set on `Failed`.
 */
export interface ImportJob {
  jobId: string
  templateId: string
  status: ImportJobStatus
  totalCodes: number
  totalProcessed: number
  totalAdded: number
  totalSkipped: number
  customerId: string | null
  createdBy: string
  createdAt: string
  startedAt: string | null
  completedAt: string | null
  errorMessage: string | null
  /** Set once the job is `Deleted` (spec 2463). */
  deletedAt: string | null
  deletedBy: string | null
}

/**
 * GET CouponsAdminWeb/Jobs/{jobId}/DeletePreview (BackOffice 2466) — what a delete would do, read
 * before the admin confirms. `toDelete` are the coupons the upload added to its own template;
 * `inOtherTemplates` are the file's codes other templates hold, which a delete never touches.
 */
export interface ImportJobDeletePreview {
  jobId: string
  toDelete: number
  /** Of `toDelete`, how many were already redeemed (their redemption history is kept). */
  redeemed: number
  /** The sum of their redeem counts — taken off the template's total. */
  redemptionCount: number
  inOtherTemplates: number
  canDelete: boolean
  refusalCode: string | null
  refusalMessage: string | null
}

/** POST CouponsAdminWeb/Jobs/{jobId}/Delete → 200 (BackOffice 2465). */
export interface ImportJobDeleteResult {
  jobId: string
  deleted: number
  redeemed: number
  redemptionCount: number
}

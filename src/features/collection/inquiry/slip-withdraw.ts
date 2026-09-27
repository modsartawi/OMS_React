/**
 * Withdraw a wrong slip (ticket 323, BackOffice 2035's `## Web contract`): who may,
 * and the slip's reasons.
 *
 * Pure: no React, no network, no i18n. The rules every owner shares — when confirm
 * is live, the body, the note's clamp and what each answer means — live in
 * `@/core/attachments/withdraw` since ticket 325, and take this list as data.
 *
 * 🔑 **Final, with no restore (C7).** A mistake is fixed by adding the file again,
 * and nothing here can undo one. There is no collection cutoff either (C3): a
 * collected Collections row withdraws as readily as a Ready row.
 */
import { holdsCategory } from '@/core/attachments/rules'
import type { WithdrawReasonRule } from '@/core/attachments/withdraw'
import type { AttachmentAccess } from '@/core/models/collection'
import { CASH_CLOSE, canSeeSlips } from './slips'

/**
 * May this session withdraw a day-close slip? The withdraw grant
 * (`AttachmentsCashCloseWithdraw`, `COLLECTION_ACCOUNTANT` and
 * `ACCOUNTANT_SUPERVISOR` only) is what `withdrawCategories` reports.
 *
 * Fails closed like `canSeeSlips`, and through the same array membership: a pending
 * or refused probe, a missing field, an empty list and a bare string `"CASH_CLOSE"`
 * are all "no". It also needs the read grant (`categories`), since the drawer that
 * carries the action is only open to a reader; the server answers a withdraw
 * category only when read is held too, so the two agree. For drawing only: the
 * route checks the grant again, and a bare 403 from it takes the action away.
 */
export function canWithdrawSlips(access: AttachmentAccess | null | undefined): boolean {
  return canSeeSlips(access) && holdsCategory(access?.withdrawCategories, CASH_CLOSE)
}

/** The reason codes, in the order the contract lists them (`AttachmentWithdrawReasons.All`). */
export const WITHDRAW_REASON_CODES = ['WRONG_STORE_DAY', 'UNREADABLE', 'DUPLICATE', 'NOT_ECR_SLIP', 'OTHER'] as const
export type WithdrawReasonCode = (typeof WITHDRAW_REASON_CODES)[number]

/** The one reason that needs a note, so the audit trail always says why. */
export const WITHDRAW_OTHER: WithdrawReasonCode = 'OTHER'

/**
 * The picker's list: each code, the key of its label, and whether it needs a note
 * (Other alone). The label's VALUE holds the English beside the Arabic, drafted in
 * ticket 323 and waiting on the owner's read, so the wording can change without
 * touching code. The Withdrawn list never reads these: it shows the server's
 * `reasonLabel` / `reasonLabelArabic`.
 */
export const WITHDRAW_REASONS: readonly (WithdrawReasonRule & { code: WithdrawReasonCode; labelKey: string })[] =
  WITHDRAW_REASON_CODES.map((code) => ({
    code,
    labelKey: `slips.withdraw.reasons.${code}`,
    noteRequired: code === WITHDRAW_OTHER,
  }))

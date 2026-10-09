// How the GS1 check draws the server's verdict (ticket 454, spec 2544 stories 34–40). Pure: no
// React, no `t` — every value maps to a label KEY in the `materials-gs1-check` namespace and a
// severity token (`@/core/ui/severity`), never a colour.
//
// 🚩 The page never decides validity itself: each view below reads the server's answer as given.
// Nothing here re-parses a code, re-derives a status or second-guesses `valid`.

import type {
  Gs1BatchVerdict,
  Gs1CheckAnswer,
  Gs1IssueCategory,
  Gs1MaterialReason,
  Gs1TrxType,
  Gs1UnitStatus,
} from '@/core/models/materials'
import type { Severity } from '@/core/ui/severity'

export interface VerdictView {
  /** A key in the `materials-gs1-check` namespace. */
  key: string
  sev: Severity
}

/** The contract's four issue categories, in its order. */
export const GS1_ISSUE_CATEGORIES: readonly Gs1IssueCategory[] = ['Structure', 'GtinIntegrity', 'Charset', 'Expiry']
export const GS1_STATUSES: readonly Gs1UnitStatus[] = ['SELLABLE', 'SOLD', 'HELD']
export const GS1_BATCH_VERDICTS: readonly Gs1BatchVerdict[] = ['known', 'unknown', 'notApplicable']
export const GS1_MATERIAL_REASONS: readonly Gs1MaterialReason[] = ['NOT_PARSED', 'GTIN_UNKNOWN']
export const GS1_TRX_TYPES: readonly Gs1TrxType[] = ['SALE', 'RETURN']

const STATUS: Record<Gs1UnitStatus, Severity> = {
  // Free to sell — the good answer.
  SELLABLE: 'ok',
  // Already sold: a unit in hand that the ledger says left a store is the case a quality user is
  // looking for (a return not yet booked, or a cloned serial).
  SOLD: 'bad',
  // Held by a document — needs a human to look.
  HELD: 'warn',
}

/** The unit's status. `null` — no material or no serial, so there is nothing to check. */
export function statusView(status: Gs1UnitStatus | null): VerdictView {
  return status === null ? { key: 'status.none', sev: 'mute' } : { key: `status.${status}`, sev: STATUS[status] }
}

const BATCH: Record<Gs1BatchVerdict, Severity> = {
  known: 'ok',
  // The ticket: an unknown vendor batch is shown as a warning.
  unknown: 'warn',
  notApplicable: 'mute',
}

/** The vendor batch against the batch master. */
export function batchView(batch: Gs1BatchVerdict): VerdictView {
  return { key: `batch.${batch}`, sev: BATCH[batch] }
}

const REASON: Record<Gs1MaterialReason, Severity> = {
  // The code did not parse: there is no GTIN to look up.
  NOT_PARSED: 'bad',
  // It parsed, but its GTIN is not in the barcode master.
  GTIN_UNKNOWN: 'warn',
}

/** Why there is no material. */
export function materialReasonView(reason: Gs1MaterialReason): VerdictView {
  return { key: `materialReason.${reason}`, sev: REASON[reason] }
}

/** Well-formed or not — the server's `parse.valid`, as given. */
export function wellFormedView(valid: boolean): VerdictView {
  return valid ? { key: 'wellFormed.yes', sev: 'ok' } : { key: 'wellFormed.no', sev: 'bad' }
}

/** An issue's category label. */
export const issueCategoryKey = (category: Gs1IssueCategory): string => `issueCategory.${category}`

/** A history row's transaction type: a sale, or a return. */
export function trxTypeView(type: Gs1TrxType): VerdictView {
  return type === 'SALE' ? { key: 'trxType.SALE', sev: 'go' } : { key: 'trxType.RETURN', sev: 'warn' }
}

/**
 * A row is a duplicate when the list already held the same code (the client's flag) OR the server
 * said so for a repeat inside one request — both are honoured; neither is merged away.
 */
export const isDuplicate = (listFlag: boolean, answer: Gs1CheckAnswer | null | undefined): boolean =>
  listFlag || answer?.duplicate === true

/**
 * The standing "history only covers invoices already synced to HQ" note shows beside every
 * SELLABLE verdict (spec 2544, Further Notes): a sale from the last hour may not be in the ledger
 * yet, so SELLABLE must never read as "certainly never sold".
 */
export const showsSyncNote = (status: Gs1UnitStatus | null): boolean => status === 'SELLABLE'

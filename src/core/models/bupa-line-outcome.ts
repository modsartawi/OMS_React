/**
 * The Bupa line outcomes report's wire shapes (oms 899, BackOffice spec 3888, doors 3889–3891) — mirrored field for
 * field, camelCase, from the brief `C:\Work\DMSCO\BackOffice\.issues\assets\3888-oms-react-bupa-outcomes-brief.md`.
 * The BackOffice ticket that builds a door owns its final spelling and records it under the brief's "Changes"; the
 * staging walk reconciles this file against those lines.
 *
 * A **line outcome** is what a Bupa Care Connect line holds now against what Bupa sent: resolved by a pharmacist,
 * resolved by the order itself, swapped, quantity changed only, voided, or still unresolved.
 *
 * ⚠️ Times are the estate's local wall-clock (`yyyy-MM-ddTHH:mm:ss`, no offset) and days are `yyyy-MM-dd`; they stay
 * strings and are formatted through `@/core/util/date-format`.
 *
 * 🚩 No patient name, mobile, national id or member id travels in either door. Don't add any.
 */

/** Every kind the report classifies a line into (BackOffice 3890 D4), in the brief's order. */
export const BUPA_OUTCOME_KINDS = ['resolved', 'autoResolved', 'swapped', 'quantityOnly', 'voided', 'unresolved'] as const
export type BupaOutcomeKind = (typeof BUPA_OUTCOME_KINDS)[number]

/** The stored act codes on a line's history. `PICK` is the pharmacist's **Resolve**, never the physical pick scan. */
export const BUPA_OUTCOME_ACTS = ['PICK', 'SWAP', 'QUANTITY', 'VOID', 'RESTORE', 'CEILING'] as const

/** The report's and the export's query: placed days, both inclusive, at most 3 months apart; store and kind optional. */
export interface BupaOutcomeQuery {
  from: string
  to: string
  /** One store code; blank = every store. */
  store?: string
  /** Blank = every kind. */
  kind?: BupaOutcomeKind | ''
}

/** What Bupa sent on a summary row: our material, else an SFDA code, else free text (trimmed; the first line's). */
export interface BupaOutcomeSent {
  materialNumber: string | null
  sfdaCode: string | null
  text: string | null
  nameEn: string | null
  nameAr: string | null
}

export interface BupaOutcomeItem {
  materialNumber: string | null
  sfdaCode: string | null
  nameEn: string | null
  nameAr: string | null
}

export interface BupaOutcomeSummaryRow {
  kind: BupaOutcomeKind
  sent: BupaOutcomeSent
  /** Null on a voided or unresolved row: nothing was dispensed. */
  dispensed: BupaOutcomeItem | null
  orders: number
  lines: number
  linesQtyDiffers: number
  sentBaseUnits: number
  dispensedBaseUnits: number
}

export interface BupaOutcomeAct {
  /** One of {@link BUPA_OUTCOME_ACTS}. */
  act: string
  itemBefore: string | null
  itemAfter: string | null
  quantityBefore: number | null
  quantityAfter: number | null
  uomBefore: string | null
  uomAfter: string | null
  reason: string | null
  user: string | null
  at: string
}

export interface BupaOutcomeDetail {
  documentNo: string
  bupaReference: string | null
  approvalNo: string | null
  placedAt: string
  storeCode: string
  lineNumber: number
  kind: BupaOutcomeKind
  sent: { materialNumber: string | null; sfdaCode: string | null; text: string | null; quantity: number | null; uom: string | null }
  dispensed: (BupaOutcomeItem & { quantity: number | null; uom: string | null }) | null
  acts: BupaOutcomeAct[]
}

export interface BupaOutcomeTotals {
  orders: number
  lines: number
  linesQtyDiffers: number
}

export interface BupaOutcomeReport {
  from: string
  to: string
  /** Sorted by `lines` descending, as the door sends it. */
  summary: BupaOutcomeSummaryRow[]
  details: BupaOutcomeDetail[]
  totals: BupaOutcomeTotals
}

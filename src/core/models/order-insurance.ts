import type { LocalDate, MoneySource } from './order-document'

// Wire shape for `GET SdDocumentWeb/Document/{no}/Insurance` (BackOffice spec 3389, door 3390;
// timeline money from 3393, intake body from 3392). Cookie-only, behind the NEW insurance-view
// grant (`canViewInsurance`, `@/core/oms/insurance-grant`). Read-only: the engine money is priced on
// demand and nothing is written.
//
// Not built yet: oms-react builds against stubs, so THIS file states the contract, camelCase as
// System.Text.Json's web defaults emit it. 3390 promises the timeline and intake fields from day
// one ("present in the contract as empty / not kept until 3392 / 3393 fill them"), so the client
// builds against this final shape once.
//
// 🚩 Three absences are NOT zero, and each has its own shape here:
// - **unpriced engine money** — `null` figures beside `priced: false` (3390: "unpriced, never 0");
// - **money not recorded** on an old order change — `before`/`after` are `null` (3393);
// - **an intake body not kept** — `intake.kept: false`, with the day keeping began (3392).
//
// A document that is not an insurance order is refused BY NAME (3390's
// `InsuranceRead_NotAnInsuranceOrder_IsRefusedByName`): a business `ApiError` whose code is
// `NOT_AN_INSURANCE_ORDER_CODE`. The section reads that as "no section", never as an error.

/** GUESS — the refusal code 3390 names for a document with no insurance record. Confirm with BackOffice. */
export const NOT_AN_INSURANCE_ORDER_CODE = 'NOT_INSURANCE_ORDER'

/** The five money figures compared side by side (spec 3389 user story 37). */
export interface InsuranceMoney {
  /** The patient amount: deductible + uncovered (+ other), VAT-inclusive (glossary "Patient amount"). */
  patient: number
  deductible: number
  deductibleVat: number
  uncovered: number
  insurer: number
  /** What the order would ask the patient to collect on this money. `null` when it has none. */
  amountDue: number | null
}

/**
 * The engine money (glossary "Engine money"): what our rules charge, priced on demand. When any
 * live line cannot be priced (unresolved, no price), `priced` is `false`, every figure is `null`
 * and `unpricedLines` names the lines — a partial total is not the order's money. Proposed rule;
 * confirm with BackOffice 3390.
 */
export type EngineMoney =
  | ({ priced: true; unpricedLines: [] } & InsuranceMoney)
  | {
      priced: false
      unpricedLines: number[]
      patient: null
      deductible: null
      deductibleVat: null
      uncovered: null
      insurer: null
      amountDue: null
    }

/** The three money columns of the Money section. */
export interface InsuranceMoneyColumns {
  /** The channel money — what the insurer sent (`Received*`), frozen on arrival. `null` if it sent none. */
  channel: InsuranceMoney | null
  /** The current money — what the order stands on now (`moneySource` says whose). */
  current: InsuranceMoney
  engine: EngineMoney
}

/** One deductible (copay) group of the plan. */
export interface DeductibleGroup {
  /** The group code (`G1`, …). */
  group: string
  /** Percent, `20` for 20 %. */
  percentage: number
  /** The cap in money. `null` = no cap. */
  cap: number | null
}

/** A code with its server-resolved description. */
export interface CodedParty {
  code: string
  name: string
}

/** The plan (3390; spec 3389 user stories 55–58). Every text field may be blank on an old order. */
export interface InsurancePlan {
  policyNumber: string
  policyHolder: string
  contractNumber: string
  className: string
  memberId: string
  /** The patient's identity number (national ID / Iqama) on the insurance record. */
  identityNumber: string
  eligibilityReference: string
  authorizationId: string
  approvalNumber: string
  diagnosis: string
  visitReason: string
  chiefComplaint: string
  /** `null` when not sent. */
  daysSupply: number | null
  /** The insurer customer the order is billed to (its document type's credit customer). */
  insurerCustomer: CodedParty | null
  payer: CodedParty | null
  deductibleGroups: DeductibleGroup[]
}

/** What the channel sent for one line (the intake's line). */
export interface SentLine {
  sfdaCode: string
  /** The prescription text as sent. Free text — `<bdi>`. */
  text: string
  /** The item the channel named, or `""` when it sent only a code / text. */
  itemNumber: string
  quantity: number
  unit: string
}

/** The channel's own per-line split, when it sent one. */
export interface ReceivedLineMoney {
  deductible: number
  deductibleVat: number
  patient: number
  insurer: number
}

/** One line's engine money; `null` figures beside `priced: false`, never 0. */
export type EngineLineMoney =
  | { priced: true; unpricedReason: null; deductible: number; deductibleVat: number; patient: number; insurer: number }
  | { priced: false; unpricedReason: string | null; deductible: null; deductibleVat: null; patient: null; insurer: null }

/**
 * One pricing condition, in step order (`TransactionCondition`).
 *
 * 🚩 The header-condition-money rule: an item-0 (`lineNumber: 0`) condition carries its money in
 * `rate` (`ConditionRate`), and its `value` may read 0. 3390 returns it as stored; the client reads
 * an item-0 condition's money from `rate`.
 */
export interface InsuranceCondition {
  /** `0` = header (item-0) condition. */
  lineNumber: number
  stepNumber: number
  counter: number
  /** The condition type code (`D001`, …). */
  condType: string
  /** Server-resolved description; the client may prefer its own localized word for a known code. */
  description: string
  calculationType: string
  base: number
  rate: number
  value: number
}

/** One line of the insurance order (3390; spec 3389 user stories 43–54). */
export interface InsuranceLine {
  lineNumber: number
  /** A voided line is drawn struck through, never hidden. */
  voided: boolean
  /** `null` for a line the channel did not send. */
  sent: SentLine | null
  dispensedItemNumber: string
  dispensedItemDescription: string
  dispensedQuantity: number
  dispensedUnit: string
  /** On a swapped / resolved line: the item before, and the pharmacist's reason. */
  originalItemNumber: string | null
  pharmacistReason: string | null
  insuranceCategory: string
  deductibleGroup: string
  /** The per-line cap. `0` = no cap, never "not covered" (glossary "Coverage ceiling"). */
  coverageCeiling: number
  /** Our engine's deductible (`CalculatedDeductible`); `null` when the line cannot be priced. */
  engineDeductible: number | null
  /** The deductible the order applies now. */
  appliedDeductible: number
  vat: number
  patientAmount: number
  insurerAmount: number
  /** The channel's per-line split, or `null` when it sent none for this line. */
  received: ReceivedLineMoney | null
  engine: EngineLineMoney
  /** Why the line is unresolved, or `null`. */
  unresolvedReason: string | null
  /** The guard's decision on the line (coded), or `null`. */
  guardDecision: string | null
  /** The line's conditions in step order. */
  conditions: InsuranceCondition[]
}

/** The accepted acts of an order change (3393). Typed open: a new act must not break the read. */
export type InsuranceChangeAct = 'PICK' | 'SWAP' | 'QUANTITY' | 'VOID' | 'RESTORE' | 'CEILING' | (string & {})

/** The money on one side of an accepted act (3393's `*Before` / `*After`). */
export interface ChangeMoney {
  moneySource: MoneySource
  patientTotal: number
  insurerTotal: number
}

/** One accepted act on the order (`SdDocumentInsuranceChange`). */
export interface InsuranceChangeEntry {
  kind: 'change'
  /** Local time. */
  at: string
  by: string
  act: InsuranceChangeAct
  lineNumber: number | null
  itemBefore: string | null
  itemAfter: string | null
  quantityBefore: number | null
  quantityAfter: number | null
  unitBefore: string | null
  unitAfter: string | null
  reason: string | null
  /** 🚩 `null` = NOT RECORDED (an act accepted before 3393), never zero money. */
  moneyBefore: ChangeMoney | null
  moneyAfter: ChangeMoney | null
}

/** One row of the order's general document log, merged into the timeline (3393). */
export interface InsuranceLogEntry {
  kind: 'log'
  at: string
  by: string
  /** The log's action code and its description (Ready, pick, close, …). */
  action: string
  actionDescription: string
  note: string
}

export type InsuranceTimelineEntry = InsuranceChangeEntry | InsuranceLogEntry

/** The intake body (3392): kept whole, or not kept because the order landed before keeping began. */
export type IntakeBody =
  | {
      kept: true
      /** The request byte for byte — show it as it is; pretty-print only when it parses. */
      body: string
      contentType: string
      receivedAt: string
      receivedBy: string
    }
  | {
      kept: false
      /** The day keeping began ("not kept for orders before <date>"); `null` until 3392 ships. */
      keptSince: LocalDate | null
    }

/** The whole answer of `GET SdDocumentWeb/Document/{no}/Insurance`. */
export interface OrderInsuranceRead {
  documentNo: string
  orderNo: string
  /** The store's currency, for money in its decimals (`formatMoneyIn`). `null` reads as 2 decimals. */
  currency: string | null
  moneySource: MoneySource
  money: InsuranceMoneyColumns
  /** The order's stored amount due, on-account amount and paid amount. */
  amountDue: number
  onAccountAmount: number
  paidAmount: number
  plan: InsurancePlan
  lines: InsuranceLine[]
  /** The item-0 conditions, in step order. Their money is `rate`. */
  headerConditions: InsuranceCondition[]
  /** Oldest first. `[]` until 3393 ships. */
  timeline: InsuranceTimelineEntry[]
  intake: IntakeBody
}

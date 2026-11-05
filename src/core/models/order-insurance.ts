import type { LocalDate, MoneySource } from './order-document'

// Wire shape for `GET SdDocumentWeb/Document/{no}/Insurance` (BackOffice spec 3389, door 3390;
// timeline money from 3393, intake body from 3392). Cookie-only, behind the NEW insurance-view
// grant (`canViewInsurance`, `@/core/oms/insurance-grant`). Read-only: the engine money is priced on
// demand and nothing is written.
//
// The types above the wire section are the CLIENT's model the section draws. BackOffice built the
// door in its own shape (`OrderInsuranceReadWire`, below — branch pricing2), and the 3389 hotfix
// maps that at the api boundary (`features/oms/document/insurance-wire.ts`) rather than reshaping
// every part. Where the server sends less than this model holds, the field reads empty / `null`
// and the part says so; nothing is invented.
//
// 🚩 Three absences are NOT zero, and each has its own shape here:
// - **unpriced engine money** — `null` figures beside `priced: false` (3390: "unpriced, never 0");
// - **money not recorded** on an old order change — `before`/`after` are `null` (3393);
// - **an intake body not kept** — `intake.kept: false`, with the day keeping began (3392).
//
// A document that is not an insurance order is refused BY NAME: a 400 business `ApiError` whose
// code is `NOT_AN_INSURANCE_ORDER_CODE`. The section reads that as "no section", never as an error.

/** `SdDocumentErrorCodes.InsuranceReadNotAnInsuranceOrder` — the document has no `SdDocumentInsurance` row. */
export const NOT_AN_INSURANCE_ORDER_CODE = 'SDD-02220'

/**
 * The five money figures compared side by side (spec 3389 user story 37). A `null` figure is "not
 * sent" — the channel sends only patient, deductible, deductible VAT and insurer — never 0.
 */
export interface InsuranceMoney {
  /** The patient amount: deductible + uncovered (+ other), VAT-inclusive (glossary "Patient amount"). */
  patient: number | null
  deductible: number | null
  deductibleVat: number | null
  uncovered: number | null
  insurer: number | null
  /** What the order would ask the patient to collect on this money. `null` when it has none. */
  amountDue: number | null
}

/**
 * The engine money (glossary "Engine money"): what our rules charge, priced on demand. When any
 * live line cannot be priced (unresolved, no price), `priced` is `false`, every figure is `null`
 * and `unpricedLines` names the lines — a partial total is not the order's money. The server says
 * `isPriced` (it priced at all) and `isComplete` (every live line); the boundary reads `priced` as
 * both, so a partial engine total is never drawn as the order's money.
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
  /** The server's `eligibilityId`. */
  eligibilityReference: string
  authorizationId: string
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
  moneySource: MoneySource | (string & {})
  patientTotal: number | null
  insurerTotal: number | null
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
  /** The store's currency, for money in its decimals (`formatMoneyIn`). The server sends none, so it is `null` (2 decimals). */
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

// ─── The wire ────────────────────────────────────────────────────────────────────────────────
// What `GET SdDocumentWeb/Document/{no}/Insurance` actually answers: BackOffice `SdInsuranceReadModel`
// (branch pricing2, `Sd/Services/Models/InsuranceRead`), camelCase, nulls written, a DateTime as a
// local `yyyy-MM-ddTHH:mm:ss`. `documentApi.getInsurance` maps it to `OrderInsuranceRead` at the
// boundary (`features/oms/document/insurance-wire.ts`); nothing else reads these types.

/** `SdInsuranceMoneyModel` — the engine's `InsuranceSummary` shape. A null figure is "not sent / not priced", never 0. */
export interface InsuranceMoneyWire {
  patientTotal: number | null
  deductibleTotal: number | null
  deductibleVatTotal: number | null
  uncoveredTotal: number | null
  uncoveredVatTotal: number | null
  otherTotal: number | null
  otherVatTotal: number | null
  insurerTotal: number | null
  insurerSubTotal: number | null
  insurerVatTotal: number | null
}

export interface InsurancePlanWire {
  insurerCustomerId: string
  payerCode: string
  policyNumber: string
  policyName: string
  policyHolder: string
  policyStartDate: string
  policyEndDate: string
  contractNumber: string
  className: string
  insuranceType: string
  oneCopayment: boolean
  memberId: string
  patientId: string
  identityNumber: string
  identifierType: string
  beneficiaryName: string
  beneficiaryType: string
  gender: string
  eligibilityId: string
  authorizationId: string
  authorizationDate: string
  referenceNumber: string
  actionType: string
  diagnosis: string
  visitReason: string
  chiefComplaintCode: string
  chiefComplaintDescription: string
  /** An int; 0 when not sent. */
  daysSupply: number
  /** `maxAmount` 0 = uncapped. */
  deductibleGroups: { groupName: string; percentage: number; maxAmount: number }[]
}

/** `SdInsuranceLineMoneyModel` — one line's own columns and its insurance split. */
export interface InsuranceLineMoneyWire {
  unitPrice: number
  discount: number
  discountPercentage: number
  grossAmount: number
  vatPercent: number
  vatAmount: number
  netAmount: number
  /** The engine's own deductible, positive. */
  calculatedDeductible: number
  deductibleAmount: number
  deductibleVat: number
  uncoveredAmount: number
  uncoveredVat: number
  otherAmount: number
  otherVat: number
  patientAmount: number
  insurerAmount: number
}

export interface InsuranceConditionWire {
  stepNumber: number
  conditionCounter: number
  conditionType: string
  description: string
  calculationType: string
  conditionCategory: string
  conditionBaseValue: number
  conditionRate: number
  conditionRateUnit: string
  conditionValue: number
  /** The server's header-condition-money rule, applied: `conditionRate` on item 0, else `conditionValue`. */
  money: number
  isStatistical: boolean
  inactiveReason: string
}

export interface InsuranceLineWire {
  lineNumber: number
  voided: boolean
  itemNumber: string
  itemDescription: string
  salesQuantity: number
  salesUom: string
  /** `null` on a line with no insurance row. */
  sent: {
    sfdaCode: string
    text: string
    itemNumber: string
    quantity: number
    uom: string
    numerator: number
    denominator: number
    approvedQuantity: number
  } | null
  originalMaterialNumber: string
  pharmacistSelectionReason: string
  lineControlStatus: string
  comment: string
  insuranceItemCategory: string
  deductibleGroup: string
  /** 0 = no ceiling. */
  maxPayerShare: number
  unresolvedReason: string
  guardOutcome: string
  current: InsuranceLineMoneyWire
  received: { patientAmount: number; insurerAmount: number; deductibleAmount: number; deductibleVat: number } | null
  engineState: 'PRICED' | 'UNPRICED' | 'VOIDED' | (string & {})
  /** `null` unless `engineState` is `PRICED`. */
  engine: InsuranceLineMoneyWire | null
  conditions: InsuranceConditionWire[]
}

export interface InsuranceTimelineEntryWire {
  kind: 'ACT' | 'LOG' | (string & {})
  entryTime: string
  entryUser: string
  /** A LOG written under one of the order's deliveries; `null` otherwise. */
  deliveryNo: string | null
  action: string
  /** A LOG's text. */
  text: string
  lineNumber: number | null
  itemNumberBefore: string | null
  itemNumberAfter: string | null
  quantityBefore: number | null
  quantityAfter: number | null
  uomBefore: string | null
  uomAfter: string | null
  maxPayerShareBefore: number | null
  maxPayerShareAfter: number | null
  reason: string | null
  moneyRecorded: boolean
  moneySourceBefore: string | null
  moneySourceAfter: string | null
  patientTotalBefore: number | null
  patientTotalAfter: number | null
  insurerTotalBefore: number | null
  insurerTotalAfter: number | null
}

export interface OrderInsuranceReadWire {
  documentNo: string
  orderNo: string
  documentType: string
  documentSource: string
  storeCode: string
  moneySource: string
  plan: InsurancePlanWire
  received: InsuranceMoneyWire
  hasReceivedLineAmounts: boolean
  current: InsuranceMoneyWire
  amounts: { netTotal: number; onAccountAmount: number; paidAmount: number; amountDue: number }
  engine: {
    isPriced: boolean
    isComplete: boolean
    refusal: { code: string; english: string; arabic: string } | null
    money: InsuranceMoneyWire
    netTotal: number | null
    amountDue: number | null
  }
  guardState: string
  lines: InsuranceLineWire[]
  headerConditions: InsuranceConditionWire[]
  timeline: { entries: InsuranceTimelineEntryWire[] }
  intake: {
    isKept: boolean
    body: string | null
    contentType: string | null
    receivedTime: string | null
    receivedBy: string | null
    /** On "not kept": the earliest kept body's `receivedTime`; `null` when none is kept anywhere yet. */
    keptSince: string | null
  }
}

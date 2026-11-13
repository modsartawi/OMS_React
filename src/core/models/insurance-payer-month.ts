/**
 * The insurance team's payer-month closure screen, on the wire (oms 896; BackOffice spec 1623, tickets 1628,
 * 1639, 1644, 1648). Mirrors `Sartawi.Retail.Data/Modules/Insurance/PayerMonth/Models/PayerMonthAdminModels.cs`
 * and `Correction/Models/CorrectionRegisterModels.cs`, camelCased as SIS.Api serialises them.
 *
 * Every `DateTime` is the server's LOCAL wall clock, and an unset one is the .NET default `0001-01-01`.
 */

/** `GET InsurancePayerMonthWeb/Access` — cookie only, never grant-gated: it reports the one grant. */
export interface InsurancePayerMonthAccess {
  canManage: boolean
}

/** One payer-month as the screen lists it (`PayerMonthRowResponse`). */
export interface PayerMonthRow {
  customerId: string
  /** The insurance company's name (`Customer.CustomerName`); the list holds `IsInsurance = 1` customers only. */
  customerName: string
  /** Its Arabic name (`Customer.CustomerName2`), empty where none is kept. */
  customerNameAr: string
  year: number
  month: number
  isClosed: boolean
  /** `false` = open because nobody has acted yet; the three `lastAction*` fields are then empty. */
  hasRow: boolean
  /** `Close` or `Reopen`; empty when `hasRow` is false. */
  lastAction: string
  lastActionBy: string
  lastActionAt: string
  lastActionReason: string
  /** Corrections (link groups, not audit lines) the payer-month carries — the count on the close action (1639). */
  correctionCount: number
}

/** `POST …/Close`, `…/CloseAll`, `…/Reopen`. 🔑 No actor: the server reads it off the cookie session. */
export interface PayerMonthActRequest {
  /** Close and Reopen only; close-all derives its own list and the body omits it. */
  customerId?: string
  year: number
  month: number
  reason: string
}

/** `POST …/CloseAll` — the whole month's resulting rows; the screen re-renders from them. */
export interface PayerMonthCloseAllResponse {
  year: number
  month: number
  closedCount: number
  payers: PayerMonthRow[]
}

/** One recorded close or reopen, oldest first (`PayerMonthAuditResponse`). */
export interface PayerMonthAuditEntry {
  actor: string
  action: string
  customerId: string
  year: number
  month: number
  reason: string
  beforeValue: string
  afterValue: string
  createdAt: string
}

/** One corrected line beneath its register entry, old beside new (`CorrectionRegisterLine`). */
export interface CorrectionRegisterLine {
  lineNumber: number
  materialNumber: string
  description: string
  patientAmountOld: number
  patientAmountNew: number
  /** Empty = rejected from cover. */
  coverageGroup: string
  isRejected: boolean
  /** The line moved although nobody touched it — the cap redistributed. */
  movedButUntouched: boolean
}

/** One correction (link group) in the payer-month, oldest first (`CorrectionRegisterEntry`). */
export interface CorrectionRegisterEntry {
  linkGroupId: string
  storeCode: string
  tillStoreCode: string
  originalTrxNumber: string
  originalTransactionId: string
  returnTransactionId: string
  saleTransactionId: string
  customerId: string
  businessDay: string
  periodYear: number
  periodMonth: number
  /** `Collect` or `Refund`. */
  direction: string
  netAmount: number
  patientAmountOld: number
  patientAmountNew: number
  reasonCode: string
  reasonNameEn: string
  reasonNameAr: string
  reasonNote: string
  /** The HQ pay-out pincode was used — read off the row, never inferred from `direction`. */
  pincodeUsed: boolean
  actor: string
  createdAt: string
  lines: CorrectionRegisterLine[]
}

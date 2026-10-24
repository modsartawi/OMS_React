// The prescription session (BackOffice spec 2994) as the OMS web reads it. Wire shapes, camelCase.
//
// Ticket 544 brings the ORDER read (`GET SdDocumentWeb/Document/{documentNo}/PrescriptionSessions`,
// BackOffice 3016 + 3014): `PrescriptionSessionOrderStatusModels.cs` and
// `PrescriptionSessionAfterCloseModels.cs` on branch `spec2994`. The next step and the after-close
// event are SHARED with the HQ list (545-548, `PrescriptionSessionHqModels.cs`), which adds its own
// row shapes beside these rather than redefining them.
//
// 🔑 Read-only by shape: nothing here carries an act. Only a NewPos till at the holding store acts.

/** A wall-clock time as SIS.Api sends it (estate local, UTC+3), never zone-converted. */
export type PrescriptionSessionLocalTime = string

/**
 * A next step with every act taken out (`PrescriptionSessionStatusStepModel`): what it is, who
 * owns it, what it waits on. The HQ list's `step` is the same model.
 */
export interface PrescriptionSessionStep {
  /** NextStepCodes. */
  code: string
  /** SIS.Api English: shown as server text, never keyed. */
  label: string
  /** `HOLDING_STORE | PAYER | CUSTOMER | DONOR_STORE | SYSTEM | NONE` — CUSTOMER while parked. */
  owner: string
  /** The session (`PS-…`) this one waits on, on a shared order; null otherwise. */
  waitingOn: string | null
  isParked: boolean
  /** The park note ("collects tomorrow"), only when parked. */
  parkNote: string | null
  /** NextStepBadges: `EXPIRES_TOMORROW`. */
  badges: string[]
}

/** One after-close event on a session (`PrescriptionSessionAfterCloseModel`, ticket 3014). */
export interface PrescriptionSessionAfterClose {
  /** `RETURN | CORRECTION | RESALE`. */
  kind: string
  /** The sale acted on: the session's own sale, or a re-sale already linked to it. */
  originalSaleNo: string
  /** The return (RETURN), the reversal (CORRECTION) or the re-sale (RESALE). */
  documentNo: string
  /** CORRECTION: the re-invoice. RESALE: the re-sale. Empty / null for a plain return. */
  resaleNo: string | null
  storeCode: string
  recordedAt: PrescriptionSessionLocalTime
  recordedBy: string
}

/** One session attached to an order (`PrescriptionSessionStatusModel`), read-only. */
export interface PrescriptionSessionStatus {
  sessionId: string
  /** `PS-{sessionId}`. */
  displayId: string
  /** `NPHS | WSFT`. */
  sourceKind: string
  holdingStore: string
  /** PrescriptionSessionStates (12). */
  state: string
  /** `COUNTER | DELIVERY`; null = not chosen yet. */
  route: string | null
  step: PrescriptionSessionStep | null
  /** What happened after the session closed: facts, not acts. */
  afterClose: PrescriptionSessionAfterClose[]
}

/** An order's (or a delivery's, read through its order) prescription sessions. */
export interface PrescriptionSessionOrderStatus {
  /** The number asked for. */
  documentNo: string
  /** Every attached session, ended ones included. Empty for most orders. */
  sessions: PrescriptionSessionStatus[]
  /** The order's one line: the one session's step, or the one furthest from Ready. Null with no session. */
  row: PrescriptionSessionStep | null
  /** Every session on the order is Invoiced or Closed. False with no session. */
  isInvoiced: boolean
}

// ── The HQ list (ticket 545; BackOffice 3015 `PrescriptionSessionHqModels.cs`) ──────────────────

/** One open session on the HQ list (`PrescriptionSessionHqRowModel`), read-only. */
export interface PrescriptionSessionHqRow {
  sessionId: string
  /** `PS-{sessionId}`. */
  displayId: string
  /** `NPHS | WSFT`. */
  sourceKind: string
  /** The current attempt's key; empty before attach. */
  sourceKey: string | null
  beneficiaryId: string | null
  beneficiaryName: string | null
  holdingStore: string
  /** The second store: a donor (an OPEN donor request) or the asking store (an OPEN transfer); null when none. */
  otherStore: string | null
  /** `DONOR | TRANSFER`; null when `otherStore` is. */
  otherStoreReason: string | null
  state: string
  route: string | null
  orderNo: string | null
  /** The step as the holding store sees it (the till's own computation). */
  step: PrescriptionSessionStep | null
  createdAt: PrescriptionSessionLocalTime
  /** Whole calendar days since the mint. */
  ageDays: number
  /** The idle clock: the later of the last act and the last pick move. */
  idleSince: PrescriptionSessionLocalTime
  idleDays: number
  isStalled: boolean
  isAboutToLapse: boolean
  /** Dispensed, not invoiced. */
  isOwed: boolean
  /** The day it lapses at the end of, when about to lapse. */
  lapsesAtEndOf: PrescriptionSessionLocalTime | null
  dispensedAt: PrescriptionSessionLocalTime | null
  /** When its business day ended still owed; kept after the invoice. */
  invoiceOwedAt: PrescriptionSessionLocalTime | null
  /** The open Notification Center items: `INVOICE_OWED | STALLED | LAPSE_WARNING`. */
  openItems: string[]
  hasOpenItem: boolean
}

/** The HQ list (`PrescriptionSessionHqListModel`): rows oldest idle first, counts over EVERY matched row. */
export interface PrescriptionSessionHqList {
  rows: PrescriptionSessionHqRow[]
  /** Rows matched before the 2,000-row cap. */
  total: number
  stalled: number
  aboutToLapse: number
  owed: number
  /** `total` exceeded the cap: only the oldest-idle rows came back. The counts are never truncated. */
  isTruncated: boolean
}

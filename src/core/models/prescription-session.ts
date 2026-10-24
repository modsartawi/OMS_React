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

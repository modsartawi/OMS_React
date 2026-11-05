import { api, apiErrorCode } from '@/core/api'
import type { DeliveryCalloutHistory } from '@/core/models/delivery-callout'
import type { ForceLfReturnRefundRequest, LfReturnDetailModel } from '@/core/models/lf-return'
import { NOT_AN_INSURANCE_ORDER_CODE, type OrderInsuranceRead } from '@/core/models/order-insurance'
import type { PrescriptionSessionOrderStatus } from '@/core/models/prescription-session'
import type {
  CreatedReturnModel,
  CreateReturnRequest,
  DonorRequestModel,
  MarkDeliveredReasonModel,
  MarkDeliveredRequest,
  SdDocumentHeaderModel,
  SdDocumentLogModel,
  SdDocumentOutboxModel,
  UpdateSdDocumentHeader,
} from '@/core/models/sd-document'
import type { RescheduleDocumentModel } from '@/core/models/slots'

// The OMS door — `SdDocumentWeb/*`, cookie-only and grant-filtered (BackOffice 750,
// ticket 125; the rationale is written once in `@/core/oms/api`, which also holds the
// screen-open probe both OMS pages share). It matters most here: these are the WRITE
// endpoints an ungated `SdDocument/*` left open to any authenticated session.
// `Slots/AvailableSlots/{storeCode}` is not here at all: it is not an SdDocument endpoint
// (750 OQ2) and it is now asked by two features, so it lives in `core/services/lookups`
// with the other shared reads — a feature may never import a feature.
const BASE = 'SdDocumentWeb'
/** The LF return doors live on their own route table (BackOffice 3375/3376), not under `SdDocumentWeb`. */
const LF_BASE = 'LocalFulfillmentReturnWeb'
/** 3376's answer for a return delivery that is not an LF return (`SdDocumentErrorCodes.LocalFulfillmentReturnReadNotFound`). */
const LF_RETURN_NOT_FOUND = 'SDD-02205'

/** Encode a value for safe use as a URL path segment. */
function encode(value: string): string {
  return encodeURIComponent((value ?? '').trim())
}

/**
 * Data access for Screen 2 — Document Details.
 *
 * The Logs/Outbox endpoints are always rooted at `SdDocumentWeb/Document/{no}/…`
 * — even for a delivery — so callers pass the LOADED document's `documentNo`,
 * not the route parameter.
 *
 * The session-stable lists (reschedule reasons, store details, districts) are
 * not here: they live in `core/services/lookups` as cached queries, shared with
 * the store switcher and the filter panel. Available slots are store- and
 * time-specific, so they are deliberately never cached.
 */
export const documentApi = {
  getDocument(documentNo: string): Promise<SdDocumentHeaderModel> {
    return api.get<SdDocumentHeaderModel>(`${BASE}/Document/${encode(documentNo)}`)
  },
  getDelivery(deliveryNo: string): Promise<SdDocumentHeaderModel> {
    return api.get<SdDocumentHeaderModel>(`${BASE}/Delivery/${encode(deliveryNo)}`)
  },
  getLogs(documentNo: string): Promise<SdDocumentLogModel[]> {
    return api.get<SdDocumentLogModel[]>(`${BASE}/Document/${encode(documentNo)}/Logs`)
  },
  getOutbox(documentNo: string): Promise<SdDocumentOutboxModel[]> {
    return api.get<SdDocumentOutboxModel[]>(`${BASE}/Document/${encode(documentNo)}/Outbox`)
  },
  /**
   * A delivery's donor requests (BackOffice 2458, ticket 429): live ones oldest first, the
   * cancelled ones last. Behind the Delivery details grant; read-only.
   */
  getDonorRequests(deliveryNo: string): Promise<DonorRequestModel[]> {
    return api.get<DonorRequestModel[]>(`${BASE}/Delivery/${encode(deliveryNo)}/DonorRequests`)
  },
  /**
   * A delivery's callout history (BackOffice 2964, ticket 542): every callout of the delivery,
   * oldest first, each with its bids and its raw event log. Behind the Delivery details grant
   * (`GatedByDetail`); read-only. A delivery never competed answers `callouts: []`.
   */
  getCallout(deliveryNo: string): Promise<DeliveryCalloutHistory> {
    return api.get<DeliveryCalloutHistory>(`${BASE}/Delivery/${encode(deliveryNo)}/Callout`)
  },
  /**
   * An order's prescription sessions (BackOffice 3016 + 3014, ticket 544): each attached session's
   * state, next step and owner, and what happened after it closed. Behind the Document details
   * grant (`GatedByDetail`); read-only by shape. A delivery number works too — SIS.Api reads it
   * through its order. An order with no session answers `sessions: []`.
   */
  getPrescriptionSessions(documentNo: string): Promise<PrescriptionSessionOrderStatus> {
    return api.get<PrescriptionSessionOrderStatus>(`${BASE}/Document/${encode(documentNo)}/PrescriptionSessions`)
  },
  /**
   * The LF return detail — the warehouse watch — by RETURN delivery number (BackOffice 3369 §Wire,
   * read door 3376 `GET LocalFulfillmentReturnWeb/Detail/{returnDeliveryNo}`; spec 759 F4, ticket 762,
   * route reconciled by 765). Behind `LocalFulfillmentReturn,03`; read-only.
   *
   * A return delivery with no LF watch — a bonded return — is answered `400` with code
   * {@link LF_RETURN_NOT_FOUND}: that reads as `null` ("not an LF return", no panel). Any other
   * failure is thrown for the page to say.
   */
  async getLfReturn(returnDeliveryNo: string): Promise<LfReturnDetailModel | null> {
    try {
      return (await api.get<LfReturnDetailModel | null>(`${LF_BASE}/Detail/${encode(returnDeliveryNo)}`)) ?? null
    } catch (err) {
      if (apiErrorCode(err) === LF_RETURN_NOT_FOUND) return null
      throw err
    }
  },
  /**
   * An insurance order's insurance read (BackOffice spec 3389, door 3390
   * `GET SdDocumentWeb/Document/{no}/Insurance`; ticket 787): its plan, its channel / current /
   * engine money, its lines and how each was priced. Behind the insurance-view grant
   * (`@/core/oms/insurance-grant`); read-only — the engine money is priced on demand, nothing saved.
   *
   * ⚠ Not built yet: STUBBED in `tools/insurance-section-drive.mjs` until 3390 is on staging; the
   * live-door walk reconciles the route and the refusal code.
   *
   * A document that is not an insurance order is refused by name — GUESSED code
   * {@link NOT_AN_INSURANCE_ORDER_CODE}: that reads as `null` ("no section"). Any other failure,
   * a 403 included, is thrown for the page to say or to revoke the grant on.
   */
  async getInsurance(documentNo: string): Promise<OrderInsuranceRead | null> {
    try {
      return (await api.get<OrderInsuranceRead | null>(`${BASE}/Document/${encode(documentNo)}/Insurance`)) ?? null
    } catch (err) {
      if (apiErrorCode(err) === NOT_AN_INSURANCE_ORDER_CODE) return null
      throw err
    }
  },
  /**
   * FORCE REFUND an LF return by received quantity (BackOffice 3369 D13, door 3375
   * `POST LocalFulfillmentReturnWeb/ForceRefund`; spec 759 F5, ticket 763, route reconciled by 765).
   * Behind `LocalFulfillmentReturn,04` beside 03. The body carries quantities, a reason and a
   * `requestId` — never an amount; the server computes the money and is idempotent on the id. The
   * answer is not read: the panel re-reads the watch.
   */
  forceLfReturnRefund(body: ForceLfReturnRefundRequest): Promise<unknown> {
    return api.post<unknown>(`${LF_BASE}/ForceRefund`, body)
  },
  updateDocument(body: UpdateSdDocumentHeader): Promise<boolean> {
    return api.post<boolean>(`${BASE}/UpdateDocument`, body)
  },
  updateDelivery(body: UpdateSdDocumentHeader): Promise<boolean> {
    return api.post<boolean>(`${BASE}/UpdateDelivery`, body)
  },
  /**
   * The active `DLVM` reasons, ordered by code (BackOffice 2421). Behind both grants: a
   * session missing either gets a bare 403.
   */
  markDeliveredReasons(): Promise<MarkDeliveredReasonModel[]> {
    return api.get<MarkDeliveredReasonModel[]>(`${BASE}/MarkDeliveredReasons`)
  },
  /**
   * Mark an out-for-delivery delivery delivered (BackOffice 2418, ADR 0065). The server runs
   * the field's own `DDLR` with all its effects. A refusal is a 400 on the envelope with a
   * machine code (2420); a session missing either grant gets a bare 403.
   */
  markDelivered(request: MarkDeliveredRequest): Promise<boolean> {
    // Named field by field, so a wider object handed in cannot put an extra field on the wire.
    const body: MarkDeliveredRequest = { deliveryNo: request.deliveryNo, reasonCode: request.reasonCode }
    if (request.note) body.note = request.note
    return api.post<boolean>(`${BASE}/MarkDelivered`, body)
  },
  rescheduleDocument(body: RescheduleDocumentModel): Promise<boolean> {
    return api.post<boolean>(`${BASE}/RescheduleDocument`, body)
  },
  rescheduleDelivery(body: RescheduleDocumentModel): Promise<boolean> {
    return api.post<boolean>(`${BASE}/RescheduleDelivery`, body)
  },
  /**
   * Create a bonded return against a delivery (spec 289 D10).
   *
   * The body carries a client-minted `requestId` and **no amount of any kind**;
   * see `buildCreateReturnRequest`, which is the only thing that builds one. A
   * refusal arrives as the envelope this repo already renders — a guardrail
   * refusal read through `apiErrorMessage` / `apiErrorCode`, never a crash.
   */
  createReturn(body: CreateReturnRequest): Promise<CreatedReturnModel> {
    return api.post<CreatedReturnModel>(`${BASE}/CreateReturn`, body)
  },
}

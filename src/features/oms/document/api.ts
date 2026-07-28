import { api } from '@/core/api'
import type {
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
  updateDocument(body: UpdateSdDocumentHeader): Promise<boolean> {
    return api.post<boolean>(`${BASE}/UpdateDocument`, body)
  },
  updateDelivery(body: UpdateSdDocumentHeader): Promise<boolean> {
    return api.post<boolean>(`${BASE}/UpdateDelivery`, body)
  },
  rescheduleDocument(body: RescheduleDocumentModel): Promise<boolean> {
    return api.post<boolean>(`${BASE}/RescheduleDocument`, body)
  },
  rescheduleDelivery(body: RescheduleDocumentModel): Promise<boolean> {
    return api.post<boolean>(`${BASE}/RescheduleDelivery`, body)
  },
}

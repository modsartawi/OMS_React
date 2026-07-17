import { api } from '@/core/api'
import type {
  SdDocumentHeaderModel,
  SdDocumentLogModel,
  SdDocumentOutboxModel,
  UpdateSdDocumentHeader,
} from '@/core/models/sd-document'
import type { RescheduleDocumentModel, TimeSlotsModel } from '@/core/models/slots'

/** Encode a value for safe use as a URL path segment. */
function encode(value: string): string {
  return encodeURIComponent((value ?? '').trim())
}

/**
 * Data access for Screen 2 — Document Details.
 *
 * The Logs/Outbox endpoints are always rooted at `SdDocument/Document/{no}/…`
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
    return api.get<SdDocumentHeaderModel>(`SdDocument/Document/${encode(documentNo)}`)
  },
  getDelivery(deliveryNo: string): Promise<SdDocumentHeaderModel> {
    return api.get<SdDocumentHeaderModel>(`SdDocument/Delivery/${encode(deliveryNo)}`)
  },
  getLogs(documentNo: string): Promise<SdDocumentLogModel[]> {
    return api.get<SdDocumentLogModel[]>(`SdDocument/Document/${encode(documentNo)}/Logs`)
  },
  getOutbox(documentNo: string): Promise<SdDocumentOutboxModel[]> {
    return api.get<SdDocumentOutboxModel[]>(`SdDocument/Document/${encode(documentNo)}/Outbox`)
  },
  updateDocument(body: UpdateSdDocumentHeader): Promise<boolean> {
    return api.post<boolean>('SdDocument/UpdateDocument', body)
  },
  updateDelivery(body: UpdateSdDocumentHeader): Promise<boolean> {
    return api.post<boolean>('SdDocument/UpdateDelivery', body)
  },
  rescheduleDocument(body: RescheduleDocumentModel): Promise<boolean> {
    return api.post<boolean>('SdDocument/RescheduleDocument', body)
  },
  rescheduleDelivery(body: RescheduleDocumentModel): Promise<boolean> {
    return api.post<boolean>('SdDocument/RescheduleDelivery', body)
  },
  /** Store- and time-specific — fetched fresh on every dialog open. */
  availableSlots(storeCode: string): Promise<TimeSlotsModel> {
    return api.get<TimeSlotsModel>(`Slots/AvailableSlots/${encode(storeCode)}`)
  },
}

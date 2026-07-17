import { api } from '@/core/api'
import type { DeliveryDocumentModel } from '@/core/models/delivery-document'
import { buildDeliveryQuery, type DeliveryFilterCriteria } from './filter'

/** Endpoint for the Screen 1 search; the server pre-sorts by DeliveryNo desc. */
const DELIVERY_DOCUMENT_LIST = 'SdDocument/DeliveryDocumentList'

export function searchDeliveries(criteria: DeliveryFilterCriteria): Promise<DeliveryDocumentModel[]> {
  return api.get<DeliveryDocumentModel[]>(DELIVERY_DOCUMENT_LIST, buildDeliveryQuery(criteria))
}

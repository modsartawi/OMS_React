import { api } from '@/core/api'
import type { DeliveryDocumentModel } from '@/core/models/delivery-document'
import { buildDeliveryQuery, type DeliveryFilterCriteria } from './filter'

// The OMS door: `SdDocumentWeb/*`, cookie-only and grant-filtered (BackOffice 750). The
// old `SdDocument/*` paths carried no grant filter at all, so any authenticated session
// could list — and reschedule (ticket 125). Payload shapes are identical by 750's
// Boundaries, so the models in `core/models/` are unchanged.
//
// The screen-open probe is deliberately NOT here: the Document Details screen guards on
// the same call, and a feature may never import another feature — so it lives in
// `@/core/oms/api` alongside the ONE cache key its three consumers share.
const BASE = 'SdDocumentWeb'

export const deliveriesApi = {
  /** The Screen 1 search; the server pre-sorts by DeliveryNo desc. */
  search(criteria: DeliveryFilterCriteria): Promise<DeliveryDocumentModel[]> {
    return api.get<DeliveryDocumentModel[]>(`${BASE}/DeliveryDocumentList`, buildDeliveryQuery(criteria))
  },
}

/**
 * The Cities & districts screen's server calls (ticket 436, spec 430 D6). The probe is the shared
 * OMS one (`@/core/oms/api`).
 *
 * Through `@/core/api` (`api-envelope`): the envelope, the error taxonomy and 401 are its.
 *
 * 🚩 These are the GATED `SdDocumentWeb/*` reads (BackOffice ask BO-5, NOT built yet), written
 * against spec 430 D6's proposed shape. The cookie-open `SdDocument/Cities` and
 * `SdDocument/Districts` are left to their existing callers and are not used here. A grant refusal
 * is the usual business 403, shown with its own message.
 */
import { api } from '@/core/api'
import type { SdCityModel, SdDistrictModel } from '@/core/models/lookups'

export const geographyApi = {
  /** `GET SdDocumentWeb/Cities` → `SdCityModel[]` — every city, no filters. */
  async cities(): Promise<SdCityModel[]> {
    const data = await api.get<SdCityModel[] | null>('SdDocumentWeb/Cities')
    return Array.isArray(data) ? data : []
  },

  /** `GET SdDocumentWeb/Districts?cityCode=` → `SdDistrictModel[]` — one city's districts. */
  async districts(cityCode: string): Promise<SdDistrictModel[]> {
    const data = await api.get<SdDistrictModel[] | null>('SdDocumentWeb/Districts', { cityCode })
    return Array.isArray(data) ? data : []
  },
}

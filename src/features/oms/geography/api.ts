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
 *
 * The imports (ticket 437) are the WPF update requests, `{ lines }` with `isDelete`, now answering
 * what they skipped (D8; BackOffice asks BO-5 and BO-7, NOT built yet).
 */
import { api } from '@/core/api'
import type { ImportResultModel } from '@/core/models/import-result'
import type { SdCityModel, SdDistrictModel } from '@/core/models/lookups'
import type { GeographyImportLine, ImportKind } from './geography'

const IMPORT_DOOR: Record<ImportKind, string> = {
  cities: 'SdDocumentWeb/Cities/Import',
  districts: 'SdDocumentWeb/Districts/Import',
}

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

  /**
   * `POST SdDocumentWeb/Cities/Import` or `Districts/Import` → `{ applied, unchanged, skipped }`.
   * Per line an upsert or a delete, one commit; lines absent from the file are untouched.
   */
  importLines(kind: ImportKind, body: { lines: GeographyImportLine<string>[] }): Promise<ImportResultModel> {
    return api.post<ImportResultModel>(IMPORT_DOOR[kind], body)
  },
}

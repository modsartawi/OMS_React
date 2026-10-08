/**
 * The Document source users screen's server calls (ticket 438, spec 430 D7). The probe is the shared
 * OMS one (`@/core/oms/api`).
 *
 * Through `@/core/api` (`api-envelope`): the envelope, the error taxonomy and 401 are its.
 *
 * 🚩 Both doors are BackOffice ask BO-6 (and the import's answer BO-7), NOT built yet: this is
 * written against spec 430 D7/D8's proposed shapes. A grant refusal is the usual business 403,
 * shown with its own message.
 */
import { api } from '@/core/api'
import type { ImportResultModel } from '@/core/models/import-result'
import type { SdDocumentSourceUserImportLine, SdDocumentSourceUserModel } from '@/core/models/document-source-user'

export const documentSourceUsersApi = {
  /** `GET SdDocumentWeb/DocumentSourceUsers` → `SdDocumentSourceUserModel[]` — every pin, no filters. */
  async list(): Promise<SdDocumentSourceUserModel[]> {
    const data = await api.get<SdDocumentSourceUserModel[] | null>('SdDocumentWeb/DocumentSourceUsers')
    return Array.isArray(data) ? data : []
  },

  /**
   * `POST SdDocumentWeb/DocumentSourceUsers/Import` `{ lines: [{ userId, documentSource, isDeleted }] }`
   * → `{ applied, unchanged, skipped }`. Per line a pin or an unpin, one commit; users absent from
   * the file are untouched. A skipped line names `UNKNOWN_STAFF` or `UNKNOWN_SOURCE`.
   */
  importLines(lines: SdDocumentSourceUserImportLine[]): Promise<ImportResultModel> {
    return api.post<ImportResultModel>('SdDocumentWeb/DocumentSourceUsers/Import', { lines })
  },
}

import { api, type FileResponse } from '@/core/api'
import type {
  HybrisStockAddMaterialBody,
  HybrisStockEnabledBody,
  HybrisStockMaterialRow,
  HybrisStockMaterialsPage,
  HybrisStockMaterialsQuery,
  HybrisStockReasonBody,
  HybrisStockUploadPreview,
  HybrisStockUploadResult,
} from '@/core/models/hybris-stock'
import { materialsDoorParams } from './materials-query'

// The Hybris stock materials doors (BackOffice 3454). 🚩 Guessed routes — see `@/core/models/hybris-stock`.
//
// Every call goes through @/core/api (see .claude/rules/api-envelope.md).

/** Every materials page, whatever its filters — a commit refreshes them all, a change patches its row. */
export const MATERIALS_KEY = ['hybris-stock', 'materials'] as const

const materialPath = (n: string) => `HybrisStockWeb/Materials/${encodeURIComponent(n)}`

export const materialsApi = {
  /** GET HybrisStockWeb/Materials?q=&enabled=&skip=&take= — one server page. */
  async list(query: HybrisStockMaterialsQuery): Promise<HybrisStockMaterialsPage> {
    const page = await api.get<HybrisStockMaterialsPage | null>('HybrisStockWeb/Materials', materialsDoorParams(query))
    return { total: page?.total ?? 0, rows: page?.rows ?? [] }
  },

  /** POST HybrisStockWeb/Materials `{ materialNumber, reason }` — add one, enabled. Refusals: HYS-00001, 00004, 00005. */
  add(body: HybrisStockAddMaterialBody): Promise<HybrisStockMaterialRow> {
    return api.post<HybrisStockMaterialRow>('HybrisStockWeb/Materials', body)
  },

  /** PUT HybrisStockWeb/Materials/{n}/Enabled `{ enabled, reason }` — returns the row. Refusals: HYS-00001, 00004. */
  setEnabled(materialNumber: string, body: HybrisStockEnabledBody): Promise<HybrisStockMaterialRow> {
    return api.put<HybrisStockMaterialRow>(`${materialPath(materialNumber)}/Enabled`, body)
  },

  /**
   * POST HybrisStockWeb/Materials/Upload/Preview — multipart part `file` (CSV or XLSX: a material
   * number column and an optional enabled column). Classifies every row; changes NOTHING.
   * Refusal: HYS-00007 (the file cannot be read).
   */
  preview(file: File): Promise<HybrisStockUploadPreview> {
    const form = new FormData()
    form.append('file', file, file.name)
    return api.upload<HybrisStockUploadPreview>('HybrisStockWeb/Materials/Upload/Preview', form)
  },

  /**
   * POST HybrisStockWeb/Materials/Upload/{uploadId}/Commit `{ reason }` — applies exactly the preview:
   * adds the new, updates the changed, never deletes. Refusals: HYS-00001, 00006 (the preview is gone).
   */
  commit(uploadId: string, body: HybrisStockReasonBody): Promise<HybrisStockUploadResult> {
    return api.post<HybrisStockUploadResult>(`HybrisStockWeb/Materials/Upload/${encodeURIComponent(uploadId)}/Commit`, body)
  },

  /** GET HybrisStockWeb/Materials/Download — the whole list as a file, in the shape an upload reads back. */
  download(): Promise<FileResponse> {
    return api.blob('HybrisStockWeb/Materials/Download')
  },
}

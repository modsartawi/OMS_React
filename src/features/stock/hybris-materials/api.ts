import { api, type FileResponse } from '@/core/api'
import type {
  HybrisStockAddMaterialBody,
  HybrisStockMaterialRow,
  HybrisStockMaterialsPage,
  HybrisStockMaterialsQuery,
  HybrisStockReasonBody,
  HybrisStockUploadPreview,
  HybrisStockUploadResult,
} from '@/core/models/hybris-stock'
import { materialsDoorParams } from './materials-query'

// The Hybris stock materials doors (BackOffice 3454), as the door contract writes them — see
// `@/core/models/hybris-stock`.
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

  /** POST HybrisStockWeb/Materials `{ materialNumber, reason }` — add one (`enabled` omitted = enabled).
   *  Refusals, in order: HYS-00001, 00010 (404 not in the master), 00011 (409 already listed). */
  add(body: HybrisStockAddMaterialBody): Promise<HybrisStockMaterialRow> {
    return api.post<HybrisStockMaterialRow>('HybrisStockWeb/Materials', body)
  },

  /** POST HybrisStockWeb/Materials/{n}/Enable or /Disable `{ reason }` — returns the row.
   *  Refusals, in order: HYS-00001, 00012 (404 not listed), 00013 / 00014 (409 already so). */
  setEnabled(materialNumber: string, enabled: boolean, body: HybrisStockReasonBody): Promise<HybrisStockMaterialRow> {
    return api.post<HybrisStockMaterialRow>(`${materialPath(materialNumber)}/${enabled ? 'Enable' : 'Disable'}`, body)
  },

  /**
   * POST HybrisStockWeb/Materials/Upload/Preview — multipart part `file` (CSV or XLSX: a material
   * number column and an optional enabled column, read by header name). A dry run: classifies every row
   * and answers its `contentHash`; changes NOTHING. Refusal: HYS-00016 (the file yields no rows at all).
   */
  preview(file: File): Promise<HybrisStockUploadPreview> {
    const form = new FormData()
    form.append('file', file, file.name)
    return api.upload<HybrisStockUploadPreview>('HybrisStockWeb/Materials/Upload/Preview', form)
  },

  /**
   * POST HybrisStockWeb/Materials/Upload/Commit — multipart `file` (the SAME file), `contentHash` (the
   * preview's) and `reason`. Applies exactly the preview: adds the new, updates the changed, never
   * deletes. Refusals, in order: HYS-00001, 00016, 00015 (409 the file or the list changed — preview again).
   */
  commit(file: File, contentHash: string, reason: string): Promise<HybrisStockUploadResult> {
    const form = new FormData()
    form.append('file', file, file.name)
    form.append('contentHash', contentHash)
    form.append('reason', reason)
    return api.upload<HybrisStockUploadResult>('HybrisStockWeb/Materials/Upload/Commit', form)
  },

  /** GET HybrisStockWeb/Materials/Download — the whole list as a file, in the shape an upload reads back. */
  download(): Promise<FileResponse> {
    return api.blob('HybrisStockWeb/Materials/Download')
  },
}

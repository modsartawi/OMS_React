/**
 * The material detail's own server call (ticket 452, BackOffice spec 2544): the master, barcodes and
 * batches of one material. The Stock tab's door is shared with the stock check and lives in
 * `@/core/materials/stock`; the access probe is the area's one, in `@/core/materials/api`.
 *
 * Through `@/core/api` (`api-envelope`). An unknown material is `MAT-00001` (404) — an `ApiError`
 * the page branches on with `apiErrorCode`. The door is BackOffice 2547; its
 * contract is `C:\Work\DMSCO\BackOffice\.issues\assets\2544-material-web-door-contract.md`. The
 * stubbed drive pins the screen; `tools/materials-live-drive.mjs` meets the real door (ticket 455).
 */
import { api } from '@/core/api'
import type { MaterialDetail } from '@/core/models/materials'

export const materialDetailApi = {
  /**
   * `GET MaterialWeb/Material/{materialNumber}` → `{ master, barcodes, batches }`. The number is a
   * path segment, sent as the string it is (leading zeros kept) and encoded. `null` when the
   * answer carries no master — a shape the page reports as a failure, never as an empty record.
   */
  async material(materialNumber: string): Promise<MaterialDetail | null> {
    const data = await api.get<MaterialDetail | null>(`MaterialWeb/Material/${encodeURIComponent(materialNumber)}`)
    if (!data || typeof data !== 'object' || !data.master) return null
    return { master: data.master, barcodes: data.barcodes ?? [], batches: data.batches ?? [] }
  },
}

/** The detail's query: keyed on the number, never retried (a 404 is an answer, not an outage). */
export function materialDetailQuery(materialNumber: string) {
  return {
    queryKey: ['materials', 'detail', materialNumber] as const,
    queryFn: () => materialDetailApi.material(materialNumber),
    retry: false,
    staleTime: 60_000,
  } as const
}

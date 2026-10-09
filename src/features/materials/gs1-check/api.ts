/**
 * The GS1 check's server calls (ticket 454, BackOffice spec 2544): check a batch of raw scans, and
 * read one unit's sale/return history.
 *
 * Through `@/core/api` (`api-envelope`). 🚩 Neither door is built yet (BackOffice 2549); both are
 * written against the door contract,
 * `C:\Work\DMSCO\BackOffice\.issues\assets\2544-material-web-door-contract.md`, and the drive stubs
 * them; ticket 455 meets the real ones.
 */
import { api } from '@/core/api'
import type { Gs1CheckAnswer, Gs1HistoryRow } from '@/core/models/materials'

/** What one unit's history is asked by. */
export interface Gs1HistoryRequest {
  material: string
  serial: string
  /** Optional: without it, the server never flags `lotMismatch`. */
  lot: string | null
}

export const gs1CheckApi = {
  /**
   * `POST MaterialWeb/Gs1/Check` with `{ codes }` (1–500 raw scans, byte for byte) → one answer
   * per code, in request order. A refusal (`MAT-00005`) arrives as an `ApiError`.
   */
  async check(codes: readonly string[]): Promise<Gs1CheckAnswer[]> {
    const data = await api.post<Gs1CheckAnswer[] | null>('MaterialWeb/Gs1/Check', { codes })
    return data ?? []
  },

  /** `GET MaterialWeb/Gs1/History?material=&serial=&lot=` → the unit's trail, oldest → newest. */
  async history(request: Gs1HistoryRequest): Promise<Gs1HistoryRow[]> {
    const data = await api.get<Gs1HistoryRow[] | null>('MaterialWeb/Gs1/History', {
      material: request.material,
      serial: request.serial,
      lot: request.lot,
    })
    return data ?? []
  },
}

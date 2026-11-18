import { api } from '@/core/api'
import type {
  BbyDeleteResult,
  BbyDownloadResult,
  BbyOverrides,
} from '@/core/models/bonus-buy-download'
import type { Permissions } from '@/core/permissions'

// Every server call goes through @/core/api (see .claude/rules/api-envelope.md):
// it unwraps the SIS.Api envelope, returns `.data`, and maps failures to ApiError.
// Consumes the BackOffice 515 slice. The client LOOPS one call per BBY number (owner
// decision, design 493) — download/delete each handle exactly one number, so one bad
// number never affects the others, and a mid-loop 502 (HANA middleware unreachable)
// surfaces as an ApiError with statusCode 502 that the Page uses to halt the loop.
const BASE = 'BonusBuyDownloadWeb'

/**
 * The screen grant (`BbyDownload:03`), off the one permissions answer (oms 914): the in-page
 * guard and the nav leaf read it. The server enforces the grant on every Download/Delete
 * regardless; this is show/hide hygiene only.
 */
export const canOpenBbyDownload = (p: Permissions): boolean => p.has('BbyDownload:03')

export const bonusBuyDownloadApi = {

  download(bbyNumber: string, attributes: BbyOverrides): Promise<BbyDownloadResult> {
    return api.post<BbyDownloadResult>(`${BASE}/Download`, { bbyNumber, attributes })
  },

  delete(bbyNumber: string): Promise<BbyDeleteResult> {
    return api.post<BbyDeleteResult>(`${BASE}/Delete`, { bbyNumber })
  },
}

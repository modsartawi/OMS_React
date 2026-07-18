import { api } from '@/core/api'
import type {
  BbyDeleteResult,
  BbyDownloadAccessResult,
  BbyDownloadResult,
  BbyOverrides,
} from '@/core/models/bonus-buy-download'

// Every server call goes through @/core/api (see .claude/rules/api-envelope.md):
// it unwraps the SIS.Api envelope, returns `.data`, and maps failures to ApiError.
// Consumes the BackOffice 515 slice. The client LOOPS one call per BBY number (owner
// decision, design 493) — download/delete each handle exactly one number, so one bad
// number never affects the others, and a mid-loop 502 (HANA middleware unreachable)
// surfaces as an ApiError with statusCode 502 that the Page uses to halt the loop.
const BASE = 'BonusBuyDownloadWeb'

export const bonusBuyDownloadApi = {
  // Screen-open grant probe. Drives BOTH the in-page route-guard (the "denied" card)
  // AND the shell's permission-aware nav hiding (issue 429) — the shell's probe shares
  // this exact ['bonus-buy-download','access'] cache entry, so it's one call, not two.
  // The server enforces the grant on every Download/Delete regardless; the menu hide
  // is show/hide hygiene only.
  access(): Promise<BbyDownloadAccessResult> {
    return api.get<BbyDownloadAccessResult>(`${BASE}/Access`)
  },

  download(bbyNumber: string, attributes: BbyOverrides): Promise<BbyDownloadResult> {
    return api.post<BbyDownloadResult>(`${BASE}/Download`, { bbyNumber, attributes })
  },

  delete(bbyNumber: string): Promise<BbyDeleteResult> {
    return api.post<BbyDeleteResult>(`${BASE}/Delete`, { bbyNumber })
  },
}

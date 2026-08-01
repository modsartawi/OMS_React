/**
 * The authorizations feature's server calls (spec 209, frozen contract v1.0
 * §1.1). Every one goes through `@/core/api` (`.claude/rules/api-envelope.md`):
 * the envelope, the three-way error taxonomy and 401 are that module's, and 401
 * in particular is never caught here.
 *
 * The door is `Nphies/*` — one tag, one grant filter, one probe (§1). The probe
 * and the providers lookup both live in `@/core/nphies/api` because the whole
 * area shares them.
 *
 * ⚠️ **The endpoint does not exist yet.** SIS.Api maps exactly one Nphies route
 * today (`POST Nphies/CheckEligibility`, §1's verified note); the re-modelled
 * authorization list is BackOffice 913's half of this slice. Until it lands the
 * screen is verified against stubbed envelopes
 * (`tools/nphies-authorizations-drive.mjs`) built from the contract's own shapes
 * — the same code-complete / runtime-blocked posture 211–213 shipped under.
 */
import { api } from '@/core/api'
import type { AuthListRow, NphiesPage } from '@/core/models/nphies'

export const authorizationsApi = {
  /**
   * `GET Nphies/AuthResponses` (§1.1 #5, §3.3) — the list, **re-modelled** rather
   * than proxied.
   *
   * 🚩 One of only two endpoints in the whole contract that SIS.Api re-models:
   * upstream answers a `Take(20000)` ordered by `RowIndex` descending
   * (`AuthService.cs:1401`), so **sort, page and total are the server's** and this
   * call is the one place the browser trusts them.
   *
   * The params object is built by the pure `buildAuthListParams` — the window, the
   * six filters and `showAll` all live there, and nothing on this function decides
   * what narrows the read.
   */
  list(params: Record<string, unknown>): Promise<NphiesPage<AuthListRow>> {
    return api.get<NphiesPage<AuthListRow>>('Nphies/AuthResponses', params)
  },
}

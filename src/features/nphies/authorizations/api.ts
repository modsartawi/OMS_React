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
import type {
  AuthCancellationRequest,
  AuthCancellationResult,
  AuthListRow,
  AuthRetryResult,
  AuthStatusCheckResult,
  NphiesPage,
} from '@/core/models/nphies'

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

  /**
   * `POST Nphies/StatusCheck` (§1.1 #7, §3.6) — the manual escalation for a
   * `Pending` row that has waited too long.
   *
   * 🚩 It is **not a poll**. The service's own `PollRequestWorker` sweeps every 15
   * seconds, so a pending authorization becomes complete on its own; this act is
   * what an agent presses when it has not. Nothing on this screen sets a
   * `refetchInterval`.
   *
   * `reference` is the authorization **id** — `CancellationService.cs:108` matches
   * it as `c.Id`, not as the payer's preauth reference.
   */
  statusCheck(reference: string): Promise<AuthStatusCheckResult> {
    return api.post<AuthStatusCheckResult>('Nphies/StatusCheck', { reference })
  },

  /**
   * `POST Nphies/Retry` (§1.1 #8, §3.6) — re-POST the stored request payload
   * verbatim and take the newer answer.
   *
   * 🚩 **Offered on `Pending` only** (`row-acts.ts` carries the correction), and
   * 🚩 **`referenceId` is the only field the browser sends**: `referenceType`,
   * `staffId` and `storeCode` are the server's (law 7 / §1.3), pinned and stamped
   * from the session. A body that carried them would be the browser asserting an
   * identity — SIS.Api overwrites them, and sending them anyway would say this
   * client believes otherwise.
   */
  retry(referenceId: string): Promise<AuthRetryResult> {
    return api.post<AuthRetryResult>('Nphies/Retry', { referenceId })
  },

  /**
   * `POST Nphies/Cancellation` (§1.1 #9, §3.6) — withdraw a completed,
   * undispensed authorization.
   *
   * `claimType` and `staffId` are absent for the retry's reason. What is left is
   * genuinely the agent's: the row's `reference` and `providerCode`, the chosen
   * `reasonCode`, and `nullify`, which is always `false` — the upstream refuses a
   * nullify outright and SIS.Api forwards the flag as asked rather than quietly
   * downgrading it to an ordinary cancellation.
   */
  cancel(body: AuthCancellationRequest): Promise<AuthCancellationResult> {
    return api.post<AuthCancellationResult>('Nphies/Cancellation', body)
  },
}

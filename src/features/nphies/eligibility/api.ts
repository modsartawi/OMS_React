/**
 * The eligibility feature's server calls (spec 209, frozen contract v1.0 §1.1).
 * Every one goes through `@/core/api` (`.claude/rules/api-envelope.md`): the
 * envelope, the three-way error taxonomy and 401 are that module's, and 401 in
 * particular is never caught here.
 *
 * The door is `Nphies/*` — one tag, one grant filter, one probe (§1). The probe
 * itself lives in `@/core/nphies/api` because the whole area shares it.
 *
 * ⚠️ **What ships today** (§1, verified 2026-08-01): SIS.Api maps exactly one
 * route, `POST Nphies/CheckEligibility`, with an API-key filter and **no grant
 * filter at all**. Closing that is BackOffice 912's half of this slice; the other
 * three calls below are new. Until they land the screen is verified against
 * stubbed envelopes (`tools/nphies-eligibility-drive.mjs`) — the same
 * code-complete / runtime-blocked posture the call-centre and BBY slices shipped
 * under.
 */
import { api } from '@/core/api'
import type {
  EligibilityCheckRequest,
  EligibilityCheckResponse,
  EligibilityListRow,
  LastEligibility,
  NphiesPage,
} from '@/core/models/nphies'

// ⚠️ The **providers lookup** is no longer here. It moved to `@/core/nphies/api`
// at ticket 214, when the authorization list became its third consumer: a feature
// may never import another feature's `api.ts`, and the three screens must share
// ONE cached call rather than three. Import `PROVIDERS_KEY` / `nphiesLookupApi`
// from `@/core/nphies/api`.

export const eligibilityApi = {
  /**
   * `GET Nphies/LastEligibility/{patientId}` (§1.1 #2, §3.2) — what **Fill**
   * completes a cold form from. `null` when this patient has never been checked,
   * which is an ordinary answer and not a failure.
   *
   * It takes the patient id and nothing else: this supersedes WPF's row-driven
   * `NewWithRefCommand` rather than deferring it, so it must work from the id an
   * agent was given on the phone.
   */
  lastEligibility(patientId: string): Promise<LastEligibility | null> {
    return api.get<LastEligibility | null>(
      `Nphies/LastEligibility/${encodeURIComponent(patientId)}`,
    )
  },

  /**
   * `POST Nphies/CheckEligibility` (§1.1 #1, §3.1) → the header response plus
   * every coverage the patient holds.
   *
   * 🚩 **A "not eligible" answer is a 200 with `success: true`** — law 5, kind 1:
   * a payer's answer is DATA and it renders. The two axes are derived from it
   * (`@/core/nphies/status`); only a guardrail refusal
   * (`PROVIDER_NOT_CONFIGURED`, `PAYER_NOT_CONFIGURED`) arrives as an `ApiError`,
   * and only a transport failure is an error.
   */
  check(body: EligibilityCheckRequest): Promise<EligibilityCheckResponse> {
    return api.post<EligibilityCheckResponse>('Nphies/CheckEligibility', body)
  },

  /**
   * `GET Nphies/EligibilityResponses` (§1.1 #3, §3.3) — the list, **re-modelled**
   * rather than proxied.
   *
   * 🚩 This is one of only two endpoints in the whole contract that SIS.Api
   * re-models, and the only genuinely new logic in the proxy: upstream answers a
   * `Take(20000)` with the ordering commented out, so **sort, page and total are
   * the server's** and this call is the one place the browser trusts them.
   *
   * The params object is built by the pure `buildEligibilityListParams` — the
   * window, the five filters and `showAll` all live there, and nothing on this
   * function decides what narrows the read.
   */
  list(params: Record<string, unknown>): Promise<NphiesPage<EligibilityListRow>> {
    return api.get<NphiesPage<EligibilityListRow>>('Nphies/EligibilityResponses', params)
  },

  /**
   * `GET Nphies/EligibilityResponse/{id}` (§1.1 #4, §3.4) — one stored response
   * **with every coverage the patient holds**, which the list projection does not
   * carry.
   *
   * 🚩 It answers the same `EligibilityResponse` DTO the check act does, which is
   * why the type is shared rather than copied: the detail is the check's answer
   * read back days later, and a second model would let the two drift on exactly
   * the fields (`coverages`, `notInForceReason`) the detail exists to show.
   *
   * This is what makes the eligibility → authorization seam a **route carrying an
   * id** rather than a shared object (spec 209 §1): the form fetches the check by
   * id, so it can be raised days later from a row on the list.
   */
  response(id: string): Promise<EligibilityCheckResponse> {
    return api.get<EligibilityCheckResponse>(
      `Nphies/EligibilityResponse/${encodeURIComponent(id)}`,
    )
  },
}

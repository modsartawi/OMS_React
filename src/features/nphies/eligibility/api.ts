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
  NphiesProvider,
} from '@/core/models/nphies'

/** The providers lookup, keyed by nothing: it is the same list for every agent
 *  (the service scopes it to distribution channel `20` server-side). */
export const PROVIDERS_KEY = ['nphies', 'providers'] as const

export const eligibilityApi = {
  /**
   * `GET Nphies/Providers` (§1.1 #12) → the providers the agent may act for.
   *
   * 🚩 **Already filtered to unblocked upstream** (`CoreService.GetProviders`
   * filters `IsBlocked == false`), so nothing here re-filters — and WPF's
   * disabled-combo-holding-a-null-provider trap cannot occur, because a blocked
   * provider is never in the list to begin with.
   */
  providers(): Promise<NphiesProvider[]> {
    return api.get<NphiesProvider[]>('Nphies/Providers')
  },

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
}

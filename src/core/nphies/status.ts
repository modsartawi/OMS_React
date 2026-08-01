/**
 * The two status axes (spec 209 §5, contract v1.0 §5) — **Request** (did we get
 * an answer at all) and **Verdict** (what they said). The same pair on both
 * lists, both details and the check result, so an agent learns one vocabulary
 * and not two.
 *
 * It lives in `core/` rather than in the eligibility feature because the
 * *authorizations* feature (214) renders the same pair over a second value set,
 * and a feature may never import another feature
 * (`.claude/rules/feature-structure.md`). That is the boundary rule's own remedy,
 * applied at the first consumer rather than one ticket late.
 *
 * Pure: no React, no i18n, no `@/core/api`. It returns **key suffixes**, never
 * sentences — the label is the screen's `t()` call, per the zero-literal rule.
 */

import type { EligibilityCheckResponse } from '@/core/models/nphies'
import type { Severity } from '@/core/ui/severity'

/**
 * Axis one. Four values, fixed by contract §5, identical for an eligibility check
 * and an authorization.
 *
 * ⚠️ `cancelled` is unreachable on an **eligibility**: there is no cancel act on
 * a check and no field on `EligibilityResponse` to carry one. It is in the type
 * because the axis is one vocabulary and 215's cancel lands on the other side of
 * it — not because this module will ever return it here.
 */
export type RequestState = 'cancelled' | 'failed' | 'pending' | 'complete'

/** Axis two, eligibility side: `Eligible` · `Not in force` · `Not eligible`. */
export type EligibilityVerdict = 'eligible' | 'notInForce' | 'notEligible'

/**
 * What the NPHIES `siteEligibility` extension says about *this* site, folded into
 * the verdict inline at result time ("Eligible · outside network") rather than
 * discovered later when a button refuses.
 *
 * `eligible` is not a member: a site that is plainly eligible qualifies nothing,
 * and a qualifier that says "and nothing is wrong" is noise in the one cell the
 * agent reads first.
 */
export type SiteQualifier = 'outsideNetwork' | 'notDirectBilling'

export interface EligibilityAxes {
  request: RequestState
  /** **Blank until `request` is `complete`** (§5) — a request that never reached
   *  the payer has no verdict to report. */
  verdict: EligibilityVerdict | null
  /** Never set without a `verdict`: it qualifies one, it is not a fact of its own. */
  siteQualifier: SiteQualifier | null
}

/** Lowercased, trimmed — the exchange's own spelling is not something to depend on. */
const code = (raw: string | null | undefined): string => (raw ?? '').trim().toLowerCase()

/**
 * The FHIR `RemittanceOutcome` an eligibility answer carries, mapped onto the
 * axis. `queued` is the exchange holding the question; `error` is the refusal or
 * the transport failure; `complete` and `partial` are both answers.
 *
 * 🚩 Contract gap, logged in `.afk/HITL-211.md`: §5 names `Cancelled` / `Error` /
 * `Queued` / `ClaimProcessingCodes`, which are `NAuth`'s columns.
 * `EligibilityResponse` carries `Outcome` / `Success` / `ErrorMessage` instead
 * (`Features/Eligibility/Dtos/EligibilityResponse.cs`), so the same question is
 * asked of the fields that exist.
 */
function eligibilityRequestState(response: EligibilityCheckResponse): RequestState {
  // 🚩 `success: false` outranks whatever `outcome` says, and this order is load
  // bearing. `EligibilityService` sets `Success = true` on exactly one line —
  // after a fully processed response (`:277`) — and `false` only in its catch
  // (`:293`). But `Outcome` is filled at the TOP of `FillResponse` (`:670`) and
  // the exchange's own validation errors throw a few lines later (`:682`), so a
  // refused check really can arrive carrying `outcome: 'complete'` with
  // `success: false`. Reading the outcome first would render the exchange's
  // refusal as a payer verdict — law 5's two kinds of bad news, collapsed.
  if (response.success === false) return 'failed'
  switch (code(response.outcome)) {
    case 'queued':
      return 'pending'
    case 'error':
      return 'failed'
    case 'complete':
    case 'partial':
      // A partial answer IS an answer — the Verdict axis is where "what they
      // said" gets qualified. Reading it as `pending` would offer a status check
      // for a payer that has already replied.
      return 'complete'
    default:
      // No outcome and no failure: nothing has come back yet. A request still in
      // flight is `pending`, never `failed` (law 6's posture, one act earlier).
      return 'pending'
  }
}

/**
 * The verdict, once there is an answer to have one.
 *
 * `isEligible` is the service's own `Success && Inforce && Coverage`
 * (`EligibilityService.cs:278`), so it is read rather than recomputed. When it is
 * false, `inforce` is what separates *the policy is not in force* (the case that
 * carries `NotInForceReason`) from *not eligible* for any other reason.
 */
function eligibilityVerdict(response: EligibilityCheckResponse): EligibilityVerdict {
  if (response.isEligible) return 'eligible'
  return response.inforce ? 'notEligible' : 'notInForce'
}

const SITE_QUALIFIERS: Record<string, SiteQualifier> = {
  'outside-network': 'outsideNetwork',
  outsidenetwork: 'outsideNetwork',
  'not-direct-billing': 'notDirectBilling',
  notdirectbilling: 'notDirectBilling',
}

/**
 * Both axes of one eligibility check, derived from the raw response.
 *
 * 🚩 The blank-verdict rule is enforced **here**, not at the render site: the row
 * carries `IsEligible` whatever happened, so a screen that read that column
 * directly would tell an agent a payer said yes to a question the payer never
 * saw.
 */
export function deriveEligibilityAxes(response: EligibilityCheckResponse): EligibilityAxes {
  const request = eligibilityRequestState(response)
  if (request !== 'complete') return { request, verdict: null, siteQualifier: null }
  return {
    request,
    verdict: eligibilityVerdict(response),
    siteQualifier: SITE_QUALIFIERS[code(response.siteEligibility)] ?? null,
  }
}

/**
 * The verdict cell as **one** cell: the i18n key suffixes to render side by side
 * inside a single badge, in order. Empty while the verdict is blank.
 *
 * This is what makes "Eligible · outside network" one qualified verdict rather
 * than two separate facts — the caller joins these, it never decides whether the
 * site fact belongs somewhere else on the screen.
 */
export function verdictCellKeys(axes: EligibilityAxes): string[] {
  if (!axes.verdict) return []
  const keys = [`verdict.${axes.verdict}`]
  if (axes.siteQualifier) keys.push(`site.${axes.siteQualifier}`)
  return keys
}

/**
 * May the act's message field be rendered, and therefore: is it a *failure*
 * message?
 *
 * 🚩 Contract §5's trap. The field carries a transport error **or** the decoded
 * adjudication display depending on branch, so the Request state picks both the
 * label and the source: `Failed`/`Pending` render it under "could not reach the
 * payer"; `Complete` **never renders it at all** — the payer's words come from
 * the disposition and the per-line reasons. A neutral "Message" label would
 * re-conflate exactly what the two axes exist to keep apart.
 */
export function showsFailureMessage(request: RequestState): boolean {
  return request === 'failed' || request === 'pending'
}

/**
 * Request state → severity, for the one badge in the app (`@/core/ui/severity`).
 *
 * `complete` is `ok` — we got an answer, whatever it says. `pending` is `go`,
 * actively in motion: the service's own worker polls the exchange every 15 s, so
 * waiting is the normal path to a verdict rather than a problem. `failed` ended
 * badly. `cancelled` is a neutral resting position, not a bad outcome.
 */
export function requestSeverity(request: RequestState): Severity {
  if (request === 'complete') return 'ok'
  if (request === 'pending') return 'go'
  if (request === 'failed') return 'bad'
  return 'mute'
}

/**
 * Eligibility verdict → severity. `notInForce` is `warn` rather than `bad`: the
 * policy exists and its dates or its status are what is wrong, which is a thing
 * a human can act on (and `NotInForceReason` says how). `notEligible` is the
 * payer's flat no.
 *
 * The **site qualifier deliberately does not change the severity** — an eligible
 * patient at an out-of-network site is still eligible, and painting the badge red
 * would say something the payer did not.
 */
export function eligibilityVerdictSeverity(verdict: EligibilityVerdict): Severity {
  if (verdict === 'eligible') return 'ok'
  return verdict === 'notInForce' ? 'warn' : 'bad'
}

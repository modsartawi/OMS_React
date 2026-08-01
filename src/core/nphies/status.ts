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
 * Axis two, **authorization** side (214): `Approved` · `Partly approved` ·
 * `Rejected` · `No approval needed`, per §5.
 *
 * This is the whole of what differs between the two lists. Request is one
 * vocabulary and one derivation; only the verdict's value set changes, which is
 * why 214 reuses this module rather than growing a second one.
 */
export type AuthVerdict = 'approved' | 'partlyApproved' | 'rejected' | 'noApprovalNeeded'

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

/**
 * The whole Request vocabulary, in the order §5 lists it. Exported so a filter
 * control offers exactly the axis's values and cannot drift from the type.
 */
export const REQUEST_STATES: readonly RequestState[] = ['cancelled', 'failed', 'pending', 'complete']

/**
 * The Request values a row of the **eligibility list** can actually take, and
 * therefore the only ones its filter offers.
 *
 * Two, not four. `cancelled` is unreachable because there is no cancel act on an
 * eligibility check and no field to carry one; `pending` is unreachable because
 * the state is not persisted at all — see `deriveStoredEligibilityAxes`. A filter
 * option that can never match is worse than no option: it reads as *"there are
 * none this week"* rather than *"this cannot happen"*, and sends the agent to
 * widen a window that will not help.
 *
 * 214 offers `REQUEST_STATES` in full, where the cancel act exists and
 * `ClaimProcessingCodes` is a real column.
 */
export const ELIGIBILITY_LIST_REQUEST_STATES: readonly RequestState[] = ['failed', 'complete']

/** The eligibility Verdict vocabulary, same purpose as above. */
export const ELIGIBILITY_VERDICTS: readonly EligibilityVerdict[] = [
  'eligible',
  'notInForce',
  'notEligible',
]

/**
 * The authorization Verdict vocabulary, in §5's order.
 *
 * Unlike the eligibility list, the authorization list offers `REQUEST_STATES` in
 * **full**: `Cancelled` is a real column (`NAuth.Cancelled`, set by
 * `CancellationService`) and `Queued`/`ClaimProcessingCodes` are persisted, so all
 * four Request values are reachable on a stored row here.
 */
export const AUTH_VERDICTS: readonly AuthVerdict[] = [
  'approved',
  'partlyApproved',
  'rejected',
  'noApprovalNeeded',
]

export interface EligibilityAxes {
  request: RequestState
  /** **Blank until `request` is `complete`** (§5) — a request that never reached
   *  the payer has no verdict to report. */
  verdict: EligibilityVerdict | null
  /** Never set without a `verdict`: it qualifies one, it is not a fact of its own. */
  siteQualifier: SiteQualifier | null
}

/**
 * The five raw fields both axes are derived from — and **the only** contract this
 * module has with its callers.
 *
 * It is a structural subset rather than `EligibilityCheckResponse` because 212's
 * list row is a different projection of the same record (`EligibilityResponse`
 * minus the coverages, minus `NotInForceReason` — see
 * `EligibilityService.cs:1003`), and the axes must come out identical from both.
 * Naming the five fields is what makes "the same pair on both lists and both
 * details" (§5) a type, rather than a promise.
 *
 * `outcome` is **optional**, and that is not defensiveness — see
 * `eligibilityRequestState`.
 */
export interface EligibilityAxisSource {
  outcome?: string | null
  success: boolean
  inforce: boolean
  isEligible: boolean
  siteEligibility?: string | null
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
function eligibilityRequestState(response: EligibilityAxisSource): RequestState {
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
      //
      // 🚩 This branch IS reachable on a live check, and reading it as `complete`
      // would be a §5 violation. `FillResponse` sets `Outcome` only inside
      // `if (eligibilityResponse != null)` (`EligibilityService.cs:667-670`) —
      // i.e. only when the bundle actually carried a `CoverageEligibilityResponse`
      // — while `eResponse.Success = true` is set unconditionally after it returns
      // (`:277`). So a bundle with no response resource arrives here saying
      // success with no outcome, and calling that `Complete` would publish a
      // verdict derived from `isEligible: false` for an answer the payer never
      // gave.
      //
      // A **stored** row is a different question and has its own entry point —
      // see `deriveStoredEligibilityAxes`.
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
function eligibilityVerdict(response: EligibilityAxisSource): EligibilityVerdict {
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
 * Both axes of one eligibility act, derived from the raw fields — a fresh check
 * response (211) or a stored list row (212), which is why the parameter is the
 * five-field `EligibilityAxisSource` and not either screen's model.
 *
 * 🚩 The blank-verdict rule is enforced **here**, not at the render site: the row
 * carries `IsEligible` whatever happened, so a screen that read that column
 * directly would tell an agent a payer said yes to a question the payer never
 * saw.
 */
export function deriveEligibilityAxes(response: EligibilityAxisSource): EligibilityAxes {
  const request = eligibilityRequestState(response)
  if (request !== 'complete') return { request, verdict: null, siteQualifier: null }
  return {
    request,
    verdict: eligibilityVerdict(response),
    siteQualifier: SITE_QUALIFIERS[code(response.siteEligibility)] ?? null,
  }
}

/**
 * Both axes of one **stored** eligibility — a row of the list (212) — which is a
 * genuinely different question from a live check response, because the record
 * carries less than the answer did.
 *
 * 🚩 `NEligibility` has **no `Outcome` column** (`Data/Eligibility/NEligibility.cs`,
 * read 2026-08-02). The value is filled from the live FHIR bundle at
 * `EligibilityService.cs:670` and never persisted, so the list's rows arrive
 * without it and the live derivation's "no outcome ⇒ still in flight" reading
 * would report every completed check in the estate as waiting, forever.
 *
 * What survives is `Success`, and it is trustworthy in exactly one direction:
 * `nEligibility.Success = true` is written on ONE line (`:282`), after
 * `FillResponse` ran to completion, and the catch never writes it (`:293` sets
 * the *response*, leaving the row's default `false`). So on a stored row,
 * success is `Complete` and its absence is `Failed`.
 *
 * ⚠️ **`Pending` is therefore unreachable on a stored row**, and that is a real
 * loss rather than a simplification: a check the exchange answered `queued` is
 * stored as `Success = true` and reads `Complete` here, while the check result
 * that produced it read `Pending`. The queued-ness is not persisted and no client
 * can recover it. Named as a contract gap in `.afk/HITL-212.md`.
 *
 * If SIS.Api's re-modelled row ever *does* project an outcome, this defers to it
 * — which is why the parameter is the same source type and the delegation is one
 * line.
 */
export function deriveStoredEligibilityAxes(row: EligibilityAxisSource): EligibilityAxes {
  if (code(row.outcome) !== '') return deriveEligibilityAxes(row)
  if (row.success !== true) return { request: 'failed', verdict: null, siteQualifier: null }
  return {
    request: 'complete',
    verdict: eligibilityVerdict(row),
    siteQualifier: SITE_QUALIFIERS[code(row.siteEligibility)] ?? null,
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

// ---------------------------------------------------------------------------
// The authorization side (ticket 214). Same two axes, same Request vocabulary,
// same blank-until-Complete rule — only the Verdict's value set differs, which
// is the whole reason this module is shared rather than copied.
// ---------------------------------------------------------------------------

/**
 * The raw fields an authorization's axes are derived from — and **the only**
 * contract this half of the module has with its callers.
 *
 * Every name is a property of `AuthForListDto`
 * (`Features/Auth/AuthsDtos/AuthForListDto.cs`, read 2026-08-02) in camelCase.
 * A structural subset rather than the row model, for the eligibility side's
 * reason: 216's detail is a different projection of the same record
 * (`AuthHeaderDto`, which carries the same five), and the axes must come out
 * identical from both.
 */
export interface AuthAxisSource {
  /** `NAuth.Cancelled` — set by `CancellationService` after a successful cancel. */
  cancelled: boolean
  /** `NAuth.Error` — `claimResponse.Outcome == ClaimProcessingCodes.Error`. */
  error: boolean
  /** `NAuth.Queued` — `claimResponse.Outcome == ClaimProcessingCodes.Queued`. */
  queued: boolean
  /** The FHIR outcome as stored: `Queued` · `Error` · `Complete` · `Partial`. */
  claimProcessingCodes?: string | null
  /** `approved` · `partial` · `rejected` · `not-required`, from the NPHIES
   *  adjudication-outcome extension. */
  adjudicationOutcome?: string | null
}

export interface AuthAxes {
  request: RequestState
  /** **Blank until `request` is `complete`** (§5) — a request that never reached
   *  the payer has no verdict to report. */
  verdict: AuthVerdict | null
}

/**
 * Axis one for an authorization, from the four sources §5 names.
 *
 * The order is precedence, not preference:
 *
 * - **`Cancelled` first.** A cancel happens *after* an answer
 *   (`CancellationService` refuses anything else), so a cancelled authorization
 *   still carries `ClaimProcessingCodes = "Complete"` and an approval. Reading the
 *   outcome first would show a withdrawn request as live — and 215 offers Cancel
 *   on exactly the rows this branch is what removes.
 * - **`Error` next.** 🚩 §5: `Failed` means the request was refused *before the
 *   payer saw it*, by NPHIES's own validation or by the service's local guards.
 *   It is a form state the agent fixes in place, never a payer verdict.
 * - **`Queued` next** — the exchange is holding the question, and the service's
 *   own worker will pick the answer up within 15 seconds.
 * - **Then the stored outcome**, for a row whose booleans were never written
 *   (`ProcessAddAuthRequest.cs:182-184` has them commented out, so a
 *   just-submitted row can carry the code alone).
 *
 * The no-outcome default is `pending`, matching the eligibility side and law 6's
 * posture: a request we have no answer for is in flight, never failed. Unlike an
 * eligibility, `ClaimProcessingCodes` **is** a persisted column
 * (`NAuthMap.cs:36`), so a stored authorization row needs no second entry point —
 * one derivation reads a list row and a detail alike.
 */
function authRequestState(row: AuthAxisSource): RequestState {
  if (row.cancelled === true) return 'cancelled'
  if (row.error === true) return 'failed'
  if (row.queued === true) return 'pending'
  switch (code(row.claimProcessingCodes)) {
    case 'queued':
      return 'pending'
    case 'error':
      return 'failed'
    case 'complete':
    case 'partial':
      // A partial answer IS an answer — `Partly approved` is a Verdict, not a
      // half-arrived request. Reading it as `pending` would offer a status check
      // for a payer that has already replied.
      return 'complete'
    default:
      return 'pending'
  }
}

/** The NPHIES adjudication-outcome codes, as the extension spells them. */
const AUTH_VERDICTS_BY_CODE: Record<string, AuthVerdict> = {
  approved: 'approved',
  partial: 'partlyApproved',
  rejected: 'rejected',
  'not-required': 'noApprovalNeeded',
  notrequired: 'noApprovalNeeded',
}

/**
 * Both axes of one authorization (§5). The Verdict is **blank until Complete**,
 * enforced here rather than at the render site for the eligibility side's reason:
 * the row carries `AdjudicationOutcome` whatever happened to the request.
 *
 * An unrecognised outcome on a `Complete` row also reads blank rather than being
 * coerced to a nearby value — inventing `Approved` from a code we do not know is
 * the one error on this screen that costs money.
 */
export function deriveAuthAxes(row: AuthAxisSource): AuthAxes {
  const request = authRequestState(row)
  if (request !== 'complete') return { request, verdict: null }
  return { request, verdict: AUTH_VERDICTS_BY_CODE[code(row.adjudicationOutcome)] ?? null }
}

/**
 * The two **row markers** (§5) — neither of them an axis value, and that is the
 * point.
 *
 * - **`needComm`, the payer query.** The payer raises it asynchronously, so it can
 *   land on an authorization that already has both a Request state and a Verdict
 *   — which is exactly why it cannot be a value of either. It is **required, not
 *   decorative**: answering a payer query is out of v1, so such an authorization
 *   *stalls on the web* and the agent must be able to see that the row now needs
 *   the till application.
 * - **`isDispensed`.** The row's end of life, owned by the till and true only
 *   after a verdict.
 *
 * 🚩 There is deliberately **no `readyToDispense`**. The real predicate lives in
 * the service's `Dispense()` and its `HasFollowUp` clause is absent from
 * `AuthForListDto`, so a browser copy could only lie on some rows. The reader
 * infers it from what is already visible: `Complete`, a good verdict, no
 * dispensed marker.
 */
export interface AuthRowMarkers {
  payerQuery: boolean
  dispensed: boolean
}

export function authRowMarkers(row: { needComm: boolean; isDispensed: boolean }): AuthRowMarkers {
  return { payerQuery: row.needComm === true, dispensed: row.isDispensed === true }
}

/**
 * Authorization verdict → severity, for the one badge in the app.
 *
 * `partlyApproved` is `warn`: something on the request was refused and the agent
 * has to look, but it is not the flat no `rejected` is. `noApprovalNeeded` is
 * `mute` — a neutral resting position, not a win and not a loss.
 */
export function authVerdictSeverity(verdict: AuthVerdict): Severity {
  if (verdict === 'approved') return 'ok'
  if (verdict === 'partlyApproved') return 'warn'
  return verdict === 'rejected' ? 'bad' : 'mute'
}

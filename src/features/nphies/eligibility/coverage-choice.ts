/**
 * Which policy an authorization is raised under, and the seam that carries it
 * (ticket 213, spec 209 §1 + stories 18–21, contract v1.0 §3.1 / §7.1).
 *
 * Pure: no React, no i18n, no network. The detail page is a controlled shell over
 * this module — which is what makes the pick rule and the seam testable with no
 * React Testing Library in the repo (spec 209's tier-1 ruling).
 *
 * 🚩 **Choosing a policy is choosing which member id an authorization is raised
 * under.** There is no coverage id in the request: §7.1's `Open` takes
 * `{ eligibilityId, memberId }`. So everything below resolves to a member id, and
 * an act that cannot produce one is withheld here rather than failing on the form
 * the agent has just been sent to.
 *
 * 🚩 **The rule is keyed on the COUNT, not on in-force.** A lone expired coverage
 * is auto-selected exactly like a live one — the Verdict column is what tells the
 * agent it is not in force, and asking them to choose between one option would say
 * the same thing worse (spec 209 story 21).
 */

import type { EligibilityCoverage } from '@/core/models/nphies'

/**
 * The resolved selection.
 *
 * `index` rather than the member id is the pick token, and that is deliberate:
 * `EligibilityCoverageResponse.MemberId` is nullable and nothing guarantees it is
 * unique across a patient's policies, so a picker keyed on it could not tell two
 * blank-id coverages apart. The member id is what the *seam* carries, not what
 * the picker holds. (`.afk/HITL-213.md`.)
 */
export interface CoveragePick {
  /** Position in the response's `coverages`, or `null` when nothing is selected. */
  index: number | null
  /** The selected coverage's member id, trimmed. `''` when nothing is selected —
   *  or when the selected coverage carries none, which is its own blocker. */
  memberId: string
}

/** Why **Raise authorization** is withheld. Each one names a fact the agent can see. */
export type RaiseBlocker = 'noCoverages' | 'pickCoverage' | 'noMemberId'

const NOTHING: CoveragePick = { index: null, memberId: '' }

const text = (raw: string | null | undefined) => (raw ?? '').trim()

/**
 * Is the agent being made to choose?
 *
 * **Two or more.** One is auto-selected and none has nothing to offer, so in both
 * of those cases the picker is not merely defaulted — it does not exist. A
 * control that can only be satisfied one way is a click the 99% case should not
 * have to pay.
 */
export function coveragePickerIsShown(coverages: EligibilityCoverage[]): boolean {
  return coverages.length >= 2
}

/**
 * The selection, from the coverages and whatever the agent has clicked.
 *
 * - **Exactly one → index 0, always.** `picked` is ignored: there is no state in
 *   which a lone coverage is unselected, so a stale or out-of-range click cannot
 *   produce one.
 * - **Two or more → `picked`, and nothing else.** No default, no clamp, no
 *   fallback to the first row. An out-of-range index resolves to *no pick*
 *   rather than to somebody's other policy — a clamp here would silently answer
 *   the one question this ticket exists to ask.
 * - **None → nothing.**
 */
export function resolveCoveragePick(
  coverages: EligibilityCoverage[],
  picked: number | null,
): CoveragePick {
  if (coverages.length === 0) return NOTHING
  if (coverages.length === 1) return { index: 0, memberId: text(coverages[0].memberId) }
  if (picked === null || !Number.isInteger(picked) || picked < 0 || picked >= coverages.length) {
    return NOTHING
  }
  return { index: picked, memberId: text(coverages[picked].memberId) }
}

/**
 * Every reason the raise is held, in the order the agent meets them. Empty =
 * raisable.
 *
 * 🚩 **The verdict is not one of them.** A not-in-force or not-eligible check can
 * still raise: the ticket keys the rule on the count, and nothing in the spec or
 * the contract makes a payer's answer a precondition of asking for approval.
 * Gating on it would be the screen deciding something the payer already told the
 * agent in a column they can read (`.afk/HITL-213.md`).
 */
export function raiseBlockers(
  coverages: EligibilityCoverage[],
  pick: CoveragePick,
): RaiseBlocker[] {
  if (coverages.length === 0) return ['noCoverages']
  if (pick.index === null) return ['pickCoverage']
  if (pick.memberId === '') return ['noMemberId']
  return []
}

/**
 * The authorization form's route (spec 209 §1). A literal, and named rather than
 * inlined: 217 builds the other end, and when the route moves this constant and
 * its test are what fail — instead of an agent finding a dead link.
 */
export const RAISE_AUTHORIZATION_ROUTE = '/nphies/authorizations/new'

/**
 * **The seam.** `/nphies/authorizations/new?from=<eligId>&coverage=<memberId>`.
 *
 * 🚩 A route transition carrying two ids, **not a shared object** (spec 209 §1).
 * WPF carried the eligibility response in a controller field; the web fetches it
 * by id. That is what makes the two features independently buildable, and it is
 * chosen because an authorization is often raised days after the check — from a
 * row on the list rather than in the same sitting, where a wizard step would
 * serve only the same-sitting case and then need a second entry point anyway.
 *
 * `null` when either id is missing: a half-addressed URL lands on a form that
 * cannot open, so the act is rendered as withheld-with-a-reason instead of as a
 * link that looks live and is not.
 */
export function raiseAuthorizationHref(
  eligibilityId: string,
  memberId: string,
): string | null {
  const from = text(eligibilityId)
  const coverage = text(memberId)
  if (from === '' || coverage === '') return null
  const query = new URLSearchParams({ from, coverage })
  // `URLSearchParams` renders a space as `+`; the path is read back with
  // `useSearchParams`, which decodes both, but `%20` is what the rest of the app
  // produces and what the seam's test asserts.
  return `${RAISE_AUTHORIZATION_ROUTE}?${query.toString().replace(/\+/g, '%20')}`
}

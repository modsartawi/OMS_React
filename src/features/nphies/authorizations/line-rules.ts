/**
 * **The agent's five inputs, and nothing else** (ticket 218, spec 209 §4 +
 * stories 32–41, contract v1.0 §2.2 / §2.3 / §4).
 *
 * Nobody computes money in the browser. The engine computes all of it and the
 * agent supplies five inputs — header deductible rates and their caps, header
 * paid-outside, line quantity, line Max Coverage, line Days Supply — plus
 * Selection Reason, which is a code and not an amount. This module is where that
 * ruling is a *rule* rather than a habit: which fields are editable at all, the
 * one range Days Supply may hold, which lines offer a selection reason, and what
 * the cap cell says when it is handed a value the engine will silently ignore.
 *
 * Pure: no React, no i18n, no network. Every function answers a **verdict** the
 * screen renders rather than performing the act itself, which is what lets the
 * four load-bearing rules be tested with no React Testing Library in the repo
 * (spec 209's tier-1 ruling).
 *
 * 🚩 Two rules stated *where they apply* rather than discovered later:
 *
 * - **Days Supply is validated 1–100 at the cell** (§2.3), so an out-of-range
 *   value can never exist. WPF swept them at submit — silently resetting to the
 *   header default and then listing them in a warning dialog — and that sweep is
 *   **deleted, not ported**. There is no submit-time reconciliation anywhere in
 *   this repo, and the web can never hand the service a value it throws on
 *   (`AuthService.cs:405-409`).
 * - **A cap of zero will not apply.** SIS.Pos 26.4.64 ignores `<= 0` in
 *   `UpdateLineInsuranceInternalAsync`, so the till's `AllowZero = true`
 *   semantics silently do nothing under the new engine (§4). The cell **says so**
 *   rather than accepting a value that will quietly do nothing. This is an
 *   inherited asymmetry carried deliberately, not a bug fixed here.
 */

import type { NphiesSessionInsurance } from '@/core/models/nphies'

/**
 * Every field the request form draws, named once.
 *
 * The list exists so that "exactly five inputs are editable" is a statement a
 * test can make about the whole surface rather than about the fields somebody
 * remembered to check. A new field added to the projection and drawn on the
 * screen belongs here, and its owner is then a decision rather than an
 * oversight.
 */
export const REQUEST_FIELDS = [
  // --- The agent's five, plus the one code (§2.2 "in") ---------------------
  'headerDeductibleRate',
  'headerDeductibleMax',
  'headerPaidOutside',
  'lineQuantity',
  'lineMaxCoverage',
  'lineDaysSupply',
  'lineSelectionReason',
  // --- Derived, and visibly so (§2.2 "out": there is no verb for any) ------
  'lineItemNumber',
  'lineSequence',
  'lineUnitPrice',
  'lineExtendedPrice',
  'lineAmount',
  'lineNetAmount',
  'lineVat',
  'lineDiscountPercentage',
  'lineDiscountAmount',
  'lineActualPatientShare',
  'lineDeductibleG',
  'lineDeductibleGroupName',
  /** 🚩 The acting store as the pricing plant — bound at `Open` and immutable for
   *  the life of the transaction (law 8). It decides every amount in the payload
   *  and appears in none of it. */
  'plant',
] as const

export type RequestField = (typeof REQUEST_FIELDS)[number]

/**
 * **The whole editable surface.** Five inputs — the header rate block counts its
 * rate and its cap separately because they are two boxes — plus Selection Reason.
 *
 * 🚩 Nothing else on the request is an input, and the two lists above are what
 * makes that checkable. *The agent corrects the insurance terms, never the
 * merchandise or its price*: there is no item swap, no price override and no
 * discount override, and none of them is a verb in the contract either (§1.2).
 */
export const AGENT_EDITABLE_FIELDS: readonly RequestField[] = [
  'headerDeductibleRate',
  'headerDeductibleMax',
  'headerPaidOutside',
  'lineQuantity',
  'lineMaxCoverage',
  'lineDaysSupply',
  'lineSelectionReason',
]

const EDITABLE = new Set<RequestField>(AGENT_EDITABLE_FIELDS)

/** Whether the screen may draw a control for this field at all. A `false` here is
 *  a **value**, not a disabled input — story 24's ruling, applied to money. */
export function isAgentEditable(field: RequestField): boolean {
  return EDITABLE.has(field)
}

/**
 * The one range Days Supply may hold (§2.3).
 *
 * 🚩 **One range replaces WPF's three** (180 / 90 / 100, chosen by claim type and
 * reconciled at submit). v1 has one claim type and the service throws outside
 * 1–100, so the widest of the old three is refused here.
 */
export const DAYS_SUPPLY_MIN = 1
export const DAYS_SUPPLY_MAX = 100

/**
 * What a cell decided about what was typed into it.
 *
 * `unchanged` is a first-class answer rather than a silent no-op: a blur that
 * changed nothing must send no verb, because every mutating verb re-prices the
 * whole request through the engine and an idle tab-through would put a pointless
 * write in the audit trail.
 */
export type CellVerdict<TReason extends string> =
  | { kind: 'unchanged' }
  | { kind: 'refused'; reason: TReason }
  | { kind: 'send'; value: number }

export type DaysSupplyRefusal = 'notWhole' | 'outOfRange'

/**
 * Days Supply, **validated at the cell** — the header default stamps each line as
 * it lands (story 35) and this is the only way it changes afterwards.
 *
 * 🚩 An out-of-range value is refused *here*, which is what makes it impossible
 * for one to exist. The server refuses it too (`DAYS_SUPPLY_INVALID`), and that
 * is a backstop rather than the rule: the point of moving it to the cell is that
 * the agent is told while looking at the number, not after building the whole
 * request.
 */
export function daysSupplyEntry(draft: string, current: number): CellVerdict<DaysSupplyRefusal> {
  const typed = draft.trim()
  const value = Number(typed)
  if (typed === '' || !Number.isFinite(value) || !Number.isInteger(value)) {
    return { kind: 'refused', reason: 'notWhole' }
  }
  if (value === current) return { kind: 'unchanged' }
  if (value < DAYS_SUPPLY_MIN || value > DAYS_SUPPLY_MAX) {
    return { kind: 'refused', reason: 'outOfRange' }
  }
  return { kind: 'send', value }
}

export type MaxCoverageRefusal = 'notANumber' | 'negative' | 'zeroWillNotApply'

/**
 * Max Coverage — the engine's `MaxPayerShare`, agent-overridable (§4).
 *
 * It writes the payer-share cap so the deductible stays **derived** rather than
 * hand-set (story 34), and it can re-bucket sibling lines, because per-group caps
 * share a pool. So a change here re-prices more than its own row, which is why
 * the verb answers the whole state like every other.
 *
 * 🚩 **Zero is refused with a warning, not sent.** SIS.Pos ignores `<= 0`, so a
 * cap of zero would be accepted, stored, and quietly do nothing — the worst of
 * the three possible outcomes. The cell says what will happen instead.
 *
 * 🚩 `typed` is what separates *the agent asking for a zero cap* from *the
 * engine's own default of zero sitting in an untouched cell*. A deliberately
 * typed zero warns **even when the stored value is already zero** — that is the
 * exact case the rule exists for, the agent meaning "cap this at nothing" and
 * getting silence. An untouched cell warns about nothing, because a warning on
 * every row of a fresh request is a warning nobody reads.
 */
export function maxCoverageEntry(
  draft: string,
  current: number,
  typed = true,
): CellVerdict<MaxCoverageRefusal> {
  const entered = draft.trim()
  const value = Number(entered)
  if (entered === '' || !Number.isFinite(value)) return { kind: 'refused', reason: 'notANumber' }
  if (value < 0) return { kind: 'refused', reason: 'negative' }
  if (value === 0 && typed) return { kind: 'refused', reason: 'zeroWillNotApply' }
  if (value === current) return { kind: 'unchanged' }
  return { kind: 'send', value }
}

/**
 * The category on which the till has always withheld a selection reason.
 *
 * It is `deductibleGroupName`, which **IS `InsuranceItemCategory`** — the same
 * value under two names (§4) — and *not* the G1/G2/G3 bucket it reads like.
 */
export const GENERIC_CATEGORY = 'generic'

/**
 * 🚩 **Disabled on generic lines only** — exactly the rule the till applies, no
 * broader (story 37).
 *
 * `NonMed` looks like it should be excluded and is not. `Brand-IR` is the one the
 * Nphies service **overwrites at submit** with `"innovative-noGeneric"`, and
 * blanks entirely when `nItem.RemoveSelectionReason` (`AuthService.cs:418-421`) —
 * and it still offers the control, because WPF does. That quirk is reproduced
 * deliberately: someone who "fixed" it by hiding the picker would change what
 * reaches the payer.
 */
export function selectionReasonEditableForCategory(category: string): boolean {
  return category.trim().toLowerCase() !== GENERIC_CATEGORY
}

/**
 * Whether this line's Selection Reason may be picked.
 *
 * 🚩 **The projection's `selectionReasonEditable` is the authority** — §2 says it
 * is `false` on Generic lines ONLY, and the server is the one that knows an
 * item's insurance category. The category rule above is the *same* rule, stated
 * here so the screen still behaves correctly against a door that has not filled
 * the flag in yet; the two never disagree, and if they ever did the server's
 * answer is the one that reaches NPHIES.
 */
export function selectionReasonEnabled(line: {
  deductibleGroupName: string
  selectionReasonEditable: boolean
}): boolean {
  if (typeof line.selectionReasonEditable === 'boolean') return line.selectionReasonEditable
  return selectionReasonEditableForCategory(line.deductibleGroupName)
}

/** The three deductible groups, as `setInsurance` names them (§1.2). */
export const DEDUCTIBLE_GROUPS = ['g1', 'g2', 'g3'] as const
export type DeductibleGroupKey = (typeof DEDUCTIBLE_GROUPS)[number]

/** The three boxes one group shows, as typed. Strings because they are what the
 *  inputs hold — a half-typed `-` is not a number and the draft has to survive
 *  being one. */
export interface DeductibleGroupDraft {
  rate: string
  max: string
  paid: string
}

export type InsuranceDraft = Record<DeductibleGroupKey, DeductibleGroupDraft>

export type InsuranceRefusalReason = 'notANumber' | 'negative' | 'rateOutOfRange'

/** Which box holds the problem. The screen marks that box; a block-level "check
 *  your figures" would leave nine of them to check by eye. */
export interface InsuranceRefusal {
  group: DeductibleGroupKey
  field: 'rate' | 'max' | 'paid'
  reason: InsuranceRefusalReason
}

export type InsuranceRead =
  | { ok: true; insurance: NphiesSessionInsurance }
  | { ok: false; refusals: InsuranceRefusal[] }

/**
 * Read the whole block — **all three groups, always**.
 *
 * `setInsurance` takes `{ g1, g2, g3 }` whole (§1.2), so the draft is read whole:
 * sending one group would leave the server to decide what the other two now hold,
 * and nine header money fields that answer that question differently in two
 * places is exactly the drift law 1 exists to prevent.
 *
 * A **blank is a refusal, not a zero.** Reading an empty box as `0` would turn a
 * cleared cap into "no cover at all" without the agent typing a digit.
 */
export function readInsuranceDraft(draft: InsuranceDraft): InsuranceRead {
  const refusals: InsuranceRefusal[] = []
  const read = (group: DeductibleGroupKey, field: 'rate' | 'max' | 'paid'): number => {
    const typed = draft[group][field].trim()
    const value = Number(typed)
    if (typed === '' || !Number.isFinite(value)) {
      refusals.push({ group, field, reason: 'notANumber' })
      return 0
    }
    if (value < 0) {
      refusals.push({ group, field, reason: 'negative' })
      return 0
    }
    // ⚠️ The contract states no upper bound on a rate. 0–100 is this client's,
    // logged in `.afk/HITL-218.md`: the field is a percentage of the line the
    // patient carries, and a rate above 100 would ask the patient for more than
    // the item costs. The door refuses nothing here today, so the cell is the
    // only place it is caught.
    if (field === 'rate' && value > 100) {
      refusals.push({ group, field, reason: 'rateOutOfRange' })
      return 0
    }
    return value
  }

  const insurance = {
    g1: { rate: read('g1', 'rate'), max: read('g1', 'max'), paid: read('g1', 'paid') },
    g2: { rate: read('g2', 'rate'), max: read('g2', 'max'), paid: read('g2', 'paid') },
    g3: { rate: read('g3', 'rate'), max: read('g3', 'max'), paid: read('g3', 'paid') },
  }
  return refusals.length > 0 ? { ok: false, refusals } : { ok: true, insurance }
}

/** Whether the block actually changed. One rate edit re-prices the whole request
 *  through the engine (`UpdateDeductible` never touches `request.Items`), so a
 *  blur that changed nothing must not send one. */
export function insuranceChanged(
  current: NphiesSessionInsurance,
  next: NphiesSessionInsurance,
): boolean {
  return DEDUCTIBLE_GROUPS.some(
    (group) =>
      current[group].rate !== next[group].rate ||
      current[group].max !== next[group].max ||
      current[group].paid !== next[group].paid,
  )
}

/** The block as it stands on the server, as the boxes hold it. */
export function insuranceToDraft(insurance: NphiesSessionInsurance): InsuranceDraft {
  const box = (group: DeductibleGroupKey): DeductibleGroupDraft => ({
    rate: String(insurance[group].rate),
    max: String(insurance[group].max),
    paid: String(insurance[group].paid),
  })
  return { g1: box('g1'), g2: box('g2'), g3: box('g3') }
}

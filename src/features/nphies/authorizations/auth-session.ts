/**
 * The rules of the live engine session, as pure functions (ticket 217, spec 209
 * §2 + stories 26–31, contract v1.0 §2 / §2.1 / §2.3 / §7).
 *
 * No React, no i18n, no network. The form is a controlled shell over this module,
 * which is what makes the session's three load-bearing rules testable with no
 * React Testing Library in the repo (spec 209's tier-1 ruling) — and they are
 * exactly the three that would otherwise regress silently:
 *
 * 1. **A stale state never replaces a newer one.** Two verbs in flight, the slow
 *    one lands second, and the request goes backwards on screen. The rule is
 *    `@/core/engine-session/session-state`'s, shared with the call-centre console
 *    and NOT re-implemented here — this module's job is to keep it genuinely in
 *    the path, next to the contract-version hard stop that guards the same door.
 * 2. **A duplicate item is refused at the moment it is added**, with the quantity
 *    control named as the remedy (§2.3).
 * 3. **A voided line is kept, not removed** — the audit trail is the whole reason
 *    this form is a session rather than a payload (law 2).
 */

import { ApiError, apiErrorCode } from '@/core/api'
import { applyState, checkContractVersion } from '@/core/engine-session/session-state'
import type { NphiesAuthSessionLine, NphiesAuthSessionState } from '@/core/models/nphies'

/**
 * What the cache should hold after a state arrives — or the reason it may hold
 * nothing at all.
 *
 * The hard stop is part of the same answer rather than a separate call, because
 * §2.1 puts it *before* any state is admitted: a client that rendered a state it
 * cannot speak and only then checked the version would already have mis-rendered
 * money at a national exchange.
 */
export type StateAdmission =
  | { ok: true; state: NphiesAuthSessionState }
  /** A **major** contract mismatch. The form refuses to run and says both
   *  versions, because "update the portal" is an instruction someone has to act
   *  on (law 10 / §8). */
  | { ok: false; expected: string; received: string | null }

/**
 * Decide what the form renders after a verb or a read answers.
 *
 * 🚩 **Both rules are `core/`'s** (ticket 210, which graduated them out of the
 * call-centre console precisely so this second engine session could be their
 * second consumer). Nothing about version ordering, equal-version-different-etag
 * or the major check is decided in this file — it is decided once, for both
 * contracts, and this function is what puts it in the Nphies path.
 *
 * `source` is the same distinction the call centre draws: a **verb**'s projection
 * is built alongside the act, a **read** (`State`) is the transaction's own
 * account of itself, and at an equal version the read wins.
 */
export function admitSessionState(
  current: NphiesAuthSessionState | null | undefined,
  incoming: NphiesAuthSessionState,
  source: 'verb' | 'read' = 'verb',
): StateAdmission {
  const contract = checkContractVersion(incoming.contractVersion)
  if (!contract.ok) return contract
  return { ok: true, state: applyState(current, incoming, source) }
}

/**
 * Why an add was refused, and what to do about it.
 *
 * `remedy` is the point of the type. §2.3 does not merely say a duplicate is
 * refused — it says the refusal **names the quantity control**, because WPF
 * refused at submit and the whole value of moving the rule forward is that the
 * agent fixes it while looking at it. So the remedy is a field the screen must
 * render, not a sentence a screen may forget to write.
 */
export interface AddItemRefusal {
  /**
   * `duplicate` — the item is already on the request (§2.3, `ITEM_ALREADY_ON_REQUEST`).
   * `blank` — nothing was typed. `qty` — a quantity that is not a positive whole
   * number, which the door would refuse as `QTY_INVALID`; refusing it here costs
   * a round trip rather than an error banner.
   */
  kind: 'duplicate' | 'blank' | 'qty'
  /** 🚩 The control that fixes it. `quantity` on a duplicate — the contract's own
   *  wording — and the add-row's own field otherwise. */
  remedy: 'quantity' | 'itemNumber'
  /** The line already holding this item, on a `duplicate`. It is what lets the
   *  screen point at the row rather than describe it. */
  lineId: string | null
  sequence: number | null
  itemNumber: string
}

const code = (raw: string | null | undefined) => (raw ?? '').trim()

/** Two item numbers are the same item. Trimmed and case-folded: an item number is
 *  a machine code, and `100001 ` typed with a trailing space is not a second
 *  product — a refusal that missed it would let the duplicate through to the
 *  door, which is the one place §2.3 says it must not have to be caught. */
const sameItem = (a: string, b: string) => code(a).toUpperCase() === code(b).toUpperCase()

/**
 * The line already holding this item, or `null`.
 *
 * 🚩 **A voided line does not count.** Voiding is how an agent takes something
 * off the request; if a voided line still blocked its own item, the remedy the
 * refusal names — change the quantity — would point at a line that is no longer
 * on the request at all, and the item could never be re-added. The engine's own
 * duplicate check is over live lines for the same reason.
 */
export function lineHoldingItem(
  lines: NphiesAuthSessionLine[],
  itemNumber: string,
): NphiesAuthSessionLine | null {
  if (code(itemNumber) === '') return null
  return lines.find((line) => !line.voided && sameItem(line.itemNumber, itemNumber)) ?? null
}

/**
 * Whether this add may be sent at all — the refusal **at the moment of adding**.
 *
 * 🚩 This is a *forward* statement of the rule, not a second opinion about it.
 * The door still refuses `ITEM_ALREADY_ON_REQUEST` and `readAddRefusal` below
 * turns that answer into the identical shape, so an agent whose screen has fallen
 * behind reads the same sentence and is pointed at the same control. What this
 * function buys is that the ordinary case never costs a round trip to say
 * something the screen already knew.
 */
export function refuseAdd(
  lines: NphiesAuthSessionLine[],
  itemNumber: string,
  qty: number,
): AddItemRefusal | null {
  const item = code(itemNumber)
  if (item === '') {
    return { kind: 'blank', remedy: 'itemNumber', lineId: null, sequence: null, itemNumber: '' }
  }
  if (!Number.isInteger(qty) || qty < 1) {
    return { kind: 'qty', remedy: 'quantity', lineId: null, sequence: null, itemNumber: item }
  }
  const held = lineHoldingItem(lines, item)
  if (held) {
    return {
      kind: 'duplicate',
      // 🚩 The contract's own remedy, and the reason this rule moved forward from
      // submit: the agent asks for more of what is already there.
      remedy: 'quantity',
      lineId: held.lineId,
      sequence: held.sequence,
      itemNumber: held.itemNumber,
    }
  }
  return null
}

/**
 * The door's own duplicate refusal, read back into the same shape.
 *
 * A guardrail refusal is a **business outcome** with a machine code (§6 kind 2),
 * so this branches on `ITEM_ALREADY_ON_REQUEST` and never on the message — which
 * is `api-envelope`'s own instruction and what stops the screen breaking the first
 * time somebody rewords the sentence.
 *
 * 🚩 Only that code. Every other refusal keeps its own server-supplied words and
 * is drawn as what it is; a catch that swallowed the lot would tell an agent to
 * change a quantity because an item has no Nphies category.
 */
export function readAddRefusal(
  error: unknown,
  lines: NphiesAuthSessionLine[],
  itemNumber: string,
): AddItemRefusal | null {
  if (apiErrorCode(error) !== 'ITEM_ALREADY_ON_REQUEST') return null
  const held = lineHoldingItem(lines, itemNumber)
  return {
    kind: 'duplicate',
    remedy: 'quantity',
    lineId: held?.lineId ?? null,
    sequence: held?.sequence ?? null,
    itemNumber: code(itemNumber),
  }
}

/** The server's own sentence for a refusal, or `null` when it gave none. Kept
 *  beside the refusal reader so both halves of §6 kind 2 — the code you branch on
 *  and the words you show — are read in one place. */
export function refusalMessage(error: unknown): string | null {
  return error instanceof ApiError && error.kind === 'business' && error.message
    ? error.message
    : null
}

/** One line as the grid draws it. Nothing is computed: every money field is the
 *  server's, passed through (law 1). */
export interface SessionLineView {
  lineId: string
  sequence: number
  voided: boolean
  itemNumber: string
  itemDescription: string
  quantity: number
  unitPrice: number
  extendedPrice: number
  netAmount: number
  vat: number
  discountAmount: number
  actualPatientShare: number
  deductibleGroupName: string
  /** 🚩 The line is still being priced by the engine — what makes it **price in
   *  place** (story 27) rather than appear with blank money. The server says so;
   *  the browser never guesses it. */
  pricingPending: boolean
  /** Whether the quantity may be changed and the line voided. A voided line is
   *  kept and is inert: there is no un-void verb, and re-adding the item is the
   *  way back. */
  editable: boolean
}

/**
 * The lines, in the order the request holds them.
 *
 * 🚩 **A voided line is projected, not filtered.** This is the assertion the
 * whole session shape exists to make good on: a payload assembled client-side
 * carries only the survivors, and "added then voided" is precisely what the audit
 * trail is for. Sorting is by `sequence` — the engine's own line identity — so a
 * void never re-orders what is above it.
 */
export function projectSessionLines(
  state: NphiesAuthSessionState | null | undefined,
): SessionLineView[] {
  const lines = state?.lines ?? []
  return [...lines]
    .sort((a, b) => a.sequence - b.sequence)
    .map((line) => ({
      lineId: line.lineId,
      sequence: line.sequence,
      voided: line.voided,
      itemNumber: line.itemNumber,
      itemDescription: line.itemDescription,
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      extendedPrice: line.extendedPrice,
      netAmount: line.netAmount,
      vat: line.vat,
      discountAmount: line.discountAmount,
      actualPatientShare: line.actualPatientShare,
      deductibleGroupName: line.deductibleGroupName,
      pricingPending: line.pricing === 'pending',
      editable: !line.voided,
    }))
}

/** How many lines are still live — what the agent is actually asking the payer
 *  for. Voided lines are on the screen and are not in this count, which is the
 *  distinction a single "N lines" figure would lose. */
export function liveLineCount(lines: SessionLineView[]): number {
  return lines.filter((line) => !line.voided).length
}

/**
 * Whether leaving this form discards work the agent would want back.
 *
 * 🚩 **Leaving abandons** (law 9): the transaction is VOIDED, nothing is
 * resumable, and a crashed tab is swept server-side. So the warning is not a
 * courtesy about unsaved changes — there is no save — it is the honest statement
 * that this request ends when the page does.
 *
 * A **voided** line still counts as work. It is a decision the agent made and the
 * trail recorded, and "you have nothing to lose" is not true of a request they
 * have been building. An open session with no lines at all has genuinely nothing
 * in it, and warning there would train the agent to click through the warning
 * that matters.
 */
export function leavingDiscardsWork(state: NphiesAuthSessionState | null | undefined): boolean {
  if (!state || state.status !== 'open') return false
  return state.lines.length > 0
}

/** Why the session cannot be opened at all. Empty = openable. */
export type OpenBlocker = 'noEligibility' | 'noCoverage' | 'noActingStore'

/**
 * Everything that must be true before the first verb is sent.
 *
 * 🚩 **The acting store is checked here, before `Open`** — not because the
 * browser sends it (it does not: law 7 has the server bind the plant from the
 * agent's own session) but because law 8 makes it *immutable for the life of the
 * transaction*. A session opened while the shell still has no acting store binds
 * whatever the server resolves, and the agent finds out in the money. Resolving it
 * before the first item is the contract's own instruction.
 *
 * The two ids are 213's seam. A half-addressed URL lands on a form that cannot
 * open, and saying so is better than an `Open` refused by the door for a reason
 * the agent cannot see.
 */
export function openBlockers(
  eligibilityId: string,
  memberId: string,
  actingStore: string | null | undefined,
): OpenBlocker[] {
  const blockers: OpenBlocker[] = []
  if (code(eligibilityId) === '') blockers.push('noEligibility')
  if (code(memberId) === '') blockers.push('noCoverage')
  if (code(actingStore) === '') blockers.push('noActingStore')
  return blockers
}

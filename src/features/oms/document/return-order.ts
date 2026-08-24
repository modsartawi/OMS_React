/**
 * Every decision the bonded-return screen makes, in one dependency-free module
 * (spec 289 D3): no React, no `t()`, no network, no clock. This slice carries
 * the first of them — the **line projection**.
 *
 * It lives beside `change-store.ts` and `reschedule.ts` for the same reason
 * those do: the arithmetic is where a regression is silent, and none of it
 * needs a browser to be exercised.
 */
import type { SdDocumentLineModel } from '@/core/models/sd-document'

/** One line as the return screen offers it. */
export interface ReturnableLine {
  lineNumber: number
  itemNumber: string
  itemDescription: string
  /** What was delivered — the line's `quantity`. */
  delivered: number
  /** What earlier returns have already taken back. */
  returned: number
  /** `delivered − returned`, never below zero. The cap on what may be sent back. */
  remaining: number
}

/** The projection: the rows to render, and what was left out of them. */
export interface ReturnableLineProjection {
  rows: ReturnableLine[]
  /**
   * How many lines were omitted because nothing is left on them. The grid
   * renders what it is handed and the header states this count — a line that
   * silently vanishes is a line an operator will look for.
   */
  hiddenCount: number
  /**
   * How many lines were omitted because they were **never returnable at all** —
   * struck from the delivery, or delivered in no quantity.
   *
   * Kept apart from `hiddenCount` because the two say different things and only
   * one of them is a fact about earlier returns: folding a struck line into the
   * returned tally makes the grid header — and the command's own exhausted
   * tooltip — state something that never happened.
   */
  notReturnableCount: number
}

/**
 * A payload number, or `0`.
 *
 * ⚠ `returnedQuantity` is a BackOffice spec 1283 §2b addition that does not
 * exist on the wire yet, so it is **optional** on the model and absent on every
 * captured payload. Absent means *nothing has been returned* — never `NaN`,
 * which would poison `remaining` and every comparison downstream.
 */
function finiteOrZero(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

/** Hold a number inside `[low, high]`. */
function clamp(value: number, low: number, high: number): number {
  return Math.min(Math.max(value, low), high)
}

/**
 * Project a delivery's lines into the rows a return may be created from.
 *
 * `remaining = quantity − returnedQuantity`, per 1283 §2b's own formula. A line
 * with nothing left is **omitted from the rows and counted in the tally** —
 * hiding is the projection's job, not the grid's.
 *
 * A remainder is clamped to `[0, delivered]`. A server that reports more
 * returned than delivered — or, while the field's spelling is still a guess,
 * one that reports it negative — is a data question, and neither answer is a
 * licence to offer a quantity outside what was delivered.
 *
 * **A struck line is never offered.** `deleted` lines render struck in the Items
 * grid rather than vanishing, and a line struck from the delivery is not goods a
 * customer can send back. They leave through the second tally, not the returned
 * one — as does a line delivered in no quantity, which has nothing to give back
 * and never had anything taken.
 */
export function returnableLines(
  lines: SdDocumentLineModel[] | null | undefined,
): ReturnableLineProjection {
  const rows: ReturnableLine[] = []
  let hiddenCount = 0
  let notReturnableCount = 0

  for (const line of lines ?? []) {
    const delivered = Math.max(0, finiteOrZero(line.quantity))
    const returned = finiteOrZero(line.returnedQuantity)
    const remaining = clamp(delivered - returned, 0, delivered)
    if (line.deleted || delivered <= 0) {
      notReturnableCount += 1
      continue
    }
    if (remaining <= 0) {
      hiddenCount += 1
      continue
    }
    rows.push({
      lineNumber: line.lineNumber,
      itemNumber: line.itemNumber,
      itemDescription: line.itemDescription,
      delivered,
      returned,
      remaining,
    })
  }

  return { rows, hiddenCount, notReturnableCount }
}

/**
 * Hold a return quantity inside `[1, remaining]`.
 *
 * Applied to the steppers **and** to typed input, which is the whole point:
 * `−` disabling at 1 and `+` at the cap makes zero unreachable by pressing, and
 * this makes the keyboard no way around either end. Anything that is not a
 * finite number — a cleared box, a pasted word, a `NaN` — reads as the low end
 * rather than as zero, because a ticked line always returns at least one.
 *
 * The low end wins over the cap when they cross: a row with nothing left is not
 * rendered at all (the projection hides it), so a `0` cap here is a state that
 * has no row to belong to, and answering `0` would be a quantity the screen
 * promised could never exist.
 */
export function clampReturnQuantity(value: unknown, remaining: number): number {
  const cap = Math.max(1, finiteOrZero(remaining))
  const typed = typeof value === 'number' ? value : Number(String(value ?? '').trim())
  if (!Number.isFinite(typed) || String(value ?? '').trim() === '') return 1
  return clamp(typed, 1, cap)
}

/**
 * One line as the operator has left it: ticked or not, and the quantity in its
 * box — `null` while the box is cleared, which is a state the gate must name
 * rather than silently repair.
 */
export interface ReturnLineSelection {
  picked: boolean
  quantity: number | null
}

/**
 * What the submit bar says: an i18n **key and its parameters**, never a
 * sentence. `t()` lives at the call site (spec 289 D3), so this module stays
 * dependency-free and the copy stays in `document.json`.
 */
export interface SubmitGateOutcome {
  ok: boolean
  key: string
  params?: Record<string, number>
}

/**
 * The submit gate: **one** missing thing at a time, in the order the operator
 * must act — select a line, then give it a quantity. A list of complaints is
 * not more useful than the next thing to do.
 *
 * Once nothing is missing the same strip flips to a plain summary of what is
 * selected, so it reports readiness as well as blocking it.
 *
 * ⚠ Spec 289 D3's third outcome — *choose what happens to the goods* — belongs
 * to the reason fork and lands with it (ticket 292), between the quantity
 * sentence and the summary.
 */
export function submitGate(lines: readonly ReturnLineSelection[]): SubmitGateOutcome {
  const picked = lines.filter((line) => line.picked)
  if (picked.length === 0) return { ok: false, key: 'returnDocument.gate.selectLines' }
  if (picked.some((line) => !(typeof line.quantity === 'number' && line.quantity >= 1))) {
    return { ok: false, key: 'returnDocument.gate.quantityAtLeastOne' }
  }
  return { ok: true, key: 'returnDocument.gate.summary', params: { count: picked.length } }
}

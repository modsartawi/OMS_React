/**
 * The three corrections an ordinary call makes — **change a quantity**, **change
 * a unit of measure**, **void a line** (ticket 170).
 *
 * They are one module because they are one act with three shapes: each is a verb
 * on one line, each carries one action's `requestId`, and each returns the whole
 * `SessionState` so the basket is **rendered rather than patched**. Modelling
 * them separately would have meant three copies of the id discipline and three
 * chances to get it wrong on a basket the caller is listening to.
 *
 * Two rules live here rather than in the component:
 *
 * 1. 🚩 **Only a real correction is sent.** A blur that changed nothing, a
 *    quantity that cannot be read, and zero-or-below are all *not corrections* —
 *    and zero in particular is a **void**, which has a verb of its own. Sending
 *    them would re-price a live basket for nothing, or trade a `QTY_INVALID`
 *    round trip for a control the agent already has.
 * 2. 🚩 **What the console does NOT rule on stays the server's.** The per-line
 *    cap (`QTY_INVALID`) and which units an item comes in are the engine's; the
 *    only unit this module will send is one the projection itself offered, and
 *    there is no client-side ceiling at all.
 *
 * A quantity **raised beyond availability** is not this module's business: it
 * takes [169](.issues/169-below-availability-accepted.md)'s confirm path
 * unchanged — the same `belowAtp` block, the same sheet, the same token — which
 * is why `LineEdit` is a `ConfirmableAction` and nothing here re-implements it.
 */
import { newRequestId } from './api'
import { committing, repreviewing, type ConfirmableAction } from './confirm-action'

/** What the agent asked for, before it has an id. The union is closed: a fourth
 *  kind is a fourth verb, and the contract has none (§1.1). */
export type LineEditIntent = {
  lineId: string
  /** Display only, so the acceptance sheet can name what the agent is holding
   *  rather than a line id. Never sent — the wire carries the line id. */
  description?: string
} & (
  | { kind: 'qty'; qty: number }
  | { kind: 'uom'; uom: string }
  | { kind: 'void' }
)

/** One correction in flight: the intent, its id, and the token while it holds
 *  one (only the quantity change can — §5.2). */
export type LineEdit = LineEditIntent & ConfirmableAction

/** Which of the three it is. Read by the basket so a row can say which control
 *  is working, rather than greying the whole line. */
export type LineEditKind = LineEditIntent['kind']

/** The ONE place a correction's id is minted. A second call site is how a busy
 *  retry starts looking like a second void. */
export function beginLineEdit(intent: LineEditIntent, mint: () => string = newRequestId): LineEdit {
  return { ...intent, requestId: mint() }
}

/** The acceptance: the same verb, the same id, plus the token (§5). */
export const committingLineEdit = (edit: LineEdit, confirmToken: string): LineEdit =>
  committing(edit, confirmToken)

/** A spent or stale token: dropped, and the same action asks again. */
export const reaskingLineEdit = (edit: LineEdit): LineEdit => repreviewing(edit)

/**
 * The quantity worth sending, or `null` where there is nothing to send.
 *
 * `null` is also what tells the field to go back to the engine's figure: the
 * basket is rendered from the projection, so a correction that was never sent
 * must leave nothing of itself on screen.
 */
export function nextQty(current: number, raw: string): number | null {
  const trimmed = raw.trim()
  if (!trimmed) return null
  const parsed = Number(trimmed)
  if (!Number.isFinite(parsed)) return null
  // 🚩 Zero and below are a void, not a quantity — and void is its own verb, in
  // its own control, on the same row.
  if (parsed <= 0) return null
  if (parsed === current) return null
  return parsed
}

/** The unit worth sending: one the SERVER offered, and not the one already on
 *  the line. Anything else is a guaranteed `UOM_NOT_AVAILABLE`. */
export function nextUom(line: { uom: string; uomOptions: string[] }, chosen: string): string | null {
  if (!chosen || chosen === line.uom) return null
  return line.uomOptions.includes(chosen) ? chosen : null
}

/**
 * The three refusals this verb family raises that the agent is owed OUR words
 * for, as an i18n key suffix under `line.refused.*` — or `null`, which leaves
 * the server's own sentence to speak (`apiErrorMessage`).
 *
 * 🚩 They are worded here because the server's own wording answers the wrong
 * question: `LINE_NOT_FOUND` is *usually a stale screen* (§7) and an agent told
 * "line L2 not found" mid-call has no idea that pressing refresh fixes it.
 */
export function lineRefusalKey(code: string | null | undefined): string | null {
  return code === 'LINE_NOT_FOUND' || code === 'UOM_NOT_AVAILABLE' || code === 'QTY_INVALID' ? code : null
}

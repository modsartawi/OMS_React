/**
 * The read-back sentence the agent says before placing the order — spec 983 D8,
 * ticket 988: the items as quantity × name, the saving, the payable total, then
 * delivered to the address label (and the window) or ready at the store, and how they
 * pay.
 *
 * 🚩 **A pure read of `SessionState`, and every figure is the server's.** The total is
 * `totals.payable` and the saving is `totals.discount` — both through `receipt-view`,
 * so the sentence and the receipt above it read the same two fields the same way and
 * cannot disagree. Nothing here adds a line to a line.
 *
 * 🚩 **A part not chosen is left out, never said blank.** The sentence is a run of
 * clauses, each its own whole sentence with its own key, so dropping one leaves no
 * dangling "to" or "at". Where a clause has a variant without a value (delivery with
 * no address yet, collection with no store yet), the variant is its own key.
 *
 * Words and their order are the translation's: each clause is one `callcenter` key
 * with named slots, rendered by `<Trans components>`, and the Arabic is its own key.
 * Each value is isolated by kind (`.claude/rules/bidi.md`): `money` and `ltr` for
 * machine values (the store's `code · name` pair and the window, each one string),
 * `auto` for free text (the address label, an item's name).
 */
import type { SessionLine, SessionState } from '@/core/models/callcenter'
import { formatPair, formatRange } from '@/core/util/bidi'
import { formatNumber } from '@/core/util/number-format'
import { isPickup, paymentWordKey } from './fulfilment-view'
import { isPrescriptionOrder, orderTypeOf } from './order-type'
import { prescriptionOf } from './prescription'
import { receipt } from './receipt-view'

export type ReadBackValue =
  | { kind: 'money'; amount: number }
  | { kind: 'ltr'; text: string }
  | { kind: 'auto'; text: string }

/**
 * One item as the agent says it. Quantity and name are two values, each isolated by
 * its own kind inside `readBack.line` — not one machine pair: the quantity leads in the
 * READING order of either language, so under Arabic it sits on the right.
 */
export interface ReadBackLine {
  lineId: string
  qty: string
  name: string
}

export type ReadBackClauseId = 'type' | 'items' | 'saving' | 'total' | 'where' | 'payment'

export interface ReadBackClause {
  id: ReadBackClauseId
  /** The full `callcenter` key of this clause. */
  key: string
  /** Named slots the key places. */
  values: Record<string, ReadBackValue>
  /** Only on `items`: the lines, in the engine's order, listed in the reader's language. */
  lines?: ReadBackLine[]
}

/**
 * The item's name in the console's language: the Arabic name (`description2`) under
 * Arabic where the item has one, else its own description.
 */
function lineName(line: SessionLine, lang: string): string {
  const arabic = line.description2?.trim()
  if (lang.startsWith('ar') && arabic) return arabic
  return line.description.trim()
}

export function readBack(state: SessionState, lang: string): ReadBackClause[] {
  const { header } = state
  const pickup = isPickup(header)
  const figures = receipt(state.totals, { delivering: !pickup })
  const clauses: ReadBackClause[] = []

  // 1008 — a prescription order says what it is, and its reference (a machine value), first.
  if (isPrescriptionOrder(header)) {
    const type = orderTypeOf(header)
    const reference = prescriptionOf(header).reference
    clauses.push(
      reference
        ? { id: 'type', key: `readBack.type.${type}`, values: { reference: { kind: 'ltr', text: reference } } }
        : { id: 'type', key: `readBack.type.${type}NoReference`, values: {} },
    )
  }

  if (state.lines.length > 0)
    clauses.push({
      id: 'items',
      key: 'readBack.items',
      values: {},
      lines: state.lines.map((line) => ({ lineId: line.lineId, qty: formatNumber(line.qty), name: lineName(line, lang) })),
    })

  if (figures.saves !== null)
    clauses.push({ id: 'saving', key: 'readBack.saving', values: { amount: { kind: 'money', amount: figures.saves } } })

  clauses.push({ id: 'total', key: 'readBack.total', values: { amount: { kind: 'money', amount: figures.total } } })

  if (pickup) {
    const store = formatPair(header.plant?.trim(), header.plantName?.trim())
    clauses.push(
      store
        ? { id: 'where', key: 'readBack.where.collectFrom', values: { store: { kind: 'ltr', text: store } } }
        : { id: 'where', key: 'readBack.where.collect', values: {} },
    )
  } else {
    const label = header.address?.label?.trim()
    // The window is ONE string, isolated once (373, 378), and only beside an address —
    // the same pairing the rail draws.
    const window = label && header.slot ? formatRange(header.slot.from, header.slot.to) : ''
    if (!label) clauses.push({ id: 'where', key: 'readBack.where.deliver', values: {} })
    else if (!window) clauses.push({ id: 'where', key: 'readBack.where.deliverTo', values: { address: { kind: 'auto', text: label } } })
    else
      clauses.push({
        id: 'where',
        key: 'readBack.where.deliverAt',
        values: { address: { kind: 'auto', text: label }, window: { kind: 'ltr', text: window } },
      })
  }

  // A payment the console cannot word (a future `Receivable`) is left out — never guessed.
  const payment = paymentWordKey(header)
  if (payment) clauses.push({ id: 'payment', key: `readBack.payment.${payment}`, values: {} })

  return clauses
}

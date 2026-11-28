/**
 * The step rail (Caller · Items · Fulfilment · Payment · Review) and the summary's
 * *Before you place it* checklist — spec 983 D3, ticket 984.
 *
 * 🚩 **Derived, never stored.** Both are a pure read of `SessionState` and the server's
 * own `submitBlockers` (`submit-blockers.ts`). The checklist is that list laid out as
 * rows, and the rail's Review step is green exactly when the checklist is clear — so the
 * rail, the checklist and *Place order*'s own refusal cannot disagree. Nothing here
 * decides an order is complete: a row is amber because the server listed its code, and
 * a code this client has never heard of still blocks, as `blockers.unknown`.
 *
 * Nothing is linear and nothing is skipped: every step can be clicked at any time, and a
 * step's state is only a colour.
 */
import type { SessionState } from '@/core/models/callcenter'
import { formatPair, formatRange } from '@/core/util/bidi'
import { isPickup, paymentWordKey } from './fulfilment-view'
import { isPrescriptionOrder } from './order-type'
import { prescriptionSettled } from './prescription'
import { submitBlockers, UNKNOWN_BLOCKER_KEY } from './submit-blockers'

export type StepId = 'caller' | 'items' | 'fulfilment' | 'payment' | 'review'
export type StepState = 'done' | 'missing'

/**
 * One piece of a step's answer. Server text is isolated by kind (`.claude/rules/bidi.md`):
 * `ltr` for a machine value (a window, a `code · name` pair), `auto` for free text (a name,
 * an address label). A `key` is a phrase the console words itself; `count` rides into it.
 */
export type RailSegment =
  | { kind: 'text'; text: string; isolate: 'ltr' | 'auto' }
  | { kind: 'key'; key: string; count?: number }

export type CheckRowId =
  | 'caller'
  | 'items'
  | 'address'
  | 'store'
  | 'slot'
  | 'source'
  | 'reference'
  | 'prescription'
  | 'placed'
  | 'unknown'

export interface RailStep {
  id: StepId
  state: StepState
  /** What the step currently holds — "Home · 16:00–18:00", "Cash on delivery". */
  answer: RailSegment[]
  /**
   * Where a click on the step should land: the first missing row the step owns, or the
   * step's own place when nothing is missing. The component maps it to an element.
   */
  focus: CheckRowId | StepId
}

export interface CheckRow {
  id: CheckRowId
  state: StepState
  /** `blockers.<phrase>` while missing (the receipt's own words), `checklist.done.<id>` once settled. */
  key: string
  /** The wire codes this row is carrying right now — empty once settled. */
  codes: string[]
  /** The rail step that owns the row, for its colour and its click. */
  step: StepId
}

export interface Checklist {
  rows: CheckRow[]
  /** No blocker remains — the one condition under which *Place order* is live. */
  ready: boolean
}

/**
 * The known rows, in the order the agent works. `when` decides whether a SETTLED row is
 * drawn at all; a row the server is blocking on is always drawn, whatever `when` says.
 */
const ROWS: {
  id: Exclude<CheckRowId, 'unknown'>
  codes: string[]
  step: StepId
  when: (state: SessionState) => boolean
}[] = [
  { id: 'caller', codes: ['NO_CUSTOMER'], step: 'caller', when: () => true },
  { id: 'items', codes: ['NO_LINES'], step: 'items', when: () => true },
  { id: 'address', codes: ['NO_ADDRESS'], step: 'fulfilment', when: (s) => !isPickup(s.header) },
  { id: 'store', codes: ['STORE_NOT_CHOSEN'], step: 'fulfilment', when: () => true },
  { id: 'slot', codes: ['MISSING_SLOT'], step: 'fulfilment', when: (s) => !isPickup(s.header) },
  // A source is drawn settled only once the order holds one: the server does not always
  // list `MISSING_SOURCE` on an order that has none (fixture 01), and "Source set" there
  // would be a claim the header contradicts.
  { id: 'source', codes: ['MISSING_SOURCE'], step: 'review', when: (s) => !!s.header.documentSource },
  // Only some sources need a reference, so it is a row only while it blocks.
  {
    id: 'reference',
    codes: ['MISSING_SOURCE_REFERENCE', 'SOURCE_REFERENCE_REQUIRED'],
    step: 'review',
    when: () => false,
  },
  // 1008 (spec 1006 D4) — a Wasfaty / Nphies order's patient ID and reference. Drawn settled only
  // once the order holds both, and never on a phone order.
  {
    id: 'prescription',
    codes: ['prescription', 'MISSING_PRESCRIPTION'],
    step: 'review',
    when: (s) => isPrescriptionOrder(s.header) && prescriptionSettled(s.header),
  },
  { id: 'placed', codes: ['ALREADY_SUBMITTED'], step: 'review', when: () => false },
]

const KNOWN = new Set(ROWS.flatMap((row) => row.codes))

/** The *Before you place it* checklist: the server's blockers, as rows. */
export function beforeYouPlace(state: SessionState): Checklist {
  const codes = [...new Set(state.capabilities.submitBlockers ?? [])]
  const rows: CheckRow[] = []
  for (const row of ROWS) {
    const carried = codes.filter((code) => row.codes.includes(code))
    if (carried.length > 0) {
      // The receipt's own phrase for the code (one fact, one sentence).
      rows.push({ id: row.id, state: 'missing', key: submitBlockers(carried)[0].key, codes: carried, step: row.step })
    } else if (row.when(state)) {
      rows.push({ id: row.id, state: 'done', key: `checklist.done.${row.id}`, codes: [], step: row.step })
    }
  }
  const unknown = codes.filter((code) => !KNOWN.has(code))
  if (unknown.length > 0)
    rows.push({ id: 'unknown', state: 'missing', key: UNKNOWN_BLOCKER_KEY, codes: unknown, step: 'review' })
  return { rows, ready: codes.length === 0 }
}

/** The five steps, each with its own answer and its colour. */
export function stepRail(state: SessionState): RailStep[] {
  const { header } = state
  const checklist = beforeYouPlace(state)
  const missingOf = (step: StepId) => checklist.rows.filter((row) => row.step === step && row.state === 'missing')
  const pickup = isPickup(header)

  const callerMissing = missingOf('caller').length > 0 || !header.customer
  // 🚩 D2 (spec 1006): a Wasfaty or Nphies order may be placed with no items — the pharmacist
  // completes it from the prescription — so there an empty basket is amber only when the server
  // says so (`NO_LINES`).
  const itemsMissing =
    missingOf('items').length > 0 || (state.lines.length === 0 && !isPrescriptionOrder(header))

  const fulfilmentAnswer: RailSegment[] = []
  if (pickup) {
    fulfilmentAnswer.push({ kind: 'key', key: 'rail.fulfilment.collect' })
    if (header.plant) fulfilmentAnswer.push({ kind: 'text', text: formatPair(header.plant, header.plantName), isolate: 'ltr' })
  } else {
    if (header.address) fulfilmentAnswer.push({ kind: 'text', text: header.address.label, isolate: 'auto' })
    else fulfilmentAnswer.push({ kind: 'key', key: 'rail.fulfilment.noAddress' })
    // The window is ONE string, isolated once (373, 378).
    if (header.address && header.slot)
      fulfilmentAnswer.push({ kind: 'text', text: formatRange(header.slot.from, header.slot.to), isolate: 'ltr' })
  }
  const fulfilmentMissing = missingOf('fulfilment')

  const payment = paymentWordKey(header)
  const left = checklist.rows.filter((row) => row.state === 'missing').length

  return [
    {
      id: 'caller',
      state: callerMissing ? 'missing' : 'done',
      answer: header.customer
        ? [{ kind: 'text', text: header.customer.name, isolate: 'auto' }]
        : [{ kind: 'key', key: 'rail.caller.none' }],
      focus: 'caller',
    },
    {
      id: 'items',
      state: itemsMissing ? 'missing' : 'done',
      answer:
        state.lines.length > 0
          ? [{ kind: 'key', key: 'rail.items.count', count: state.lines.length }]
          : [{ kind: 'key', key: 'rail.items.none' }],
      focus: 'items',
    },
    {
      id: 'fulfilment',
      state: fulfilmentMissing.length > 0 ? 'missing' : 'done',
      answer: fulfilmentAnswer,
      focus: fulfilmentMissing[0]?.id ?? 'fulfilment',
    },
    {
      id: 'payment',
      state: payment ? 'done' : 'missing',
      answer: [{ kind: 'key', key: payment ? `sentence.payment.${payment}` : 'rail.payment.none' }],
      focus: 'payment',
    },
    {
      id: 'review',
      // 🚩 Exactly the checklist's own verdict — the one thing that must not disagree
      // with *Place order*.
      state: checklist.ready ? 'done' : 'missing',
      answer: checklist.ready
        ? [{ kind: 'key', key: 'rail.review.ready' }]
        : [{ kind: 'key', key: 'rail.review.left', count: left }],
      focus: 'review',
    },
  ]
}

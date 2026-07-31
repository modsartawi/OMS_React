/**
 * `ctrlKReachesEveryOrderActWithoutEndingTheCall` (ticket 192) — the palette
 * asserted at its edge: a session and a set of handlers in, rows out.
 *
 * 🚩 Every case here is about a key that can reach a **terminal act**, so the
 * negatives are the point: the two terminals sort last, nothing auto-aims at
 * them, a disabled row is still reachable and still inert, and the offer rows
 * are the same ones the top bar counts.
 *
 * The locale file is imported and asserted against rather than the keys being
 * eyeballed — a `t()` call with no backing key renders the raw key to the agent,
 * which is a failure no type check can see (`submit-blockers.test.ts`'s ruling).
 */
import { describe, expect, it } from 'vitest'
import callcenter from '@/locales/en/callcenter.json'
import type { SessionCapabilities } from '@/core/models/callcenter'
import { ATTACHED_SESSION, EMPTY_SESSION, NEAR_MISS_CLASSES } from './__fixtures__/payloads'
import { guidanceView } from './guidance-view'
import { NO_HIGHLIGHT, moveHighlight } from './highlight'
import {
  autoHighlight,
  filterRows,
  paletteAim,
  paletteQuestion,
  paletteRows,
  paletteRun,
  STORE_FOLLOWS_ADDRESS,
  VAGUE_REASON,
  type PaletteActions,
  type PaletteInput,
  type PaletteRow,
} from './palette-model'

/** `palette.verb.slot` → the phrase, or undefined where the key does not exist. */
const phrase = (key: string): unknown =>
  key
    .split('.')
    .reduce<unknown>(
      (node, part) => (node as Record<string, unknown> | undefined)?.[part],
      callcenter as unknown,
    )

const noop = () => {}

/** Every act live — the resting shape a healthy open order hands in. */
const ALL_LIVE: PaletteActions = {
  verbs: {
    searchItems: noop,
    addressBook: noop,
    changeStore: noop,
    slot: noop,
    source: noop,
    note: noop,
    fulfilment: noop,
    payment: noop,
    coupon: noop,
    attachCaller: noop,
    removeCaller: noop,
    refresh: noop,
  },
  place: noop,
  abandon: noop,
  onOffer: () => {},
}

const build = (over: Partial<PaletteInput> = {}): PaletteRow[] =>
  paletteRows({
    guidance: guidanceView(null),
    capabilities: EMPTY_SESSION.capabilities,
    hasCaller: false,
    // Collection by default: the delivery reading is its own case below, and a
    // default that hid the store row's sentence would make it the exception.
    pickup: true,
    actions: ALL_LIVE,
    ...over,
  })

/** The rendered text a real palette would match against. Enough of `t()` for a
 *  filter test: the key's own last segment stands in for its words. */
const textOf = (row: PaletteRow): string =>
  `${row.label.key.split('.').pop()} ${row.detail ?? ''}`

const capabilities = (over: Partial<SessionCapabilities>): SessionCapabilities => ({
  ...EMPTY_SESSION.capabilities,
  ...over,
})

describe('theRowsComeInOneOrder', () => {
  it('lists offers first, then the order verbs, then the terminals', () => {
    const rows = build({ guidance: guidanceView(NEAR_MISS_CLASSES) })
    const kinds = rows.map((row) => row.kind)
    // Asserted as a shape rather than as an index: what matters is that no verb
    // ever appears above an offer and no terminal ever above a verb.
    expect(kinds.indexOf('verb')).toBeGreaterThan(kinds.lastIndexOf('offer'))
    expect(kinds.indexOf('terminal')).toBeGreaterThan(kinds.lastIndexOf('verb'))
  })

  it('🚩 sorts the two terminal acts LAST, and they are the only two', () => {
    const rows = build({ guidance: guidanceView(NEAR_MISS_CLASSES) })
    expect(rows.slice(-2).map((row) => row.id)).toEqual(['terminal:place', 'terminal:abandon'])
    expect(rows.filter((row) => row.kind === 'terminal')).toHaveLength(2)
  })

  it('lists the order verbs in the spec order, line verbs absent', () => {
    expect(build().filter((row) => row.kind === 'verb').map((row) => row.id)).toEqual([
      'verb:searchItems',
      'verb:addressBook',
      'verb:changeStore',
      'verb:slot',
      'verb:source',
      'verb:note',
      'verb:fulfilment',
      'verb:payment',
      'verb:coupon',
      'verb:attachCaller',
      'verb:refresh',
    ])
  })

  // The palette is one level deep and its object is the ORDER: a row for a line
  // verb would need a second step, and *void* stays aimed at a line the agent
  // is looking at.
  it('🚩 holds no line verb — no quantity, no unit of measure, no void', () => {
    const ids = build().map((row) => row.id).join(' ')
    expect(ids).not.toMatch(/qty|uom|void/i)
  })

  it('holds ONE caller row, and which one follows the order', () => {
    const attached = build({ hasCaller: true }).map((row) => row.id)
    expect(attached).toContain('verb:removeCaller')
    expect(attached).not.toContain('verb:attachCaller')
  })

  it('gives every row an i18n key that exists', () => {
    for (const row of build({ guidance: guidanceView(NEAR_MISS_CLASSES) })) {
      expect(phrase(row.label.key), `${row.id} has no label`).toBeTruthy()
    }
  })
})

describe('theOffersAreTheStripsOwn', () => {
  /**
   * 🚩 The drift test. The palette's offer rows and the top bar's count are read
   * from ONE `guidanceView`, so this asserts them against the same fixture and
   * the same projection — the two cannot disagree without this failing.
   */
  it('has exactly one offer row per actionable card the top bar counts', () => {
    const guidance = guidanceView(NEAR_MISS_CLASSES)
    const rows = build({ guidance }).filter((row) => row.kind === 'offer')
    expect(rows).toHaveLength(guidance.actionableCount)
    expect(rows.map((row) => row.detail)).toEqual(guidance.actionable.map((card) => card.description))
  })

  // 🚩 859 — every `offerId` on the wire can be the empty string, so two
  // distinct offers arrive under one key. Keyed on `offerId` the palette would
  // draw ONE row for two offers; `cardId` is the positional fallback that keeps
  // them apart, and this asserts the palette reads it.
  it('keys an offer row on the card id, so two blank offerIds are two rows', () => {
    const actionable = guidanceView(NEAR_MISS_CLASSES).actionable[0]
    const blanked = NEAR_MISS_CLASSES.filter((miss) => miss.description === actionable.description)
      .flatMap((miss) => [{ ...miss, offerId: '' }, { ...miss, offerId: '' }])
    const rows = build({ guidance: guidanceView(blanked) }).filter((row) => row.kind === 'offer')
    expect(rows).toHaveLength(2)
    expect(new Set(rows.map((row) => row.id)).size).toBe(2)
  })

  it('counts nothing when the basket is within reach of nothing', () => {
    expect(build().filter((row) => row.kind === 'offer')).toHaveLength(0)
  })

  it('hands the offer back by its own offerId, never by the positional card id', () => {
    const guidance = guidanceView(NEAR_MISS_CLASSES)
    const asked: string[] = []
    const rows = paletteRows({
      guidance,
      capabilities: ATTACHED_SESSION.capabilities,
      hasCaller: true,
      pickup: true,
      actions: { ...ALL_LIVE, onOffer: (offerId) => asked.push(offerId) },
    })
    rows.find((row) => row.kind === 'offer')?.run?.()
    expect(asked).toEqual([guidance.actionable[0].offerId])
  })
})

describe('aRefusedVerbIsADisabledRowCarryingItsReason', () => {
  it('🚩 disables exactly the verbs the page withheld a handler for', () => {
    const rows = build({ actions: { ...ALL_LIVE, verbs: { ...ALL_LIVE.verbs, changeStore: null } } })
    const store = rows.find((row) => row.id === 'verb:changeStore')!
    expect(store.enabled).toBe(false)
    expect(store.run).toBeNull()
    // Everything else is untouched: enablement is one handler, one row.
    expect(rows.find((row) => row.id === 'verb:slot')!.enabled).toBe(true)
  })

  it('words the refusal from the SERVER’s reason, and never from a code on screen', () => {
    const rows = build({
      capabilities: capabilities({
        canChangeFulfilment: false,
        capabilityReasons: { canChangeFulfilment: 'DELIVERY_ONLY_SOURCE' },
      }),
      actions: { ...ALL_LIVE, verbs: { ...ALL_LIVE.verbs, fulfilment: null } },
    })
    const reason = rows.find((row) => row.id === 'verb:fulfilment')!.reason!
    // 🚩 The chip row's OWN sentence — one refusal, one wording, whichever
    // surface asked.
    expect(reason.key).toBe('fulfilment.locked.DELIVERY_ONLY_SOURCE')
    expect(phrase(reason.key)).toBeTruthy()
    expect(reason.fallbackKey).toBe('fulfilment.locked.unknown')
  })

  it('🚩 degrades a reason it has no words for to the general sentence, never to a raw key', () => {
    const rows = build({
      capabilities: capabilities({
        canChangePaymentType: false,
        // A code minted by a later server — §9 ships additive changes first.
        capabilityReasons: { canChangePaymentType: 'SOME_LATER_RULE' },
      }),
      actions: { ...ALL_LIVE, verbs: { ...ALL_LIVE.verbs, payment: null } },
    })
    const reason = rows.find((row) => row.id === 'verb:payment')!.reason!
    expect(reason.fallbackKey).toBe('payment.locked.unknown')
    expect(phrase(reason.fallbackKey!)).toBeTruthy()
  })

  // 🚩 153's *quote the contract's own precondition*, and the one place it can
  // be done without risking a WRONG refusal: with no caller on the order, *their
  // address book opens with them* is true whatever else is also true (§6.3).
  it('quotes the contract’s own attach-before-address ordering for the address book', () => {
    const rows = build({
      hasCaller: false,
      actions: { ...ALL_LIVE, verbs: { ...ALL_LIVE.verbs, addressBook: null } },
    })
    const reason = rows.find((row) => row.id === 'verb:addressBook')!.reason!
    expect(reason.key).toBe('palette.reason.NO_CUSTOMER_ATTACHED')
    expect(phrase(reason.key)).toBeTruthy()
  })

  it('and never says it about any OTHER verb, or about an order that has a caller', () => {
    const withCaller = build({
      hasCaller: true,
      actions: { ...ALL_LIVE, verbs: { ...ALL_LIVE.verbs, addressBook: null, slot: null } },
    })
    expect(withCaller.find((row) => row.id === 'verb:addressBook')!.reason).toEqual({
      key: VAGUE_REASON,
    })
    expect(withCaller.find((row) => row.id === 'verb:slot')!.reason).toEqual({ key: VAGUE_REASON })
  })

  // 🚩 A delivery order's store is DERIVED, not refused — no capability carries
  // that, and the vague sentence would leave an agent hunting for a picker that
  // is deliberately not there. It borrows the chip row's own words, so the two
  // surfaces cannot come to say different things about one rule.
  it('says the store follows the address on a delivery order', () => {
    const rows = build({
      pickup: false,
      actions: { ...ALL_LIVE, verbs: { ...ALL_LIVE.verbs, changeStore: null } },
    })
    const reason = rows.find((row) => row.id === 'verb:changeStore')!.reason!
    expect(reason.key).toBe(STORE_FOLLOWS_ADDRESS)
    expect(phrase(reason.key)).toBeTruthy()
  })

  it('...and never on a collection order, where the store IS the agent’s choice', () => {
    const rows = build({
      pickup: true,
      actions: { ...ALL_LIVE, verbs: { ...ALL_LIVE.verbs, changeStore: null } },
    })
    // Whatever it says there, it is not the delivery sentence: on a collection
    // order a shut store row is a real refusal, and `capabilityReasons` (or the
    // vague phrase) is what may speak for it.
    expect(rows.find((row) => row.id === 'verb:changeStore')!.reason!.key).not.toBe(
      STORE_FOLLOWS_ADDRESS,
    )
  })

  it('gives a verb with no reason available a vague sentence rather than none', () => {
    const rows = build({ actions: { ...ALL_LIVE, verbs: { ...ALL_LIVE.verbs, note: null } } })
    const note = rows.find((row) => row.id === 'verb:note')!
    expect(note.reason).toEqual({ key: VAGUE_REASON })
    expect(phrase(VAGUE_REASON)).toBeTruthy()
  })

  it('🚩 a dead *Place order* borrows the receipt’s own blocker, not a second sentence', () => {
    const rows = build({
      capabilities: capabilities({ canSubmit: false, submitBlockers: ['NO_LINES'] }),
      actions: { ...ALL_LIVE, place: null },
    })
    const place = rows.find((row) => row.id === 'terminal:place')!
    expect(place.enabled).toBe(false)
    expect(place.reason).toEqual({ key: 'blockers.NO_LINES' })
    expect(phrase(place.reason!.key)).toBeTruthy()
  })

  it('still says something when submit is dead and the server named nothing', () => {
    const rows = build({
      capabilities: capabilities({ canSubmit: false, submitBlockers: [] }),
      actions: { ...ALL_LIVE, place: null },
    })
    expect(rows.find((row) => row.id === 'terminal:place')!.reason).toEqual({ key: VAGUE_REASON })
  })

  it('🚩 running a disabled row does NOTHING — it is never skipped past', () => {
    const rows = build({ actions: { ...ALL_LIVE, verbs: { ...ALL_LIVE.verbs, slot: null } } })
    const aim = rows.findIndex((row) => row.id === 'verb:slot')
    // Highlightable…
    expect(paletteAim({ index: aim, term: paletteQuestion(rows, '') }, rows, paletteQuestion(rows, ''))).toBe(aim)
    // …and inert.
    expect(paletteRun(rows, aim)).toBeNull()
  })
})

describe('nothingOnTheKeyboardCanEndACall', () => {
  it('🚩 never auto-aims at a terminal act', () => {
    const rows = build({ guidance: guidanceView(NEAR_MISS_CLASSES) })
    expect(rows[autoHighlight(rows)!].kind).not.toBe('terminal')
  })

  // Ruling 3's sharpest case: the query matches ONLY the act that ends the call.
  it('🚩 aims at NOTHING when the query matches only *Abandon call*', () => {
    const rows = filterRows(build(), 'abandon', textOf)
    expect(rows.map((row) => row.id)).toEqual(['terminal:abandon'])
    expect(autoHighlight(rows)).toBeNull()
    expect(paletteAim(NO_HIGHLIGHT, rows, paletteQuestion(rows, 'abandon'))).toBeNull()
    // `Enter` on it, unpressed, reaches nothing at all.
    expect(paletteRun(rows, paletteAim(NO_HIGHLIGHT, rows, paletteQuestion(rows, 'abandon')))).toBeNull()
  })

  it('reaches *Abandon call* only after a deliberate ↓', () => {
    const rows = filterRows(build(), 'abandon', textOf)
    const question = paletteQuestion(rows, 'abandon')
    const moved = moveHighlight(NO_HIGHLIGHT, { count: rows.length, term: question, armed: true }, 'down')
    expect(paletteRun(rows, paletteAim(moved, rows, question))?.id).toBe('terminal:abandon')
  })

  it('🚩 the same for *Place order* — a matching query still aims one row short', () => {
    // A query the verb row and the terminal both answer: the verb takes the aim.
    const rows = filterRows(build(), 'e', textOf)
    expect(rows.some((row) => row.id === 'terminal:place')).toBe(true)
    expect(rows[autoHighlight(rows)!].kind).not.toBe('terminal')
  })
})

describe('theAimFollowsTheQuestion', () => {
  /** The aim as the component holds it: an index against a whole question. */
  const aimAt = (rows: PaletteRow[], query: string, presses = 1) => {
    const question = paletteQuestion(rows, query)
    let state = NO_HIGHLIGHT
    for (let n = 0; n < presses; n++)
      state = moveHighlight(state, { count: rows.length, term: question, armed: true }, 'down')
    return state
  }

  it('aims at the first non-terminal row before anything is pressed', () => {
    const rows = build()
    expect(paletteAim(NO_HIGHLIGHT, rows, paletteQuestion(rows, ''))).toBe(0)
    expect(rows[0].id).toBe('verb:searchItems')
  })

  it('🚩 a new query drops a carried aim — a stale one runs the wrong act', () => {
    const rows = build()
    const aimed = aimAt(rows, 'note')
    // Same question: the agent's own aim stands.
    expect(paletteAim(aimed, rows, paletteQuestion(rows, 'note'))).toBe(0)
    // A different one: back to the first row of the NEW answer.
    const narrowed = filterRows(rows, 'coupon', textOf)
    expect(paletteAim(aimed, narrowed, paletteQuestion(narrowed, 'coupon'))).toBe(0)
    expect(narrowed[0].id).toBe('verb:coupon')
  })

  /**
   * 🚩 The defect this shape exists to close, and the sharpest one on the
   * screen. The rows are rebuilt from the live `SessionState`, so an add landing
   * or an offer arriving reshuffles them **under an open palette** with the
   * query untouched. An aim carried on the index alone would then designate a
   * different row — and `highlight.ts` clamps an over-long index to the LAST
   * row, which in this list is *Abandon call*.
   */
  it('🚩 drops the aim when the ROWS change under it, rather than sliding it onto a terminal', () => {
    const withOffer = build({ guidance: guidanceView(NEAR_MISS_CLASSES) })
    // The agent walks down to the last row there is: *Abandon call*.
    const deep = aimAt(withOffer, '', withOffer.length)
    expect(withOffer[paletteAim(deep, withOffer, paletteQuestion(withOffer, ''))!].id).toBe(
      'terminal:abandon',
    )
    // The offer is taken by the basket moving: one row shorter, same query.
    const shorter = build()
    const aim = paletteAim(deep, shorter, paletteQuestion(shorter, ''))
    expect(shorter[aim!].kind).not.toBe('terminal')
    expect(aim).toBe(autoHighlight(shorter))
  })

  it('keeps the aim across a re-render that changes nothing', () => {
    const rows = build()
    const aimed = aimAt(rows, '', 3)
    const again = build()
    expect(paletteAim(aimed, again, paletteQuestion(again, ''))).toBe(2)
  })
})

describe('filterRows', () => {
  it('matches the rendered words, not the i18n key, and keeps the order', () => {
    const rows = build({ guidance: guidanceView(NEAR_MISS_CLASSES) })
    const found = filterRows(rows, 'CALLER', textOf)
    expect(found.map((row) => row.id)).toEqual(['verb:attachCaller'])
    // The unfiltered list is the whole list, untouched.
    expect(filterRows(rows, '  ', textOf)).toEqual(rows)
  })

  it('finds an offer by the words the SERVER used for it', () => {
    const guidance = guidanceView(NEAR_MISS_CLASSES)
    const word = guidance.actionable[0].description.split(' ')[0]
    const found = filterRows(build({ guidance }), word, textOf)
    expect(found.some((row) => row.kind === 'offer')).toBe(true)
  })
})

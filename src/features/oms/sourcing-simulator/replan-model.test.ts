/**
 * Ticket 963 (BackOffice spec 4354 §11, §19; 4281 decisions 11 and 13): a changed weight or pin plans again on the same
 * figures (`basedOnRun`); when the held copy is gone (`ADVISE-404`) the cart runs again; a change that needed a figure
 * the earlier run never read is read afresh, and the screen says so (`READ_AFRESH`).
 */
import { describe, expect, it } from 'vitest'
import { ApiError } from '@/core/api'
import type { AdviseCartRequest, AdvisePin, AdviseReply } from '@/core/models/sourcing-run'
import fixture from './advise-reply.fixture.json'
import { cartAgain, movedAsk, plansStale, runBasis, runRequest, sameAsk, type RunAsk } from './replan-model'
import { replayRequest } from './replay'

const reply = fixture as unknown as AdviseReply

/** 4281's simulator request, cart part. */
const cart: AdviseCartRequest = {
  channel: 'IOS',
  lines: [
    { lineNo: 1, item: '100234', quantity: 2, unit: 'EA' },
    { lineNo: 2, item: '100871', quantity: 1, unit: 'EA' },
    { lineNo: 3, item: '104410', quantity: 1, unit: 'EA' },
  ],
  customer: { point: { lat: 24.7741, lng: 46.7386 } },
  level: 'full',
  allPlans: true,
}
const baseline = { name: 'Baseline', version: 1 }
const draft = { draft: { basedOn: baseline, values: { companyCostWeight: 1.5 } } }
const pin: AdvisePin = { kind: 'LINE_STORE', lineNo: 3, store: '1090' }
const first: RunAsk = { cart, pins: [], weightSet: baseline }
const last = { ask: first, runId: '01JDM3K8Q2V7X4T9B6N0R5W1YZ' }

const notFound = new ApiError('business', 'Not found: run 01JDM3K8Q2V7X4T9B6N0R5W1YZ.', 404, [
  { errorCode: 'ADVISE-404', internalErrorCode: '', errorMessage: 'Not found: run 01JDM3K8Q2V7X4T9B6N0R5W1YZ.' },
])

describe('what Run sends', () => {
  it('the first run sends the cart, with the weight set it names', () => {
    expect(runRequest(first, null)).toEqual({ ...cart, weightSet: baseline })
  })

  it('a changed weight on the same cart plans again on the earlier run’s figures', () => {
    expect(runRequest({ ...first, weightSet: draft }, last)).toEqual({
      basedOnRun: '01JDM3K8Q2V7X4T9B6N0R5W1YZ',
      weightSet: draft,
      level: 'full',
      allPlans: true,
    })
  })

  it('a new pin on the same cart plans again too, sending the pins', () => {
    expect(runRequest({ ...first, pins: [pin] }, last)).toEqual({
      basedOnRun: '01JDM3K8Q2V7X4T9B6N0R5W1YZ',
      weightSet: baseline,
      pins: [pin],
      level: 'full',
      allPlans: true,
    })
  })

  it('a changed cart, or a moved customer, is a new run with its own read', () => {
    const moved = { ...cart, customer: { point: { lat: 24.78, lng: 46.7386 } } }
    expect(runRequest({ ...first, cart: moved, pins: [pin] }, last)).toEqual({ ...moved, pins: [pin], weightSet: baseline })
  })

  it('Run again with nothing changed reads afresh: the cart, not the earlier run', () => {
    expect(runRequest(first, last)).toEqual({ ...cart, weightSet: baseline })
  })
})

describe('when the held copy is gone', () => {
  it('a 404 on planning again runs the cart again, with the weight set and pins now set', () => {
    const ask = { ...first, weightSet: draft, pins: [pin] }
    expect(cartAgain(runRequest(ask, last), notFound, ask)).toEqual({ ...cart, pins: [pin], weightSet: draft })
  })

  it('a 404 on the cart itself, or another refusal on planning again, is shown as it is', () => {
    expect(cartAgain(runRequest(first, null), notFound, first)).toBeNull()
    const busy = new ApiError('server', 'busy', 503, [{ errorCode: 'ADVISE-511', internalErrorCode: '', errorMessage: 'busy' }])
    expect(cartAgain(runRequest({ ...first, weightSet: draft }, last), busy, first)).toBeNull()
  })
})

describe('what the run stands on', () => {
  it('a run planned again says the figures are as read at a time, from the earlier run', () => {
    const again: AdviseReply = { ...reply, runId: '01JDM3M0000000000000000000', basedOnRun: '01JDM3K8Q2V7X4T9B6N0R5W1YZ', figuresReadAt: '2026-11-26 19:42:03' }
    expect(runBasis(again, { heldGone: false })).toEqual({
      figuresFrom: { runId: '01JDM3K8Q2V7X4T9B6N0R5W1YZ', readAt: '2026-11-26 19:42:03' },
      readAfresh: null,
      heldGone: false,
    })
  })

  it('a change that needed a wider read is said, with the server’s why', () => {
    const afresh: AdviseReply = { ...reply, solve: { ...reply.solve, marks: ['ASSUMED_RATES', 'READ_AFRESH'], readAfreshWhy: 'a mode switched on: CARRIER_SAME_DAY' } }
    expect(runBasis(afresh, { heldGone: false }).readAfresh).toEqual({ why: 'a mode switched on: CARRIER_SAME_DAY' })
  })

  it('a fresh cart run says nothing of an earlier run; one run after the held copy was gone says so', () => {
    expect(runBasis(reply, { heldGone: false })).toEqual({ figuresFrom: null, readAfresh: null, heldGone: false })
    expect(runBasis(reply, { heldGone: true }).heldGone).toBe(true)
  })
})

describe('moving the customer on the map plans the run on screen again (review 4354 #3)', () => {
  const planned: AdviseCartRequest = { ...cart, plannedFor: '2026-11-27 14:30:00' }
  const onScreen: RunAsk = { cart: planned, pins: [pin], weightSet: draft }
  const to = { lat: 24.7012, lng: 46.6911 }

  it('a cart keeps every line, its time, its pins and its set; only the point changes', () => {
    expect(movedAsk(onScreen, to)).toEqual({ cart: { ...planned, customer: { point: to } }, pins: [pin], weightSet: draft })
  })

  it('so a form edited since — even one that cannot run — changes nothing of what is moved', () => {
    // The ask is built from the run on screen alone: there is no form to read, so nothing can come back empty.
    expect(movedAsk(onScreen, to).cart).toMatchObject({ lines: cart.lines, channel: 'IOS' })
  })

  it('a replay is planned from the point placed, and back from the order’s own point', () => {
    const replayed: RunAsk = { cart: { orderNumber: '4500718405', level: 'full', allPlans: true, withCustomerPoint: true }, pins: [], weightSet: null }
    const moved = movedAsk(replayed, to)
    expect(moved.cart).toEqual({ ...replayed.cart, customer: { point: to } })
    expect(movedAsk(moved, null).cart).toEqual(replayed.cart)
  })

  it('the moved run is the same ask the form, moved the same way, now makes: the plans do not read as stale', () => {
    const order = { orderNumber: '4500718405', withPoint: true, movedTo: null }
    const replayed: RunAsk = { cart: replayRequest(order)!, pins: [], weightSet: baseline }
    expect(sameAsk(movedAsk(replayed, to), { ...replayed, cart: replayRequest({ ...order, movedTo: to })! })).toBe(true)
    expect(sameAsk(movedAsk(movedAsk(replayed, to), null), replayed)).toBe(true)
  })

  it('a moved run is a new run with its own read, never a plan again on the earlier figures', () => {
    expect(runRequest(movedAsk(first, to), last)).not.toHaveProperty('basedOnRun')
  })
})

describe('the plans read as stale when the form no longer asks for them (review 2 #2)', () => {
  it('a run of this page is stale once the ask changes, or while the form cannot run', () => {
    expect(plansStale({ ask: first, stored: false }, first)).toBe(false)
    expect(plansStale({ ask: first, stored: false }, { ...first, pins: [pin] })).toBe(true)
    expect(plansStale({ ask: first, stored: false }, null)).toBe(true)
  })

  it('a stored run opened by its link is stale once a pin or the weight set changes from what it ran', () => {
    expect(plansStale({ ask: first, stored: true }, first)).toBe(false)
    expect(plansStale({ ask: first, stored: true }, { ...first, weightSet: { name: 'Express margin', version: 5 } })).toBe(true)
    expect(plansStale({ ask: first, stored: true }, { ...first, pins: [pin] })).toBe(true)
  })

  it('but not while the form asks nothing yet: a stored cart run never kept its point', () => {
    expect(plansStale({ ask: first, stored: true }, null)).toBe(false)
  })

  it('nothing on screen is never stale', () => {
    expect(plansStale(null, first)).toBe(false)
  })
})

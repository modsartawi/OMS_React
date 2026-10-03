/**
 * The one-shot `open` intent (spec 380 L14, D9; rulings 367 §3, 371): what the list's R / C / N
 * and the inspector's act rows ask Delivery details to open, and how Details answers it through
 * its own command gate. Pure: the gate is handed in.
 */
import { describe, expect, it } from 'vitest'

import {
  OPEN_INTENTS,
  cameFromList,
  fromListState,
  openIntentOf,
  openIntentState,
  resolveOpenIntent,
  withoutOpenIntent,
  type IntentGate,
} from './open-intent'

const REQUEST_OPEN = 'A cancellation request is already open for this document.'

/** The command bar's answer on a delivery with a cancellation request already open. */
const requestAlreadyOpen: IntentGate = (intent) =>
  intent === 'request-close' ? { disabled: true, reason: REQUEST_OPEN } : { disabled: false, reason: null }

const everythingAllowed: IntentGate = () => ({ disabled: false, reason: null })

describe('intentResolvesThroughCommandGate', () => {
  it('an allowed reschedule resolves to open', () => {
    expect(resolveOpenIntent('reschedule', requestAlreadyOpen)).toEqual({ outcome: 'open', intent: 'reschedule' })
  })

  it("a request-close with a request already open resolves to refuse, carrying that command's reason", () => {
    expect(resolveOpenIntent('request-close', requestAlreadyOpen)).toEqual({
      outcome: 'refuse',
      intent: 'request-close',
      reason: REQUEST_OPEN,
    })
  })

  it('an unknown intent resolves to nothing', () => {
    expect(resolveOpenIntent('force-close', everythingAllowed)).toBeNull()
    expect(resolveOpenIntent('', everythingAllowed)).toBeNull()
    expect(resolveOpenIntent(null, everythingAllowed)).toBeNull()
    expect(resolveOpenIntent(undefined, everythingAllowed)).toBeNull()
    expect(resolveOpenIntent(7, everythingAllowed)).toBeNull()
  })

  it('add-note opens, through the same gate (until the composer exists, the Add note dialog)', () => {
    expect(resolveOpenIntent('add-note', everythingAllowed)).toEqual({ outcome: 'open', intent: 'add-note' })
  })

  it('reads the gate for the intent it resolves, and only that one', () => {
    const asked: string[] = []
    resolveOpenIntent('reschedule', (intent) => {
      asked.push(intent)
      return { disabled: false, reason: null }
    })
    expect(asked).toEqual(['reschedule'])
  })

  it('a command the gate does not know resolves to nothing', () => {
    expect(resolveOpenIntent('reschedule', () => null)).toBeNull()
    expect(resolveOpenIntent('reschedule', () => undefined)).toBeNull()
  })

  it('a command disabled with no reason (the page is busy) opens nothing and refuses nothing', () => {
    expect(resolveOpenIntent('reschedule', () => ({ disabled: true, reason: null }))).toBeNull()
  })

  it('a reason on an enabled command is not a refusal', () => {
    expect(resolveOpenIntent('reschedule', () => ({ disabled: false, reason: 'stale' }))).toEqual({
      outcome: 'open',
      intent: 'reschedule',
    })
  })
})

describe('the router state that carries it', () => {
  it('names the three acts the list offers', () => {
    expect(OPEN_INTENTS).toEqual(['reschedule', 'request-close', 'add-note'])
  })

  it('round-trips through the state the list navigates with', () => {
    for (const intent of OPEN_INTENTS) expect(openIntentOf(openIntentState(intent))).toBe(intent)
  })

  it('reads anything else as no intent, defensively', () => {
    expect(openIntentOf(null)).toBeNull()
    expect(openIntentOf(undefined)).toBeNull()
    expect(openIntentOf('reschedule')).toBeNull()
    expect(openIntentOf({})).toBeNull()
    expect(openIntentOf({ open: 'close' })).toBeNull()
    expect(openIntentOf({ open: 42 })).toBeNull()
    expect(openIntentOf([])).toBeNull()
  })

  it('takes the intent out of the state and keeps the rest', () => {
    expect(withoutOpenIntent({ open: 'reschedule', from: 'list' })).toEqual({ from: 'list' })
    expect(withoutOpenIntent({ open: 'reschedule' })).toBeNull()
    expect(withoutOpenIntent(null)).toBeNull()
    expect(withoutOpenIntent('kept')).toBe('kept')
    const other = { from: 'list' }
    expect(withoutOpenIntent(other)).toBe(other)
  })
})

describe('cameFromList (ticket 405, D10: Esc goes back to the list)', () => {
  it('every way the list opens Details marks the entry as come from the list', () => {
    expect(cameFromList(fromListState())).toBe(true)
    for (const intent of OPEN_INTENTS) expect(cameFromList(openIntentState(intent))).toBe(true)
  })

  it('the mark outlives the intent being replaced away, so Esc still goes back', () => {
    expect(cameFromList(withoutOpenIntent(openIntentState('add-note')))).toBe(true)
  })

  it('a pasted link, a palette jump or anything else did not come from the list', () => {
    expect(cameFromList(null)).toBe(false)
    expect(cameFromList(undefined)).toBe(false)
    expect(cameFromList({})).toBe(false)
    expect(cameFromList({ from: 'palette' })).toBe(false)
    expect(cameFromList('list')).toBe(false)
  })
})

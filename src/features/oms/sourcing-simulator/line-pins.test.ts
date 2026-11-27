/**
 * Review 4354 #1: a line pin stands by the cart row it was set on (or by the replayed order's line), not by a line
 * number. The request numbers the filled rows by position, so a pin set on line 2 follows its row when an earlier row is
 * emptied or removed, goes when its own row goes, and never lands on a replayed order's line 2.
 */
import { describe, expect, it } from 'vitest'
import type { AdvisePin } from '@/core/models/sourcing-run'
import type { CartForm } from './cart'
import { addHeld, holdPin, keepHeld, pinsNow, runLines, toggleHeld, type PinScope } from './line-pins'

const form = (lines: [number, string][]): CartForm => ({
  channel: 'WEB',
  time: '',
  goodsTotal: '',
  lines: lines.map(([key, item]) => ({ key, item, quantity: '1' })),
  lat: '24.7',
  lng: '46.7',
})
const build = (f: CartForm): PinScope => ({ start: 'build', form: f, replay: { orderNumber: '', withPoint: false, movedTo: null } })
const replay = (orderNumber: string, f: CartForm = form([])): PinScope => ({ start: 'replay', form: f, replay: { orderNumber, withPoint: false, movedTo: null } })

const THREE = form([
  [1, 'A'],
  [2, 'B'],
  [3, 'C'],
])
const storeOn = (lineNo: number): AdvisePin => ({ kind: 'LINE_STORE', lineNo, store: '1090' })

describe('a line pin set from the plans on screen', () => {
  it('names the row the run sent as that line, and is sent under that line while nothing moves', () => {
    const lines = runLines(build(THREE))
    const held = addHeld([], holdPin(storeOn(2), lines)!)
    expect(pinsNow(held, build(THREE))).toEqual([storeOn(2)])
  })

  it('follows its row when an earlier row is removed: line 2 is sent as line 1', () => {
    const held = addHeld([], holdPin(storeOn(2), runLines(build(THREE)))!)
    const without = form([
      [2, 'B'],
      [3, 'C'],
    ])
    expect(pinsNow(held, build(without))).toEqual([storeOn(1)])
  })

  it('follows its row when an earlier row is emptied, and stays put when a row is added after it', () => {
    const held = addHeld([], holdPin(storeOn(3), runLines(build(THREE)))!)
    const emptied = form([
      [1, ''],
      [2, 'B'],
      [3, 'C'],
      [4, 'D'],
    ])
    expect(pinsNow(held, build(emptied))).toEqual([storeOn(2)])
  })

  it('a pin set from a run on screen after its form changed still names the run’s row', () => {
    // The run sent A, B, C; the user has since removed A. "Line 2" on screen is B — row 2 — now sent as line 1.
    const lines = runLines(build(THREE))
    const now = build(form([
      [2, 'B'],
      [3, 'C'],
    ]))
    expect(pinsNow(addHeld([], holdPin(storeOn(2), lines)!), now)).toEqual([storeOn(1)])
  })

  it('goes when its own row is removed or emptied', () => {
    const held = addHeld([], holdPin(storeOn(2), runLines(build(THREE)))!)
    const removed = build(form([
      [1, 'A'],
      [3, 'C'],
    ]))
    const emptied = build(form([
      [1, 'A'],
      [2, ' '],
      [3, 'C'],
    ]))
    expect(pinsNow(held, removed)).toEqual([])
    expect(pinsNow(held, emptied)).toEqual([])
    expect(keepHeld(held, removed)).toEqual([])
  })

  it('a pin on a line the run never sent is not held', () => {
    expect(holdPin(storeOn(4), runLines(build(THREE)))).toBeNull()
  })

  it('a second store pin on the same row takes the first one’s place, whatever line it is sent as', () => {
    const lines = runLines(build(THREE))
    const held = addHeld(addHeld([], holdPin(storeOn(2), lines)!), holdPin({ kind: 'LINE_STORE', lineNo: 2, store: '2040' }, lines)!)
    expect(pinsNow(held, build(THREE))).toEqual([{ kind: 'LINE_STORE', lineNo: 2, store: '2040' }])
  })
})

describe('a plan’s pin button (review 4354 #10)', () => {
  it('pressed sets the pin; pressed again takes it off', () => {
    const lines = runLines(build(THREE))
    const on = toggleHeld([], holdPin(storeOn(2), lines)!)
    expect(pinsNow(on, build(THREE))).toEqual([storeOn(2)])
    expect(toggleHeld(on, holdPin(storeOn(2), lines)!)).toEqual([])
  })

  it('pressing another store for the same row replaces the pin rather than taking it off', () => {
    const lines = runLines(build(THREE))
    const on = toggleHeld([], holdPin(storeOn(2), lines)!)
    const other = toggleHeld(on, holdPin({ kind: 'LINE_STORE', lineNo: 2, store: '2040' }, lines)!)
    expect(pinsNow(other, build(THREE))).toEqual([{ kind: 'LINE_STORE', lineNo: 2, store: '2040' }])
  })
})

describe('build and replay keep their own line pins', () => {
  it('a cart’s line pin is not sent with a replay, and comes back with the cart', () => {
    const held = addHeld([], holdPin(storeOn(2), runLines(build(THREE)))!)
    expect(pinsNow(held, replay('4500718405', THREE))).toEqual([])
    expect(keepHeld(held, replay('4500718405', THREE))).toEqual([])
  })

  it('a replayed order’s line pin is sent with that order only — never with another order or a cart', () => {
    const held = addHeld([], holdPin(storeOn(2), runLines(replay('4500718405')))!)
    expect(pinsNow(held, replay(' 4500718405 '))).toEqual([storeOn(2)])
    expect(pinsNow(held, replay('4500718406'))).toEqual([])
    expect(pinsNow(held, build(THREE))).toEqual([])
  })

  it('a pin on no line goes with every run', () => {
    const notStore: AdvisePin = { kind: 'NOT_STORE', store: '1090' }
    const held = addHeld([], holdPin(notStore, runLines(build(THREE)))!)
    expect(pinsNow(held, replay('4500718405'))).toEqual([notStore])
    expect(keepHeld(held, replay('4500718405'))).toHaveLength(1)
  })
})

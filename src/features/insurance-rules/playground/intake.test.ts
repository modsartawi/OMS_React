/**
 * Ticket 684 — a Raw experiment's intake report: the keys the engine read, the keys it ignored (each with its hint)
 * and the values it refused for the wrong type (each with the type it expected). A data experiment's intake is empty
 * and shows nothing.
 */
import { describe, expect, it } from 'vitest'
import type { PlaygroundIntake } from '@/core/insurance-rules/playground'
import { intakeView } from './intake'

describe('intakeView', () => {
  it('read, ignored-with-hint and refused-with-expected each become a row', () => {
    const v = intakeView({
      read: ['lines[0].quantity', 'lines[0].item'],
      ignored: [{ path: 'lines[0].qty', hint: 'quantity' }, { path: 'patient.nickname', hint: null }],
      refused: [{ path: 'lines[0].price', expected: 'number' }],
    })
    expect(v).toEqual({
      read: ['lines[0].quantity', 'lines[0].item'],
      ignored: [
        { path: 'lines[0].qty', hint: 'quantity' },
        { path: 'patient.nickname', hint: null },
      ],
      refused: [{ path: 'lines[0].price', expected: 'number' }],
    })
  })

  it('an empty intake (a data experiment) shows nothing', () => {
    expect(intakeView(null)).toBeNull()
    expect(intakeView(undefined)).toBeNull()
    expect(intakeView({})).toBeNull()
    expect(intakeView({ read: [], ignored: [], refused: [] })).toBeNull()
  })

  it('a section HQ leaves out reads as empty; a junk entry is dropped', () => {
    const junk: unknown = { ignored: [{ path: 'lines[0].qty', hint: 'quantity' }, { hint: 'x' }, 7] }
    expect(intakeView(junk as PlaygroundIntake)).toEqual({
      read: [],
      ignored: [{ path: 'lines[0].qty', hint: 'quantity' }],
      refused: [],
    })
  })
})

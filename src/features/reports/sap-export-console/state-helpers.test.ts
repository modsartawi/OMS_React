import { describe, expect, it } from 'vitest'
import { STATE_CODES, type StateCounts } from '@/core/models/sap-export'
import { presentStates, stateMeaningKey } from './state-helpers'
import en from '@/locales/en/sap-export-console.json'

describe('stateMeaningKey', () => {
  it('has a key for every contract code, and the bundle has its meaning', () => {
    const contract = ['L1', 'L2a', 'L2b', 'L3', 'L4', 'L5', 'L6', 'L7', 'L8', 'L9', 'L10', 'N1', 'N2', 'N3', 'N4', 'N5', 'N6', 'N7', 'N8', 'N9', 'N10', 'N11', 'U']
    expect([...STATE_CODES]).toEqual(contract)
    for (const code of contract) {
      expect(stateMeaningKey(code)).toBe(`states.${code}`)
      expect((en.states as Record<string, string>)[code]).toBeTruthy()
    }
  })

  it("reads the contract's table", () => {
    expect(en.states.N1).toBe('Held')
    expect(en.states.L2a).toBe('Logged, file missing')
    expect(en.states.L10).toBe('Passed over')
    expect(en.states.U).toBe('Unclassified (a census fault)')
  })

  it('falls back to null for an unknown code, so the raw code shows', () => {
    expect(stateMeaningKey('L11')).toBeNull()
    expect(stateMeaningKey('l1')).toBeNull()
    expect(stateMeaningKey('toString')).toBeNull()
    expect(stateMeaningKey('')).toBeNull()
  })
})

describe('presentStates', () => {
  it('lists the non-zero codes in the contract order, whatever order the door sent', () => {
    const counts = { N10: 1, L9: 4, N1: 2, L2a: 0 } as StateCounts
    expect(presentStates(counts)).toEqual([
      { code: 'L9', count: 4 },
      { code: 'N1', count: 2 },
      { code: 'N10', count: 1 },
    ])
  })

  it('keeps an unknown code the door sent, after the known ones', () => {
    const counts = { N1: 1, Z9: 3 } as unknown as StateCounts
    expect(presentStates(counts)).toEqual([
      { code: 'N1', count: 1 },
      { code: 'Z9', count: 3 },
    ])
  })

  it('keeps a chosen state at 0, so an active filter never vanishes from the legend', () => {
    expect(presentStates({ N1: 2 }, ['N8'])).toEqual([
      { code: 'N1', count: 2 },
      { code: 'N8', count: 0 },
    ])
  })

  it('is empty for no states', () => {
    expect(presentStates({})).toEqual([])
  })
})

import { describe, expect, it } from 'vitest'
import { refusalKey, toggleInOrder } from './toggle-and-refusal'

const ORDER = ['stuck', 'behind', 'waiting'] as const

describe('toggleInOrder', () => {
  it('adds a value in the canonical order, however it was clicked', () => {
    expect(toggleInOrder(ORDER, ['waiting'], 'stuck')).toEqual(['stuck', 'waiting'])
  })
  it('removes a chosen value', () => {
    expect(toggleInOrder(ORDER, ['stuck', 'waiting'], 'stuck')).toEqual(['waiting'])
  })
  it('refuses an unknown value', () => {
    expect(toggleInOrder(ORDER, ['stuck'], 'nope')).toBeNull()
  })
})

describe('refusalKey', () => {
  it('words a known refusal under the screen prefix', () => {
    expect(refusalKey('fleet', ['BAD_PAGING'], 'BAD_PAGING')).toBe('fleet.errors.BAD_PAGING')
  })
  it('leaves an unknown or missing code to the envelope message', () => {
    expect(refusalKey('fleet', ['BAD_PAGING'], 'LAST_ADMIN')).toBeNull()
    expect(refusalKey('fleet', ['BAD_PAGING'], null)).toBeNull()
  })
})

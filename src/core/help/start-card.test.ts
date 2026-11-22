/** oms 952 (BackOffice spec 4182 §D, story 9): the "New to Analytics? Start here" card, dismissed per user in local storage. */
import { describe, expect, it } from 'vitest'
import { dismissStartCard, startCardShown } from './start-card'

function memory(): Pick<Storage, 'getItem' | 'setItem'> {
  const m = new Map<string, string>()
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v) }
}

const throwing: Pick<Storage, 'getItem' | 'setItem'> = {
  getItem: () => {
    throw new Error('SecurityError')
  },
  setItem: () => {
    throw new Error('QuotaExceededError')
  },
}

describe('the Home "Start here" card', () => {
  it('shows until its user dismisses it, and stays hidden after', () => {
    const storage = memory()
    expect(startCardShown('ahmad', storage)).toBe(true)
    dismissStartCard('ahmad', storage)
    expect(startCardShown('ahmad', storage)).toBe(false)
    // Each user dismisses it for themself.
    expect(startCardShown('sara', storage)).toBe(true)
  })

  it('shows again when storage throws, and dismissing does not throw', () => {
    expect(startCardShown('ahmad', throwing)).toBe(true)
    expect(() => dismissStartCard('ahmad', throwing)).not.toThrow()
    expect(startCardShown('ahmad', undefined)).toBe(true)
  })
})

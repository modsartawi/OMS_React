/**
 * Review 4354 #9: an order's estimate in words, shared by the orders drawer and the bar tab's largest differences. No
 * difference reads "at the same time", never "0 minutes later".
 */
import type { TFunction } from 'i18next'
import { describe, expect, it } from 'vitest'
import { fsi } from '@/core/util/bidi'
import { estimateWords } from './estimate-words'

// A stand-in `t` that writes the key and its minutes, so the test reads which sentence was chosen.
const t = ((key: string, o?: { minutes?: string }) => (o?.minutes ? `${key}(${o.minutes})` : key)) as unknown as TFunction<'sourcing-results'>

describe('an estimate in words', () => {
  it('no difference reads the same time, not zero minutes later', () => {
    expect(estimateWords(t, 0)).toBe('drawer.estimate.same')
  })

  it('a plus is the advisor earlier, a minus later, each by its whole minutes', () => {
    expect(estimateWords(t, 12)).toBe(`drawer.estimate.earlier(${fsi(12)})`)
    expect(estimateWords(t, -7)).toBe(`drawer.estimate.later(${fsi(7)})`)
  })

  it('no estimate is a dash', () => {
    expect(estimateWords(t, null)).toBe('dash')
  })
})

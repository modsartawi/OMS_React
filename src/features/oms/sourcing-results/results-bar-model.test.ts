import { describe, expect, it } from 'vitest'
import type { ResultsSummaryReply, ResultsTop } from '@/core/models/sourcing-results'
import stub from './stub-summary.json'
import { resultsBar } from './results-bar-model'

// The drive's stub reply: the results prototype's 14 days (39,870 orders compared).
const reply = stub as unknown as ResultsSummaryReply
const top = (over: Partial<ResultsTop> = {}): ResultsTop => ({ ...reply.top, ...over })

describe('resultsBar — the sentence, the six segments and the two brackets', () => {
  it('reads the sentence off the reply as sent', () => {
    expect(resultsBar(top()).sentence).toEqual({ orders: 39870, storesPercent: 77.6, planPercent: 68.8 })
  })

  it('draws the six segments in the spec order, with their counts and shares as sent', () => {
    const bar = resultsBar(top())
    expect(bar.segments.map((s) => [s.segment, s.count, s.percent])).toEqual([
      ['SAME_PLAN', 27430, 68.8],
      ['SAME_STORES_OTHER_WAY', 3520, 8.8],
      ['ANOTHER_STORE', 5180, 13.0],
      ['CALLOUT_FALLBACK', 430, 1.1],
      ['OUTSIDE_RULES', 1240, 3.1],
      ['NOT_COMPARABLE', 2070, 5.2],
    ])
  })

  it('puts a reply that lists the segments out of order back into the spec order', () => {
    const shuffled = [...reply.top.segments].reverse()
    expect(resultsBar(top({ segments: shuffled })).segments.map((s) => s.segment)).toEqual([
      'SAME_PLAN',
      'SAME_STORES_OTHER_WAY',
      'ANOTHER_STORE',
      'CALLOUT_FALLBACK',
      'OUTSIDE_RULES',
      'NOT_COMPARABLE',
    ])
  })

  it('hatches only the callout fallback', () => {
    expect(resultsBar(top()).segments.filter((s) => s.hatched).map((s) => s.segment)).toEqual(['CALLOUT_FALLBACK'])
  })

  it('says the segments add up to the orders compared, and the brackets match their segments', () => {
    const bar = resultsBar(top())
    expect(bar.addsUp).toBe(true)
    expect(bar.bracketsMatch).toBe(true)
  })

  it('says so when the segments do not add up', () => {
    expect(resultsBar(top({ ordersCompared: 39871 })).addsUp).toBe(false)
  })

  it('says so when a bracket disagrees with its segments', () => {
    expect(resultsBar(top({ sameStores: { count: 30000, percent: 75.2 } })).bracketsMatch).toBe(false)
  })

  it('spans the stores bracket over the first two segments and the plan bracket over the first', () => {
    const { brackets } = resultsBar(top())
    expect(brackets.stores).toEqual({ columns: 2, percent: 77.6 })
    expect(brackets.plan).toEqual({ columns: 1, percent: 68.8 })
  })

  it('leaves out a segment with no orders, and the stores bracket then spans the one segment left', () => {
    const segments = reply.top.segments.map((s) => (s.segment === 'SAME_STORES_OTHER_WAY' ? { ...s, count: 0, percent: 0 } : s))
    const bar = resultsBar(top({ segments, ordersCompared: 36350, sameStores: { count: 27430, percent: 75.5 } }))
    expect(bar.segments.map((s) => s.segment)).not.toContain('SAME_STORES_OTHER_WAY')
    expect(bar.brackets.stores.columns).toBe(1)
    expect(bar.addsUp).toBe(true)
  })

  it('gives the orders that break the nesting a segment of their own, last', () => {
    const segments = [...reply.top.segments, { segment: 'BREAKS_NESTING' as const, count: 12, percent: 0.0 }]
    const bar = resultsBar(top({ segments, ordersCompared: 39882 }))
    expect(bar.segments.at(-1)?.segment).toBe('BREAKS_NESTING')
    expect(bar.addsUp).toBe(true)
  })

  it('draws nothing from an empty period', () => {
    const empty = top({
      ordersCompared: 0,
      sameStores: { count: 0, percent: 0 },
      samePlan: { count: 0, percent: 0 },
      segments: [],
    })
    const bar = resultsBar(empty)
    expect(bar.segments).toEqual([])
    expect(bar.empty).toBe(true)
  })
})

import { describe, expect, it } from 'vitest'
import type { ResultsSegmentCount, ResultsTopReply } from '@/core/models/sourcing-results'
import stub from './stub-first.json'
import { resultsBar } from './results-bar-model'

// The drive's stub, in `GET SourcingAdvisor/Results/Top`'s shape (BO 4393): 14 days, 39,870 orders compared.
const reply = stub.top as unknown as ResultsTopReply
const top = (over: Partial<ResultsTopReply> = {}): ResultsTopReply => ({ ...reply, ...over })
const withSegment = (code: string, orders: number, percent: number): ResultsSegmentCount[] =>
  reply.segments.map((s) => (s.code === code ? { ...s, orders, percent } : s))

describe('resultsBar — the sentence, the segments and the two brackets', () => {
  it('reads the sentence off the two brackets as sent', () => {
    expect(resultsBar(top()).sentence).toEqual({ orders: 39870, storesPercent: 77.5, planPercent: 68.8 })
  })

  it('draws the segments in the server order, "breaks the nesting" first, with their counts and shares as sent', () => {
    expect(resultsBar(top()).segments.map((s) => [s.segment, s.count, s.percent])).toEqual([
      ['BREAKS_NESTING', 40, 0.1],
      ['SAME_PLAN_BOTH', 27390, 68.7],
      ['SAME_STORES_OTHER_WAY', 3520, 8.8],
      ['ANOTHER_STORE', 5180, 13.0],
      ['CALLOUT_FALLBACK', 430, 1.1],
      ['OUTSIDE_RULES', 1240, 3.1],
      ['NOT_COMPARABLE', 2070, 5.2],
    ])
  })

  it('puts a reply that lists the segments out of order back into the bar order', () => {
    expect(resultsBar(top({ segments: [...reply.segments].reverse() })).segments.map((s) => s.segment)[0]).toBe('BREAKS_NESTING')
  })

  it('hatches only the callout fallback', () => {
    expect(resultsBar(top()).segments.filter((s) => s.hatched).map((s) => s.segment)).toEqual(['CALLOUT_FALLBACK'])
  })

  it('spans each bracket over the segments the server names for it: the whole plan from the first, the stores only from the second', () => {
    const { brackets } = resultsBar(top())
    expect(brackets.plan).toEqual({ start: 1, columns: 2, orders: 27430, percent: 68.8 })
    expect(brackets.stores).toEqual({ start: 2, columns: 2, orders: 30910, percent: 77.5 })
  })

  it('leaves out a segment with no orders, and the brackets close up over what is drawn', () => {
    const bar = resultsBar(
      top({
        segments: withSegment('BREAKS_NESTING', 0, 0),
        ordersCompared: 39830,
        wholePlan: { segments: ['BREAKS_NESTING', 'SAME_PLAN_BOTH'], orders: 27390, percent: 68.8 },
      }),
    )
    expect(bar.segments.map((s) => s.segment)).not.toContain('BREAKS_NESTING')
    expect(bar.brackets.plan).toMatchObject({ start: 1, columns: 1 })
    expect(bar.brackets.stores).toMatchObject({ start: 1, columns: 2 })
    expect(bar.addsUp).toBe(true)
  })

  it('says the segments add up to the orders compared, and each bracket matches its segments', () => {
    const bar = resultsBar(top())
    expect(bar.addsUp).toBe(true)
    expect(bar.bracketsMatch).toBe(true)
  })

  it('says so when the segments do not add up', () => {
    expect(resultsBar(top({ ordersCompared: 39871 })).addsUp).toBe(false)
  })

  it('says so when a bracket disagrees with its segments', () => {
    expect(resultsBar(top({ storesOnly: { ...reply.storesOnly, orders: 30000 } })).bracketsMatch).toBe(false)
  })

  it('draws nothing, and no bracket, from an empty period', () => {
    const empty = top({
      ordersCompared: 0,
      segments: reply.segments.map((s) => ({ ...s, orders: 0, percent: 0 })),
      storesOnly: { ...reply.storesOnly, orders: 0, percent: 0 },
      wholePlan: { ...reply.wholePlan, orders: 0, percent: 0 },
    })
    const bar = resultsBar(empty)
    expect(bar.segments).toEqual([])
    expect(bar.brackets).toEqual({ stores: null, plan: null })
    expect(bar.empty).toBe(true)
  })
})

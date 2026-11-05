import { describe, expect, it } from 'vitest'
import { fetchedAgo, isBehind, panelFailure, panelPermalink, retiredMembers, unavailableReason } from './panel-state'
import type { AnalyticsModel, AnalyticsViewDefinition } from '@/core/models/analytics'

const now = new Date('2026-11-05T10:00:00')

describe('freshness', () => {
  it('44 min is fine, 46 min is behind', () => {
    expect(isBehind('2026-11-05T09:16:00', now)).toBe(false)
    expect(isBehind('2026-11-05T09:14:00', now)).toBe(true)
  })
  it('exactly 45 min is not yet behind', () => {
    expect(isBehind('2026-11-05T09:15:00', now)).toBe(false)
  })
  it('an absent or unreadable dataAsOf is never called behind', () => {
    expect(isBehind('', now)).toBe(false)
    expect(isBehind('not a time', now)).toBe(false)
  })

  it('fetched-ago wording: under a minute is "just now", then minutes, hours, days', () => {
    expect(fetchedAgo('2026-11-05T09:59:30', now)).toEqual({ key: 'justNow', n: 0 })
    expect(fetchedAgo('2026-11-05T09:59:00', now)).toEqual({ key: 'minutes', n: 1 })
    expect(fetchedAgo('2026-11-05T09:01:00', now)).toEqual({ key: 'minutes', n: 59 })
    expect(fetchedAgo('2026-11-05T08:00:00', now)).toEqual({ key: 'hours', n: 2 })
    expect(fetchedAgo('2026-11-03T09:00:00', now)).toEqual({ key: 'days', n: 2 })
  })
  it('a fetch stamped in the future (clock skew) reads "just now"; none reads nothing', () => {
    expect(fetchedAgo('2026-11-05T10:03:00', now)).toEqual({ key: 'justNow', n: 0 })
    expect(fetchedAgo('', now)).toBeNull()
  })
})

describe('panel failure', () => {
  it('408 and 409 are the retry state; 410 the unavailable state; anything else is a refusal', () => {
    expect(panelFailure('ANALYTICS-408')).toBe('retry')
    expect(panelFailure('ANALYTICS-409')).toBe('retry')
    expect(panelFailure('ANALYTICS-410')).toBe('unavailable')
    expect(panelFailure('ANALYTICS-404')).toBe('refused')
    expect(panelFailure(null)).toBe('refused')
  })

  const model = {
    areas: [
      { key: 'sales', available: true },
      { key: 'callouts', available: false, unavailableReason: 'Waiting on the replica.' },
    ],
    measures: [
      { key: 'orders', area: 'sales' },
      { key: 'callouts', area: 'callouts' },
    ],
    dimensions: [],
  } as unknown as AnalyticsModel
  const def = (measures: string[]) => ({ chart: { type: 'bar' }, query: { measures, dimensions: [], filters: [] } }) as AnalyticsViewDefinition

  it("an unavailable panel says its area's own reason", () => {
    expect(unavailableReason(def(['callouts']), model)).toBe('Waiting on the replica.')
  })
  it('no reason from the model (an available area, or none given) is null, for the server message to stand', () => {
    expect(unavailableReason(def(['orders']), model)).toBeNull()
    expect(unavailableReason(def(['unknown']), model)).toBeNull()
  })

  // 766 §B / story 86: a definition naming a member the model no longer holds is retired, never a broken board.
  it('a definition naming a measure or breakdown the model no longer holds is retired, by those members', () => {
    const withDims = { ...model, dimensions: [{ key: 'store' }] } as unknown as AnalyticsModel
    const d = { chart: { type: 'bar' }, query: { measures: ['orders', 'old_orders'], dimensions: ['store', 'old_zone'], filters: [] } } as AnalyticsViewDefinition
    expect(retiredMembers(d, withDims)).toEqual(['old_orders', 'old_zone'])
    expect(retiredMembers(def(['orders']), withDims)).toEqual([])
  })
  it('406 naming a field is the retired state; 406 naming none is a refusal in its own words', () => {
    expect(panelFailure('ANALYTICS-406', 'query.measures[0]')).toBe('retired')
    expect(panelFailure('ANALYTICS-406')).toBe('refused')
    expect(panelFailure('ANALYTICS-406', '')).toBe('refused')
  })
})

describe('panel permalink', () => {
  it("a board panel's link is the board's URL — filters and all — with the panel as its fragment", () => {
    expect(panelPermalink('http://h/analytics/board/b-ops?region=central&period=last-week', 'p-bar')).toBe(
      'http://h/analytics/board/b-ops?region=central&period=last-week#panel-p-bar',
    )
    expect(panelPermalink('http://h/analytics/board/b-ops?x=1#panel-old', 'p-kpi')).toBe('http://h/analytics/board/b-ops?x=1#panel-p-kpi')
  })
  it("a view page's link is its URL with no fragment", () => {
    expect(panelPermalink('http://h/analytics/view/v-bar#junk')).toBe('http://h/analytics/view/v-bar')
  })
})

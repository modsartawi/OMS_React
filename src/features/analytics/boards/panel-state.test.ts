import { describe, expect, it } from 'vitest'
import { fetchedAgo, isBehind, mayStillRise, panelFailure, panelMarks, panelPermalink, retiredMembers, unavailableReason } from './panel-state'
import type { AnalyticsModel, AnalyticsQueryResult, AnalyticsViewDefinition } from '@/core/models/analytics'

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
      { key: 'callouts', available: false, unavailableReason: { en: 'Waiting on the replica.', ar: 'بانتظار النسخة.' } },
    ],
    measures: [
      { key: 'orders', area: 'sales' },
      { key: 'callouts', area: 'callouts' },
    ],
    dimensions: [],
  } as unknown as AnalyticsModel
  const def = (measures: string[]) => ({ chart: { type: 'bar' }, query: { measures, dimensions: [], filters: [] } }) as AnalyticsViewDefinition

  it("an unavailable panel says its area's own reason", () => {
    expect(unavailableReason(def(['callouts']), model, 'en')).toBe('Waiting on the replica.')
    expect(unavailableReason(def(['callouts']), model, 'ar')).toBe('بانتظار النسخة.')
  })
  it('no reason from the model (an available area, or none given) is null, for the server message to stand', () => {
    expect(unavailableReason(def(['orders']), model, 'en')).toBeNull()
    expect(unavailableReason(def(['unknown']), model, 'en')).toBeNull()
  })

  // 766 §B / story 86: a definition naming a member the model no longer holds is retired, never a broken board.
  it('a definition naming a measure or breakdown the model no longer holds is retired, by those members', () => {
    const withDims = { ...model, dimensions: [{ key: 'store' }] } as unknown as AnalyticsModel
    const d = { chart: { type: 'bar' }, query: { measures: ['orders', 'old_orders'], dimensions: ['store', 'old_zone'], filters: [] } } as AnalyticsViewDefinition
    expect(retiredMembers(d, withDims)).toEqual(['old_orders', 'old_zone'])
    expect(retiredMembers(def(['orders']), withDims)).toEqual([])
  })
  it('863: a variant key is not retired while its own measure is held; it is when that measure goes', () => {
    const withDims = { ...model, dimensions: [{ key: 'store' }] } as unknown as AnalyticsModel
    const variant = (measure: string) =>
      ({
        chart: { type: 'bar' },
        query: { measures: ['orders', 'orders_app'], dimensions: ['store'], filters: [], variants: [{ key: 'orders_app', measure, filters: [{ dimension: 'channel', values: ['app'] }] }] },
      }) as AnalyticsViewDefinition
    expect(retiredMembers(variant('orders'), withDims)).toEqual([])
    expect(retiredMembers(variant('old_orders'), withDims)).toEqual(['orders_app'])
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

describe('mayStillRise (827)', () => {
  const asOf = '2026-11-05T09:45:00'
  it('a day younger than mayStillRiseDays relative to dataAsOf is marked; one that old is not', () => {
    expect(mayStillRise('2026-11-05', asOf, 8)).toBe(true)
    expect(mayStillRise('2026-10-29', asOf, 8)).toBe(true)
    expect(mayStillRise('2026-10-28', asOf, 8)).toBe(false)
    expect(mayStillRise('2026-10-01', asOf, 30)).toBe(false)
    expect(mayStillRise('2026-10-07', asOf, 30)).toBe(true)
  })
  it('reads a day written as a timestamp by its date', () => {
    expect(mayStillRise('2026-10-29T00:00:00', asOf, 8)).toBe(true)
  })
  it('no window, no dataAsOf or an unreadable day marks nothing', () => {
    expect(mayStillRise('2026-11-05', asOf, 0)).toBe(false)
    expect(mayStillRise('2026-11-05', asOf, null)).toBe(false)
    expect(mayStillRise('2026-11-05', '', 8)).toBe(false)
    expect(mayStillRise('central', asOf, 8)).toBe(false)
  })
})

describe('panelMarks (827): the model caveats and the "may still rise" mark of a panel', () => {
  const l = (en: string) => ({ en, ar: `ar ${en}` })
  const m = (key: string, extra: object) => ({ key, area: 'orders', shape: 'rate' as const, unit: 'share' as const, label: l(key), description: l(''), dimensions: ['day', 'channel_group'], ...extra })
  const model827: AnalyticsModel = {
    areas: [],
    measures: [
      m('cancellation_rate', { caveat: l('Inside OMS only'), mayStillRiseDays: 8 }),
      m('claims', { mayStillRiseDays: 30, caveat: l('Inside OMS only') }),
      m('orders', {}),
    ],
    dimensions: [
      { key: 'day', kind: 'time', label: l('Day'), values: [] },
      { key: 'channel_group', kind: 'category', label: l('Channel'), values: [] },
    ],
  }
  const view = (measures: string[], dimensions: string[]): AnalyticsViewDefinition => ({ chart: { type: 'line' }, query: { measures, dimensions, filters: [] } })
  const result = (rows: Record<string, string | number>[], period = { from: '2026-10-01', to: '2026-11-05' }) =>
    ({ columns: [], rows, total: rows.length, truncated: false, period, previous: [], fetchedAt: '', dataAsOf: '2026-11-05T09:45:00' }) as AnalyticsQueryResult

  it('names each distinct caveat of the panel’s measures once', () => {
    expect(panelMarks(view(['cancellation_rate', 'claims', 'orders'], ['day']), undefined, model827).caveats).toEqual([l('Inside OMS only')])
    expect(panelMarks(view(['orders'], ['day']), undefined, model827).caveats).toEqual([])
  })

  it('on a time axis, marks from the first young day the rows hold, using the longest window', () => {
    const rows = ['2026-10-20', '2026-10-28', '2026-10-29', '2026-11-05'].map((day) => ({ day, cancellation_rate: 0.1 }))
    expect(panelMarks(view(['cancellation_rate'], ['day']), result(rows), model827).stillRising).toEqual({ from: '2026-10-29', days: 8 })
    expect(panelMarks(view(['cancellation_rate', 'claims'], ['day']), result(rows), model827).stillRising).toEqual({ from: '2026-10-20', days: 30 })
  })

  it('without a time axis, marks when the period reaches a young day, from the later of its start and the window', () => {
    const rows = [{ channel_group: 'app', cancellation_rate: 0.1 }]
    expect(panelMarks(view(['cancellation_rate'], ['channel_group']), result(rows), model827).stillRising).toEqual({ from: '2026-10-29', days: 8 })
    expect(panelMarks(view(['cancellation_rate'], ['channel_group']), result(rows, { from: '2026-11-01', to: '2026-11-05' }), model827).stillRising).toEqual({ from: '2026-11-01', days: 8 })
    expect(panelMarks(view(['cancellation_rate'], ['channel_group']), result(rows, { from: '2026-09-01', to: '2026-09-30' }), model827).stillRising).toBeNull()
  })

  it('a measure without a window, or no answer yet, is never marked', () => {
    const rows = [{ day: '2026-11-05', orders: 4 }]
    expect(panelMarks(view(['orders'], ['day']), result(rows), model827).stillRising).toBeNull()
    expect(panelMarks(view(['cancellation_rate'], ['day']), undefined, model827).stillRising).toBeNull()
  })
})

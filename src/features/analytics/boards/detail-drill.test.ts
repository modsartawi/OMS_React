import { describe, expect, it } from 'vitest'
import type { AnalyticsModel, AnalyticsViewDefinition } from '@/core/models/analytics'
import { deliveriesDrill, periodDays } from './detail-drill'

// Thursday 5 November 2026, mid-morning local time (weeks start on Sunday: 1 November).
const NOW = new Date(2026, 10, 5, 10, 10)

describe('period → Deliveries filter', () => {
  it('a relative period resolves to the same from–to the Deliveries list expects', () => {
    // The Deliveries list's own presets, as its query bar resolves them: today, yesterday, last 7 = today-6..today.
    expect(periodDays('today', NOW)).toEqual({ from: '2026-11-05', to: '2026-11-05' })
    expect(periodDays('yesterday', NOW)).toEqual({ from: '2026-11-04', to: '2026-11-04' })
    expect(periodDays('last-7-days', NOW)).toEqual({ from: '2026-10-30', to: '2026-11-05' })
    expect(periodDays('last-28-days', NOW)).toEqual({ from: '2026-10-09', to: '2026-11-05' })
    expect(periodDays('last-30-days', NOW)).toEqual({ from: '2026-10-07', to: '2026-11-05' })
    expect(periodDays('this-week', NOW)).toEqual({ from: '2026-11-01', to: '2026-11-05' })
    expect(periodDays('last-week', NOW)).toEqual({ from: '2026-10-25', to: '2026-10-31' })
    expect(periodDays('this-month', NOW)).toEqual({ from: '2026-11-01', to: '2026-11-05' })
    expect(periodDays('last-month', NOW)).toEqual({ from: '2026-10-01', to: '2026-10-31' })
    expect(periodDays('year-to-date', NOW)).toEqual({ from: '2026-01-01', to: '2026-11-05' })
  })

  it('a fixed range passes through; an unreadable or absent period is no range', () => {
    expect(periodDays('2026-10-01..2026-10-15', NOW)).toEqual({ from: '2026-10-01', to: '2026-10-15' })
    expect(periodDays('2026-10-15..2026-10-01', NOW)).toBeNull()
    expect(periodDays('next-decade', NOW)).toBeNull()
    expect(periodDays(null, NOW)).toBeNull()
  })

  it('a Sunday is the first day of its own week', () => {
    expect(periodDays('this-week', new Date(2026, 10, 1, 9))).toEqual({ from: '2026-11-01', to: '2026-11-01' })
    expect(periodDays('last-week', new Date(2026, 10, 1, 9))).toEqual({ from: '2026-10-25', to: '2026-10-31' })
  })

  it('last month from 31 March is all of February', () => {
    expect(periodDays('last-month', new Date(2026, 2, 31, 9))).toEqual({ from: '2026-02-01', to: '2026-02-28' })
  })
})

const label = (en: string) => ({ en, ar: en })
const MODEL: AnalyticsModel = {
  areas: [
    { key: 'sales', available: true },
    { key: 'callouts', available: false },
  ],
  measures: [
    { key: 'orders', area: 'sales', shape: 'additive', unit: 'count', label: label('Orders'), description: label(''), dimensions: ['store', 'city'] },
    { key: 'till_value', area: 'sales', shape: 'additive', unit: 'SAR', label: label('Till'), description: label(''), dimensions: ['store', 'city'] },
    { key: 'take_rate', area: 'callouts', shape: 'rate', unit: 'share', label: label('Take'), description: label(''), dimensions: ['store'] },
  ],
  dimensions: [
    { key: 'store', kind: 'category', label: label('Store'), values: [] },
    { key: 'city', kind: 'category', label: label('City'), values: [] },
    { key: 'channel_group', kind: 'category', label: label('Channel'), values: [] },
  ],
}
const viewOf = (measures: string[]): AnalyticsViewDefinition => ({
  chart: { type: 'bar' },
  query: { measures, dimensions: ['store'], filters: [] },
})

describe('drill to detail: See deliveries', () => {
  it('a store point opens the Deliveries list filtered to that store and the period', () => {
    expect(deliveriesDrill({ dimension: 'store', member: 'P001' }, viewOf(['orders']), MODEL, 'last-7-days', NOW)).toBe(
      '/oms/deliveries?store=P001&from=2026-10-30&to=2026-11-05',
    )
  })

  it('a member is escaped into the query string', () => {
    expect(deliveriesDrill({ dimension: 'store', member: 'P 1&2' }, viewOf(['orders']), MODEL, null, NOW)).toBe('/oms/deliveries?store=P+1%262')
  })

  it('a till value offers no detail drill, even beside another measure', () => {
    expect(deliveriesDrill({ dimension: 'store', member: 'P001' }, viewOf(['till_value']), MODEL, 'today', NOW)).toBeNull()
    expect(deliveriesDrill({ dimension: 'store', member: 'P001' }, viewOf(['orders', 'till_value']), MODEL, 'today', NOW)).toBeNull()
  })

  it('a callout measure does not hand off to Deliveries', () => {
    expect(deliveriesDrill({ dimension: 'store', member: 'P001' }, viewOf(['take_rate']), MODEL, 'today', NOW)).toBeNull()
  })

  it('a city or channel point offers no Deliveries drill: the list has no filter entry for them', () => {
    expect(deliveriesDrill({ dimension: 'city', member: 'riyadh' }, viewOf(['orders']), MODEL, 'today', NOW)).toBeNull()
    expect(deliveriesDrill({ dimension: 'channel_group', member: 'app' }, viewOf(['orders']), MODEL, 'today', NOW)).toBeNull()
  })
})

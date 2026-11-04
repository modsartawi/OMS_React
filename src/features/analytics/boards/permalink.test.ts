import { describe, expect, it } from 'vitest'
import type { BoardFilters } from '@/core/models/analytics'
import { readBoardFilters, writeBoardFilters } from './permalink'

const DEFAULTS: BoardFilters = { period: { kind: 'relative', token: 'last-30-days' }, city: [], region: [], store: [], channel: [], country: [] }

const roundTrip = (f: BoardFilters) => readBoardFilters(writeBoardFilters(new URLSearchParams(), f), DEFAULTS)

describe('permalink', () => {
  it('board filters survive encode → decode', () => {
    const f: BoardFilters = {
      period: { kind: 'relative', token: 'last-week' },
      city: ['riyadh', 'jeddah'],
      region: ['central'],
      store: ['P001', 'P002'],
      channel: ['app'],
      country: ['SA'],
    }
    expect(roundTrip(f)).toEqual(f)
  })

  it('a relative period stays relative in the URL', () => {
    const qs = writeBoardFilters(new URLSearchParams(), { ...DEFAULTS, period: { kind: 'relative', token: 'year-to-date' } })
    expect(qs.toString()).toBe('period=year-to-date')
  })

  it('a fixed range survives as from..to', () => {
    const f: BoardFilters = { ...DEFAULTS, period: { kind: 'fixed', from: '2026-10-01', to: '2026-10-31' } }
    expect(writeBoardFilters(new URLSearchParams(), f).get('period')).toBe('2026-10-01..2026-10-31')
    expect(roundTrip(f)).toEqual(f)
  })

  it('reads the board defaults when the URL names nothing, or names a period it does not know', () => {
    expect(readBoardFilters(new URLSearchParams(), DEFAULTS)).toEqual(DEFAULTS)
    expect(readBoardFilters(new URLSearchParams('period=last-century&store=P009'), DEFAULTS)).toEqual({ ...DEFAULTS, store: ['P009'] })
  })

  it('a filter cleared from a board default stays cleared', () => {
    const saved: BoardFilters = { ...DEFAULTS, region: ['central'] }
    const qs = writeBoardFilters(new URLSearchParams(), { ...saved, region: [] }, saved)
    expect(readBoardFilters(qs, saved).region).toEqual([])
    expect(readBoardFilters(new URLSearchParams(), saved).region).toEqual(['central'])
  })

  it('leaves the params it does not own alone (tv, refresh, the cross-filter)', () => {
    const qs = writeBoardFilters(new URLSearchParams('tv=1&refresh=60&store=P007'), { ...DEFAULTS, region: ['west'] })
    expect(qs.get('tv')).toBe('1')
    expect(qs.get('refresh')).toBe('60')
    expect(qs.getAll('store')).toEqual([])
    expect(qs.getAll('region')).toEqual(['west'])
  })
})

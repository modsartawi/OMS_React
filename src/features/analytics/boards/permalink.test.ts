import { describe, expect, it } from 'vitest'
import type { BoardFilters } from '@/core/models/analytics'
import { boardPeriodOf, defaultsOf, readyMadeParams, type ParamValues } from './params'
import { readCrossFilter, readParamValues, writeCrossFilter, writeParamValues } from './permalink'

const DEFAULTS: BoardFilters = { period: { kind: 'relative', token: 'last-30-days' }, city: [], region: [], store: [], channel: [], country: [] }

// v1's filters through 821's six ready-made parameters, so these 771 cases keep their exact meaning.
const members = (values: ParamValues, name: string) => { const v = values[name]; return v?.kind === 'members' ? v.values : [] }
const filtersOf = (v: ParamValues): BoardFilters => ({
  period: boardPeriodOf(v.period)!, city: members(v, 'city'), region: members(v, 'region'), store: members(v, 'store'), channel: members(v, 'channel'), country: members(v, 'country'),
})
const readBoardFilters = (qs: URLSearchParams, defaults: BoardFilters) => filtersOf(readParamValues(qs, readyMadeParams(defaults)))
const writeBoardFilters = (qs: URLSearchParams, f: BoardFilters, defaults: BoardFilters = DEFAULTS) => writeParamValues(qs, readyMadeParams(defaults), defaultsOf(readyMadeParams(f)))

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

describe('permalink: the cross-filter (772)', () => {
  it('survives encode → decode, member values with a colon included', () => {
    const x = { source: 'p-stores', dimension: 'store', member: 'P:001' }
    const params = writeCrossFilter(new URLSearchParams('period=today&region=central'), x)
    expect(readCrossFilter(params)).toEqual(x)
    expect(params.get('region')).toBe('central')
  })

  it('cleared, it leaves no param behind, and the board filters keep theirs', () => {
    const set = writeCrossFilter(new URLSearchParams('region=central'), { source: 'p', dimension: 'store', member: 'P001' })
    const cleared = writeCrossFilter(set, null)
    expect(cleared.toString()).toBe('region=central')
    expect(readCrossFilter(cleared)).toBeNull()
  })

  it('a malformed param reads as none', () => {
    expect(readCrossFilter(new URLSearchParams('cross=store'))).toBeNull()
    expect(readCrossFilter(new URLSearchParams('cross=store:P001'))).toBeNull()
    expect(readCrossFilter(new URLSearchParams('crossFrom=p&cross=:P001'))).toBeNull()
  })

  it('writing the board filters leaves the cross-filter alone', () => {
    const x = { source: 'p-stores', dimension: 'store', member: 'P001' }
    const params = writeBoardFilters(writeCrossFilter(new URLSearchParams(), x), {
      period: { kind: 'relative', token: 'today' }, city: [], region: ['west'], store: [], channel: [], country: [],
    })
    expect(readCrossFilter(params)).toEqual(x)
  })
})

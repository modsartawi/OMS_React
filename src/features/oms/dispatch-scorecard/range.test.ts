import { describe, expect, it } from 'vitest'
import { ApiError } from '@/core/api'
import {
  DEFAULT_FILTERS,
  filtersFromParams,
  filtersToParams,
  refusalKey,
  resolveRange,
  wireQuery,
} from './range'

// Thursday 23 October 2026, mid-morning local.
const NOW = new Date(2026, 9, 23, 10, 15)

describe('resolveRange', () => {
  it('🚩 by default: the last 30 days ending today, both ends inclusive (ruling 2948 D8)', () => {
    expect(resolveRange(DEFAULT_FILTERS, NOW)).toEqual({ ok: true, from: '2026-09-24', to: '2026-10-23' })
  })

  it('a picked range is asked as picked', () => {
    expect(resolveRange({ ...DEFAULT_FILTERS, from: '2026-08-01', to: '2026-08-31' }, NOW)).toEqual({
      ok: true,
      from: '2026-08-01',
      to: '2026-08-31',
    })
  })

  it('92 days inclusive is the longest range that is asked', () => {
    expect(resolveRange({ ...DEFAULT_FILTERS, from: '2026-07-24', to: '2026-10-23' }, NOW)).toEqual({
      ok: true,
      from: '2026-07-24',
      to: '2026-10-23',
    })
  })

  it('🚩 93 days is blocked before the call', () => {
    expect(resolveRange({ ...DEFAULT_FILTERS, from: '2026-07-23', to: '2026-10-23' }, NOW)).toEqual({ ok: false, problem: 'tooLong' })
  })

  it('a reversed range is blocked before the call', () => {
    expect(resolveRange({ ...DEFAULT_FILTERS, from: '2026-10-20', to: '2026-10-10' }, NOW)).toEqual({ ok: false, problem: 'reversed' })
  })

  it('one end alone, or a day that does not exist, is incomplete', () => {
    expect(resolveRange({ ...DEFAULT_FILTERS, from: '2026-10-01', to: '' }, NOW)).toEqual({ ok: false, problem: 'incomplete' })
    expect(resolveRange({ ...DEFAULT_FILTERS, from: '2026-02-30', to: '2026-03-02' }, NOW)).toEqual({ ok: false, problem: 'incomplete' })
  })
})

describe('the URL', () => {
  it('the default writes nothing, and nothing reads as the default', () => {
    expect(filtersToParams(DEFAULT_FILTERS).toString()).toBe('')
    expect(filtersFromParams(new URLSearchParams())).toEqual(DEFAULT_FILTERS)
  })

  it('keeps the range, the filters and the tab', () => {
    const qs = 'tab=staff&from=2026-09-01&to=2026-09-30&type=QC&channel=HYBR&city=Riyadh&region=Central&store=P001'
    const filters = filtersFromParams(new URLSearchParams(qs))
    expect(filters).toEqual({
      tab: 'staff',
      from: '2026-09-01',
      to: '2026-09-30',
      type: 'QC',
      channel: 'HYBR',
      city: 'Riyadh',
      region: 'Central',
      store: 'P001',
    })
    expect(filtersToParams(filters).toString()).toBe(qs)
  })

  it('an unknown tab reads as Stores', () => {
    expect(filtersFromParams(new URLSearchParams('tab=nope')).tab).toBe('stores')
  })
})

describe('wireQuery', () => {
  it('sends the resolved range and the filters, with blanks for the core to drop', () => {
    expect(wireQuery({ ...DEFAULT_FILTERS, channel: 'CMRC' }, { from: '2026-09-24', to: '2026-10-23' })).toEqual({
      from: '2026-09-24',
      to: '2026-10-23',
      type: '',
      channel: 'CMRC',
      city: '',
      region: '',
      store: '',
    })
  })
})

const refusal = (code: string) =>
  new ApiError('business', 'server words', 400, [{ errorCode: code, internalErrorCode: '', errorMessage: 'server words' }])

describe('refusalKey', () => {
  it('🚩 each CALLOUT-30x maps to its own message', () => {
    expect(refusalKey(refusal('CALLOUT-301'))).toBe('refusal.rangeTooLong')
    expect(refusalKey(refusal('CALLOUT-302'))).toBe('refusal.rangeReversed')
    expect(refusalKey(refusal('CALLOUT-303'))).toBe('refusal.unknownFigure')
    expect(refusalKey(refusal('CALLOUT-304'))).toBe('refusal.storeRequired')
  })

  it('any other failure has no key of its own (the server words it)', () => {
    expect(refusalKey(refusal('CALLOUT-101'))).toBeNull()
    expect(refusalKey(new Error('boom'))).toBeNull()
  })
})

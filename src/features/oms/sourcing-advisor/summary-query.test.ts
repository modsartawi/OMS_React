import { describe, expect, it } from 'vitest'
import { DEFAULT_SUMMARY_FILTERS, resolveSummaryRange, summaryFiltersFromParams, summaryFiltersToParams, summaryWireQuery } from './summary-query'

// Tuesday 3 November 2026, mid-afternoon local.
const NOW = new Date(2026, 10, 3, 15, 40)

describe('sourcingSummaryQuery_capsAndValidatesTheRange', () => {
  it('🚩 by default: the last 30 days, ending yesterday (the nightly job scores the day before, D19)', () => {
    expect(resolveSummaryRange(DEFAULT_SUMMARY_FILTERS, NOW)).toEqual({ ok: true, from: '2026-10-04', to: '2026-11-02' })
  })

  it('a picked range is asked as picked, up to 92 days inclusive', () => {
    expect(resolveSummaryRange({ ...DEFAULT_SUMMARY_FILTERS, from: '2026-10-01', to: '2026-10-31' }, NOW)).toEqual({ ok: true, from: '2026-10-01', to: '2026-10-31' })
    expect(resolveSummaryRange({ ...DEFAULT_SUMMARY_FILTERS, from: '2026-08-03', to: '2026-11-02' }, NOW)).toEqual({ ok: true, from: '2026-08-03', to: '2026-11-02' })
  })

  it('🚩 93 days is refused before the call', () => {
    expect(resolveSummaryRange({ ...DEFAULT_SUMMARY_FILTERS, from: '2026-08-02', to: '2026-11-02' }, NOW)).toEqual({ ok: false, problem: 'tooLong' })
  })

  it('🚩 a reversed range is refused before the call', () => {
    expect(resolveSummaryRange({ ...DEFAULT_SUMMARY_FILTERS, from: '2026-10-20', to: '2026-10-10' }, NOW)).toEqual({ ok: false, problem: 'reversed' })
  })

  it('one end alone, or a day that does not exist, is incomplete', () => {
    expect(resolveSummaryRange({ ...DEFAULT_SUMMARY_FILTERS, from: '2026-10-01' }, NOW)).toEqual({ ok: false, problem: 'incomplete' })
    expect(resolveSummaryRange({ ...DEFAULT_SUMMARY_FILTERS, from: '2026-02-30', to: '2026-03-02' }, NOW)).toEqual({ ok: false, problem: 'incomplete' })
  })

  it('the URL keeps the range and the three filters; the default writes nothing', () => {
    expect(summaryFiltersToParams(DEFAULT_SUMMARY_FILTERS).toString()).toBe('')
    expect(summaryFiltersFromParams(new URLSearchParams())).toEqual(DEFAULT_SUMMARY_FILTERS)
    const qs = 'from=2026-10-01&to=2026-10-31&city=Al+Khobar&channel=HYBR&deliveryType=QC'
    const f = summaryFiltersFromParams(new URLSearchParams(qs))
    expect(f).toEqual({ from: '2026-10-01', to: '2026-10-31', city: 'Al Khobar', channel: 'HYBR', deliveryType: 'QC' })
    expect(summaryFiltersToParams(f).toString()).toBe(qs)
  })

  it('the wire sends the resolved range and the filters, blanks left for the core to drop', () => {
    expect(summaryWireQuery({ ...DEFAULT_SUMMARY_FILTERS, channel: 'CMRC' }, { from: '2026-10-04', to: '2026-11-02' })).toEqual({
      from: '2026-10-04',
      to: '2026-11-02',
      city: '',
      channel: 'CMRC',
      deliveryType: '',
    })
  })
})

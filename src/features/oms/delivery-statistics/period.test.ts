import { describe, expect, it } from 'vitest'
import {
  DEFAULT_PERIOD,
  periodFromParams,
  periodToParams,
  resolvePeriod,
  withPick,
  withTab,
  type PeriodQuery,
} from './period'

// A Tuesday afternoon, local time: today is 2026-10-13, yesterday 2026-10-12.
const NOW = new Date(2026, 9, 13, 15, 40)

const query = (over: Partial<PeriodQuery> = {}): PeriodQuery => ({ ...DEFAULT_PERIOD, ...over })
const custom = (from: string, to: string) => query({ tab: 'range', pick: 'custom', from, to })
const from = (s: string) => periodFromParams(new URLSearchParams(s))
const to = (q: PeriodQuery) => periodToParams(q).toString()

describe('resolvePeriod', () => {
  it('Today is today alone, by the hour', () => {
    expect(resolvePeriod(query(), NOW)).toEqual({ ok: true, from: '2026-10-13', to: '2026-10-13', granularity: 'hour' })
  })

  it('Yesterday is yesterday alone, by the hour', () => {
    expect(resolvePeriod(query({ tab: 'yesterday' }), NOW)).toEqual({
      ok: true,
      from: '2026-10-12',
      to: '2026-10-12',
      granularity: 'hour',
    })
  })

  it('the 7, 14 and 31 day quick picks end yesterday, by the day', () => {
    expect(resolvePeriod(query({ tab: 'range', pick: 7 }), NOW)).toEqual({ ok: true, from: '2026-10-06', to: '2026-10-12', granularity: 'day' })
    expect(resolvePeriod(query({ tab: 'range', pick: 14 }), NOW)).toEqual({ ok: true, from: '2026-09-29', to: '2026-10-12', granularity: 'day' })
    expect(resolvePeriod(query({ tab: 'range', pick: 31 }), NOW)).toEqual({ ok: true, from: '2026-09-12', to: '2026-10-12', granularity: 'day' })
  })

  it('a quick pick crosses a month and a year boundary on local dates', () => {
    expect(resolvePeriod(query({ tab: 'range', pick: 7 }), new Date(2027, 0, 3, 0, 5))).toEqual({
      ok: true,
      from: '2026-12-27',
      to: '2027-01-02',
      granularity: 'day',
    })
  })

  it('a custom range may end today, by the day', () => {
    expect(resolvePeriod(custom('2026-10-01', '2026-10-13'), NOW)).toEqual({ ok: true, from: '2026-10-01', to: '2026-10-13', granularity: 'day' })
  })

  it('a custom range of one day is still a range, by the day', () => {
    expect(resolvePeriod(custom('2026-10-05', '2026-10-05'), NOW)).toEqual({ ok: true, from: '2026-10-05', to: '2026-10-05', granularity: 'day' })
  })

  it('31 days inclusive is allowed; 32 is refused', () => {
    expect(resolvePeriod(custom('2026-09-13', '2026-10-13'), NOW)).toMatchObject({ ok: true })
    expect(resolvePeriod(custom('2026-09-12', '2026-10-13'), NOW)).toEqual({ ok: false, problem: 'tooLong' })
  })

  it('a reversed range is refused', () => {
    expect(resolvePeriod(custom('2026-10-10', '2026-10-09'), NOW)).toEqual({ ok: false, problem: 'reversed' })
  })

  it('a range ending after today is refused', () => {
    expect(resolvePeriod(custom('2026-10-10', '2026-10-14'), NOW)).toEqual({ ok: false, problem: 'future' })
  })

  it('a custom range missing an end, or with a malformed one, is incomplete', () => {
    expect(resolvePeriod(custom('', '2026-10-13'), NOW)).toEqual({ ok: false, problem: 'incomplete' })
    expect(resolvePeriod(custom('2026-10-01', ''), NOW)).toEqual({ ok: false, problem: 'incomplete' })
    expect(resolvePeriod(custom('2026-13-01', '2026-10-13'), NOW)).toEqual({ ok: false, problem: 'incomplete' })
  })
})

describe('periodFromParams / periodToParams', () => {
  it('reads an empty URL as Today, and writes Today as an empty URL', () => {
    expect(from('')).toEqual(DEFAULT_PERIOD)
    expect(to(DEFAULT_PERIOD)).toBe('')
  })

  it('round-trips Yesterday, a quick pick and a custom range', () => {
    for (const url of ['period=yesterday', 'period=range&pick=14', 'period=range&pick=custom&from=2026-10-01&to=2026-10-13'])
      expect(to(from(url))).toBe(url)
  })

  it('reads a Range with no pick, or an unknown one, as the 7-day pick', () => {
    expect(from('period=range')).toEqual(query({ tab: 'range', pick: 7 }))
    expect(from('period=range&pick=9')).toEqual(query({ tab: 'range', pick: 7 }))
  })

  it('reads an unknown period as Today, and drops range params off a fixed day', () => {
    expect(from('period=week')).toEqual(DEFAULT_PERIOD)
    expect(to(from('period=yesterday&pick=14&from=2026-10-01'))).toBe('period=yesterday')
  })

  it('keeps a custom range\'s dates as typed, so a refused range stays on screen to be fixed', () => {
    expect(from('period=range&pick=custom&from=2026-10-10&to=2026-10-01')).toEqual(custom('2026-10-10', '2026-10-01'))
  })
})

describe('withTab / withPick', () => {
  it('a tab change keeps the range\'s pick and dates for when the reader comes back', () => {
    const range = custom('2026-10-01', '2026-10-05')
    expect(withTab(withTab(range, 'today'), 'range')).toEqual(range)
  })

  it('choosing Custom seeds its dates from the range on screen when it has none', () => {
    expect(withPick(query({ tab: 'range', pick: 14 }), 'custom', NOW)).toEqual(custom('2026-09-29', '2026-10-12'))
    expect(withPick(custom('2026-10-01', '2026-10-02'), 'custom', NOW)).toEqual(custom('2026-10-01', '2026-10-02'))
  })

  it('choosing a quick pick keeps the custom dates beside it', () => {
    expect(withPick(custom('2026-10-01', '2026-10-02'), 31, NOW)).toEqual(query({ tab: 'range', pick: 31, from: '2026-10-01', to: '2026-10-02' }))
  })
})

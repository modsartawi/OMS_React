import { describe, expect, it } from 'vitest'
import { resolvePeriod } from './period'
import {
  DEFAULT_STATISTICS_QUERY,
  buildStatisticsQuery,
  statisticsFromParams,
  statisticsToParams,
  withLeaveOutType,
  type StatisticsQuery,
} from './query'

// A Tuesday afternoon, local time: today is 2026-10-13.
const NOW = new Date(2026, 9, 13, 15, 40)
const TODAY = { ok: true, from: '2026-10-13', to: '2026-10-13', granularity: 'hour' } as const

const query = (over: Partial<StatisticsQuery> = {}): StatisticsQuery => ({ ...DEFAULT_STATISTICS_QUERY, ...over })
const from = (s: string) => statisticsFromParams(new URLSearchParams(s))
const to = (q: StatisticsQuery) => statisticsToParams(q).toString()

describe('buildStatisticsQuery', () => {
  it('names the door\'s params exactly, and no store omits StoreCode (all stores)', () => {
    const built = buildStatisticsQuery(TODAY, query())
    expect(built).toEqual({ From: '2026-10-13', To: '2026-10-13', Granularity: 'hour', LeaveOutChurned: true })
    expect(built).not.toHaveProperty('StoreCode')
  })

  it('a chosen store sends StoreCode', () => {
    expect(buildStatisticsQuery(TODAY, query({ store: 'P019' }))).toMatchObject({ StoreCode: 'P019' })
  })

  it('churned refills are left out by default, and unticking sends false', () => {
    expect(DEFAULT_STATISTICS_QUERY.leaveOutChurned).toBe(true)
    expect(buildStatisticsQuery(TODAY, query()).LeaveOutChurned).toBe(true)
    expect(buildStatisticsQuery(TODAY, query({ leaveOutChurned: false })).LeaveOutChurned).toBe(false)
  })

  it('left-out order types are joined with commas', () => {
    expect(buildStatisticsQuery(TODAY, query({ leaveOutTypes: ['ZC', 'ZO'] })).LeaveOutTypes).toBe('ZC,ZO')
  })

  it('no types omits LeaveOutTypes', () => {
    expect(buildStatisticsQuery(TODAY, query({ leaveOutTypes: [] }))).not.toHaveProperty('LeaveOutTypes')
  })

  it('takes the period as it resolved: a range by the day', () => {
    const period = resolvePeriod(query({ tab: 'range', pick: 7 }), NOW)
    if (!period.ok) throw new Error('the 7-day pick resolves')
    expect(buildStatisticsQuery(period, query({ tab: 'range', pick: 7, store: 'P001' }))).toEqual({
      StoreCode: 'P001',
      From: '2026-10-06',
      To: '2026-10-12',
      Granularity: 'day',
      LeaveOutChurned: true,
    })
  })
})

describe('statisticsFromParams / statisticsToParams', () => {
  it('reads a bare URL as Today, all stores, churned left out, no types — and writes it bare', () => {
    expect(from('')).toEqual(DEFAULT_STATISTICS_QUERY)
    expect(to(DEFAULT_STATISTICS_QUERY)).toBe('')
  })

  it('round-trips the store and both leave-outs beside each period', () => {
    for (const url of [
      'store=P019',
      'leaveOutChurned=false',
      'leaveOutTypes=ZC%2CZO',
      'period=yesterday&store=P019&leaveOutChurned=false&leaveOutTypes=ZC%2CZO',
      'period=range&pick=14&store=P001&leaveOutTypes=ZO',
      'period=range&pick=custom&from=2026-10-01&to=2026-10-13&store=P001&leaveOutChurned=false',
    ])
      expect(to(from(url))).toBe(url)
  })

  it('a URL round-trips into the same door query', () => {
    const url = 'period=yesterday&store=P019&leaveOutChurned=false&leaveOutTypes=ZC%2CZO'
    const q = from(url)
    expect(buildStatisticsQuery({ ok: true, from: '2026-10-12', to: '2026-10-12', granularity: 'hour' }, q)).toEqual({
      StoreCode: 'P019',
      From: '2026-10-12',
      To: '2026-10-12',
      Granularity: 'hour',
      LeaveOutChurned: false,
      LeaveOutTypes: 'ZC,ZO',
    })
  })

  it('the store and leave-outs are shared by every tab: a tab change keeps them', () => {
    const q = from('store=P019&leaveOutChurned=false&leaveOutTypes=ZO')
    expect(to({ ...q, tab: 'yesterday' })).toBe('period=yesterday&store=P019&leaveOutChurned=false&leaveOutTypes=ZO')
  })

  it('reads anything but "false" as churned left out (the default)', () => {
    expect(from('leaveOutChurned=true').leaveOutChurned).toBe(true)
    expect(from('leaveOutChurned=no').leaveOutChurned).toBe(true)
    expect(from('leaveOutChurned=false').leaveOutChurned).toBe(false)
  })

  it('trims the store, and a blank one is all stores', () => {
    expect(from('store=%20P019%20').store).toBe('P019')
    expect(from('store=%20').store).toBe('')
    expect(to(from('store='))).toBe('')
  })

  it('reads the types trimmed, de-duplicated and in code order, so one choice has one URL', () => {
    expect(from('leaveOutTypes=ZO,%20ZC,,ZO').leaveOutTypes).toEqual(['ZC', 'ZO'])
    expect(to(from('leaveOutTypes=ZO,ZC'))).toBe('leaveOutTypes=ZC%2CZO')
    expect(from('leaveOutTypes=,').leaveOutTypes).toEqual([])
  })
})

describe("the table's track switch", () => {
  it('the track switch round-trips through the URL', () => {
    expect(from('').track).toBe('all')
    expect(from('track=delivery').track).toBe('delivery')
    expect(from('track=pickUp').track).toBe('pickUp')
    for (const url of ['track=delivery', 'track=pickUp', 'period=yesterday&store=P019&leaveOutTypes=ZO&track=pickUp']) expect(to(from(url))).toBe(url)
  })

  it('an unknown or blank track reads as All, and All writes nothing', () => {
    for (const url of ['track=all', 'track=Delivery', 'track=pickup', 'track=', 'track=unspecified']) {
      expect(from(url).track).toBe('all')
      expect(to(from(url))).toBe('')
    }
  })

  it('the track is not asked of the door: switching it never makes a new call', () => {
    expect(buildStatisticsQuery(TODAY, query({ track: 'pickUp' }))).toEqual(buildStatisticsQuery(TODAY, query()))
  })
})

describe('withLeaveOutType', () => {
  it('ticks a type in, in code order, and ticks it out again', () => {
    const one = withLeaveOutType(query({ leaveOutTypes: ['ZO'] }), 'ZC', true)
    expect(one.leaveOutTypes).toEqual(['ZC', 'ZO'])
    expect(withLeaveOutType(one, 'ZO', false).leaveOutTypes).toEqual(['ZC'])
  })

  it('ticking a type already left out changes nothing', () => {
    expect(withLeaveOutType(query({ leaveOutTypes: ['ZC'] }), 'ZC', true).leaveOutTypes).toEqual(['ZC'])
  })
})

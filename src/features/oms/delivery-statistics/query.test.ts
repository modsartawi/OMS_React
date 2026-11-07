import { describe, expect, it } from 'vitest'
import { resolvePeriod } from './period'
import {
  DEFAULT_STATISTICS_QUERY,
  buildStatisticsQuery,
  keepsPreviousAnswer,
  statisticsKey,
  statisticsFromParams,
  statisticsToParams,
  withCourier,
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

describe('the courier scope', () => {
  it('courier round-trips through the URL and is sent as Courier', () => {
    // Absent = all couriers: no param in the URL, no Courier on the wire.
    expect(from('').courier).toBe('')
    expect(buildStatisticsQuery(TODAY, query())).not.toHaveProperty('Courier')
    // FREY → courier=FREY → Courier: 'FREY'
    expect(from('courier=FREY').courier).toBe('FREY')
    expect(to(query({ courier: 'FREY', track: 'delivery' }))).toBe('courier=FREY')
    expect(buildStatisticsQuery(TODAY, from('courier=FREY'))).toEqual({
      From: '2026-10-13',
      To: '2026-10-13',
      Granularity: 'hour',
      LeaveOutChurned: true,
      Courier: 'FREY',
    })
  })

  it('combines with the period, the store and the leave-outs', () => {
    const url = 'period=yesterday&store=P239&leaveOutChurned=false&leaveOutTypes=ZO&courier=FREY'
    expect(to(from(url))).toBe(url)
    expect(buildStatisticsQuery({ ok: true, from: '2026-10-12', to: '2026-10-12', granularity: 'hour' }, from(url))).toEqual({
      StoreCode: 'P239',
      From: '2026-10-12',
      To: '2026-10-12',
      Granularity: 'hour',
      LeaveOutChurned: false,
      LeaveOutTypes: 'ZO',
      Courier: 'FREY',
    })
  })

  it('an unknown code is sent as written (the server refuses it); a blank one is all couriers', () => {
    expect(buildStatisticsQuery(TODAY, from('courier=NOPE')).Courier).toBe('NOPE')
    expect(buildStatisticsQuery(TODAY, from('courier=DAWA')).Courier).toBe('DAWA')
    expect(from('courier=%20FREY%20').courier).toBe('FREY')
    expect(to(from('courier=%20'))).toBe('')
  })

  it('a URL naming track=pickUp reads as Delivery under a courier, and is kept with all couriers', () => {
    expect(from('courier=FREY&track=pickUp').track).toBe('delivery')
    // 816: Delivery is the courier's default view, so it is absent from the URL.
    expect(to(from('courier=FREY&track=pickUp'))).toBe('courier=FREY')
    expect(from('track=pickUp').track).toBe('pickUp')
  })

  it("816: a courier's link without a track opens on Delivery; its All view is written, and round-trips", () => {
    expect(from('courier=FREY').track).toBe('delivery')
    expect(to(query({ courier: 'FREY', track: 'delivery' }))).toBe('courier=FREY')
    expect(from('courier=FREY&track=all').track).toBe('all')
    expect(to(from('courier=FREY&track=all'))).toBe('courier=FREY&track=all')
    // With all couriers, today's: All is absent, Delivery written.
    expect(from('').track).toBe('all')
    expect(to(query({ track: 'delivery' }))).toBe('track=delivery')
  })

  it("816: a new courier scope re-opens the table on that scope's default view; the same scope keeps the view", () => {
    expect(withCourier(query({ track: 'pickUp' }), 'OTOX')).toMatchObject({ courier: 'OTOX', track: 'delivery' })
    expect(withCourier(query({ track: 'all' }), 'OTOX')).toMatchObject({ courier: 'OTOX', track: 'delivery' })
    expect(withCourier(query({ courier: 'FREY', track: 'all' }), 'OTOX')).toMatchObject({ courier: 'OTOX', track: 'delivery' })
    expect(withCourier(query({ courier: 'OTOX', track: 'delivery' }), '')).toMatchObject({ courier: '', track: 'all' })
    expect(withCourier(query({ courier: 'OTOX', track: 'all' }), 'OTOX')).toMatchObject({ courier: 'OTOX', track: 'all' })
  })
})

describe('keepsPreviousAnswer', () => {
  const today = (From: string, over = {}) => statisticsKey('today', { From, To: From, Granularity: 'hour', LeaveOutChurned: true, ...over })

  it('Today keeps its previous answer when its day rolls over, so the chart dims rather than blanks', () => {
    expect(keepsPreviousAnswer(today('2026-10-12'), today('2026-10-13'))).toBe(true)
  })

  it('a new tab or a new scope never shows the previous answer', () => {
    const yesterday = statisticsKey('yesterday', { From: '2026-10-12', To: '2026-10-12', Granularity: 'hour', LeaveOutChurned: true })
    expect(keepsPreviousAnswer(yesterday, today('2026-10-13'))).toBe(false)
    expect(keepsPreviousAnswer(today('2026-10-13'), yesterday)).toBe(false)
    expect(keepsPreviousAnswer(today('2026-10-13'), today('2026-10-13', { StoreCode: 'P019' }))).toBe(false)
    expect(keepsPreviousAnswer(today('2026-10-13'), today('2026-10-13', { LeaveOutChurned: false }))).toBe(false)
    expect(keepsPreviousAnswer(today('2026-10-13'), today('2026-10-13', { LeaveOutTypes: 'ZO' }))).toBe(false)
    expect(keepsPreviousAnswer(undefined, today('2026-10-13'))).toBe(false)
  })

  it('a new courier is a new scope: the previous answer is never shown under it (813)', () => {
    expect(keepsPreviousAnswer(today('2026-10-12'), today('2026-10-13', { Courier: 'FREY' }))).toBe(false)
    expect(keepsPreviousAnswer(today('2026-10-13', { Courier: 'FREY' }), today('2026-10-13', { Courier: 'OTOX' }))).toBe(false)
    expect(keepsPreviousAnswer(today('2026-10-12', { Courier: 'FREY' }), today('2026-10-13', { Courier: 'FREY' }))).toBe(true)
  })
})

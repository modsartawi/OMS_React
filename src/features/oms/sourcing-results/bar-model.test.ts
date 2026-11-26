import { describe, expect, it } from 'vitest'
import type { BarLimitReading, BarReply } from '@/core/models/sourcing-results'
import stub from './stub-bar.json'
import { barPeriodEnd, barReading } from './bar-model'

// The drive's stub: 28 days of the app and the site — three limits met, four not met, two that cannot be read yet.
const reply = stub as unknown as BarReply
const withLimit = (limit: BarLimitReading): BarReply => ({ ...reply, limits: reply.limits.map((l) => (l.limit === limit.limit ? limit : l)) })
const limitOf = (r: BarReply, code: string) => barReading(r).limits.find((l) => l.limit === code)!

describe('barReading — each limit with its state and why', () => {
  it('lists the nine limits a to i in the spec order, whatever order they were sent in', () => {
    expect(barReading(reply).limits.map((l) => [l.letter, l.limit, l.state])).toEqual([
      ['a', 'STOP_FINDINGS', 'MET'],
      ['b', 'ORDERS_RUN', 'MET'],
      ['c', 'DAWAA_NOW_PROMISE', 'NOT_MET'],
      ['d', 'DISTANCE_BANDS', 'NOT_MET'],
      ['e', 'SHELF_CHANCE', 'NOT_MET'],
      ['f', 'SPLIT_CHECK', 'CANNOT_READ'],
      ['g', 'LARGEST_DIFFERENCES', 'NOT_MET'],
      ['h', 'OUTSIDE_RULES', 'MET'],
      ['i', 'RATES', 'CANNOT_READ'],
    ])
  })

  it('counts the limits met, not met and that cannot be read yet', () => {
    expect(barReading(reply).tally).toEqual({ MET: 3, NOT_MET: 4, CANNOT_READ: 2 })
  })

  it('gives a met limit its figures and no why', () => {
    const b = limitOf(reply, 'ORDERS_RUN')
    expect(b.figures.map((f) => [f.part, f.value, f.unit])).toEqual([
      ['RUN_SHARE', 96.4, 'PERCENT'],
      ['ERROR_OR_FALLBACK', 0.6, 'PER_THOUSAND'],
    ])
    expect(b.why).toEqual([])
  })

  it('says why a limit is not met: the figures that do not keep it', () => {
    expect(limitOf(reply, 'DAWAA_NOW_PROMISE').why).toEqual([{ kind: 'figure', part: 'SECOND_HALF', value: 84.1, unit: 'PERCENT', of: null }])
    expect(limitOf(reply, 'DISTANCE_BANDS').why).toEqual([{ kind: 'figure', part: 'BAND_6_PLUS', value: 78.9, unit: 'PERCENT', of: 700 }])
  })

  it('"cannot be read yet" names the cause', () => {
    expect(limitOf(reply, 'SPLIT_CHECK').why).toEqual([{ kind: 'cause', cause: 'SPLIT_CHECK_NOT_DONE' }])
    expect(limitOf(reply, 'RATES').why).toEqual([{ kind: 'cause', cause: 'WAITS_FOR_FINANCE_RATES' }])
  })

  it('names the period\'s causes on a limit that cannot be read for them, each once, in the spec order', () => {
    const r: BarReply = {
      ...withLimit({ limit: 'DAWAA_NOW_PROMISE', state: 'CANNOT_READ', causes: ['RAMADAN_OR_EID'], figures: [] }),
      causes: ['RAMADAN_OR_EID', 'DAY_BEFORE_FLAGS_OFF'],
    }
    expect(limitOf(r, 'DAWAA_NOW_PROMISE').why).toEqual([
      { kind: 'cause', cause: 'DAY_BEFORE_FLAGS_OFF' },
      { kind: 'cause', cause: 'RAMADAN_OR_EID' },
    ])
    expect(barReading(r).periodCauses).toEqual(['DAY_BEFORE_FLAGS_OFF', 'RAMADAN_OR_EID'])
  })

  it('says so when the server gives no cause, rather than showing an empty why', () => {
    const r = withLimit({ limit: 'SPLIT_CHECK', state: 'CANNOT_READ', causes: [], figures: [] })
    expect(limitOf(r, 'SPLIT_CHECK').why).toEqual([{ kind: 'unsaid' }])
    const n = withLimit({ limit: 'SHELF_CHANCE', state: 'NOT_MET', causes: [], figures: [{ part: 'AGAINST_EVIDENCE_NO_RULING', value: 2, unit: 'COUNT' }] })
    expect(limitOf(n, 'SHELF_CHANCE').why).toEqual([{ kind: 'unsaid' }])
  })

  it('never shows a limit the reply left out as met: it cannot be read yet, and says it was not sent', () => {
    const r = { ...reply, limits: reply.limits.filter((l) => l.limit !== 'STOP_FINDINGS') }
    expect(limitOf(r, 'STOP_FINDINGS')).toMatchObject({ state: 'CANNOT_READ', figures: [], why: [{ kind: 'unsent' }] })
  })
})

describe('barReading — what is read and never a limit, the largest differences, the rulings', () => {
  it('keeps the readings apart from the limits, in the spec order', () => {
    expect(barReading(reply).readings.map((r) => r.reading)).toEqual(['SAME_PLAN', 'ESTIMATES', 'FLEET_RATIO', 'LATER_SLOTS'])
  })

  it('groups the largest differences by view and way, the largest first, with how many are marked', () => {
    const groups = barReading(reply).largest
    expect(groups.map((g) => [g.view, g.direction, g.rows.map((r) => r.orderNumber), g.marked, g.wrongRule])).toEqual([
      ['WHOLE_PLAN', 'EARLIER', ['4500718102', '4500718377', '4500718405'], 2, 1],
      ['WHOLE_PLAN', 'LATER', ['4500718550', '4500718612'], 1, 0],
      ['STORES_ONLY', 'EARLIER', ['4500718720', '4500718788'], 1, 0],
      ['STORES_ONLY', 'LATER', ['4500718840', '4500718931'], 0, 0],
    ])
  })

  it('splits the rulings into the ones still to write and the ones written', () => {
    const { due, written } = barReading(reply).rulings
    expect(due.map((r) => r.key)).toEqual(['BOOK_AT_ZERO:DAWAA_NOW', 'HELD_BY_ORDERS:SLOT'])
    expect(written.map((r) => r.key)).toEqual(['NEVER_HELD'])
  })
})

describe('barReading — "accept this reading"', () => {
  it('is not offered while a limit cannot be read yet', () => {
    expect(barReading(reply).canAccept).toBe(false)
  })

  it('is offered once every limit reads met or not met: the owner judges, the page does not', () => {
    const r = {
      ...reply,
      limits: reply.limits.map((l) => (l.state === 'CANNOT_READ' ? { ...l, state: 'NOT_MET' as const, causes: [] } : l)),
    }
    expect(barReading(r).canAccept).toBe(true)
  })

  it('is not offered while the period itself holds a cause, nor once this reading is accepted', () => {
    const readable = { ...reply, limits: reply.limits.map((l) => ({ ...l, state: 'MET' as const, causes: [] })) }
    expect(barReading({ ...readable, causes: ['SHARE_UNDER_100'] }).canAccept).toBe(false)
    const accepted = { by: 'owner', at: '2026-11-26 17:00:00', period: { from: '2026-10-29', to: '2026-11-25' }, limits: readable.limits }
    expect(barReading({ ...readable, accepted }).canAccept).toBe(false)
    expect(barReading({ ...readable, accepted }).accepted?.by).toBe('owner')
  })
})

describe('barPeriodEnd — the 28 whole local days', () => {
  it('ends 27 days after its first day, across a month', () => {
    expect(barPeriodEnd('2026-10-29')).toBe('2026-11-25')
    expect(barPeriodEnd('2026-02-01')).toBe('2026-02-28')
  })

  it('has no end without a first day', () => {
    expect(barPeriodEnd('')).toBe('')
  })
})

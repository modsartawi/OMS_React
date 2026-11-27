import { describe, expect, it } from 'vitest'
import type { BarLimitReading, BarReading, BarReply } from '@/core/models/sourcing-results'
import stub from './stub-bar.json'
import { barPeriodEnd, barReading } from './bar-model'

// `GET SourcingAdvisor/Results/Phase2Bar` (BO 4396): 28 days of the app and the site, step 1 (the stores only) —
// three limits met, four not met, two that cannot be read yet.
const reply = stub as unknown as BarReply
const withReading = (over: Partial<BarReading>): BarReply => ({ ...reply, reading: { ...reply.reading, ...over } })
const withLimit = (l: BarLimitReading): BarReply => withReading({ limits: reply.reading.limits.map((x) => (x.code === l.code ? l : x)) })
const limitOf = (r: BarReply, code: string) => barReading(r).limits.find((l) => l.limit === code)!

describe('barReading — each limit with its state and why', () => {
  it('lists the nine limits a to i in the server order, whatever order they were sent in', () => {
    const shuffled = withReading({ limits: [...reply.reading.limits].reverse() })
    expect(barReading(shuffled).limits.map((l) => [l.letter, l.limit, l.state])).toEqual([
      ['a', 'STOP_FINDINGS', 'MET'],
      ['b', 'ORDERS_RUN', 'MET'],
      ['c', 'DAWAA_NOW_PROMISE', 'NOT_MET'],
      ['d', 'DISTANCE_BANDS', 'NOT_MET'],
      ['e', 'SHELF_CHANCE', 'NOT_MET'],
      ['f', 'SPLIT_CHECK', 'CANNOT_READ_YET'],
      ['g', 'LARGEST_DIFFERENCES', 'NOT_MET'],
      ['h', 'OUTSIDE_RULES', 'MET'],
      ['i', 'RATES', 'CANNOT_READ_YET'],
    ])
  })

  it('counts the limits met, not met and that cannot be read yet, and reads the bar\'s own state as sent', () => {
    const view = barReading(reply)
    expect(view.tally).toEqual({ MET: 3, NOT_MET: 4, CANNOT_READ_YET: 2 })
    expect(view.state).toBe('NOT_MET')
  })

  it('gives a met limit its figures in the order sent and no why', () => {
    const b = limitOf(reply, 'ORDERS_RUN')
    expect(b.figures.map((f) => [f.name, f.value])).toEqual([
      ['landedWithDelivery', 43512],
      ['run', 41950],
      ['runPercent', 96.4],
      ['doorErrors', 12],
      ['doorErrorsPerThousand', 0.6],
      ['fallbackAnswered', 13],
    ])
    expect(b.why).toEqual([])
  })

  it('says why a limit is not met, or cannot be read yet, by the server\'s codes', () => {
    expect(limitOf(reply, 'DAWAA_NOW_PROMISE').why).toEqual(['HALF_OUTSIDE_BAND'])
    expect(limitOf(reply, 'SPLIT_CHECK').why).toEqual(['SPLIT_CHECK_NOT_RECORDED'])
  })

  it('never leaves a limit that is not met without a why', () => {
    expect(limitOf(withLimit({ code: 'RATES', state: 'NOT_MET', why: [], figures: {} }), 'RATES').why).toEqual(['UNSAID'])
  })

  it('reads a limit the reply left out as one that cannot be read yet, and says so', () => {
    const missing = withReading({ limits: reply.reading.limits.filter((l) => l.code !== 'RATES') })
    expect(limitOf(missing, 'RATES')).toMatchObject({ state: 'CANNOT_READ_YET', why: ['UNSENT'] })
  })

  it('names the period\'s causes, each with its day or figure', () => {
    const r = withReading({ state: 'CANNOT_READ_YET', cannotReadYet: [{ code: 'RAMADAN', detail: '2027-02-08' }, { code: 'READ_REACH_OFF', detail: '' }] })
    expect(barReading(r).periodWhys).toEqual([
      { code: 'RAMADAN', detail: '2027-02-08' },
      { code: 'READ_REACH_OFF', detail: '' },
    ])
  })
})

describe('barReading — the largest differences, the rulings, the split check', () => {
  it('groups the largest differences by view and way, the largest first, with how many are marked', () => {
    const groups = barReading(reply).largest
    expect(groups.map((g) => [g.view, g.way, g.rows.map((r) => r.orderNumber), g.marked])).toEqual([
      ['WHOLE_PLAN', 'ADVISOR_EARLIER', ['0081733012', '0081734455'], 1],
      ['WHOLE_PLAN', 'ADVISOR_LATER', ['0081736620'], 0],
      ['STORES_ONLY', 'ADVISOR_EARLIER', ['0081733012', '0081737781'], 1],
      ['STORES_ONLY', 'ADVISOR_LATER', ['0081738904'], 0],
    ])
  })

  it('lists the reasons and the shelf chance figures that wait for a written ruling, and those ruled', () => {
    const { rulings } = barReading(reply)
    expect(rulings.due.map((r) => [r.kind, r.key])).toEqual([['SHELF_CHANCE', 'SLOT|BOOK_AT_ZERO']])
    expect(rulings.written.map((r) => [r.kind, r.key])).toEqual([
      ['OUTSIDE_REASON', 'PIN_PAIR_REMOVED|OUT_OF_REACH'],
      ['SHELF_CHANCE', 'DAWAA_NOW|BOOK_BELOW_ZERO'],
    ])
  })

  it('carries the split check as closed, or none', () => {
    expect(barReading(reply).splitCheck).toBeNull()
    const split = { kind: 'SPLIT_CHECK' as const, key: '', mark: 'WITHIN_LIMIT' as const, text: 'Read on 40 orders.', by: 'owner.dmsco', at: '2026-11-26 11:00:00' }
    expect(barReading(withReading({ splitCheck: split })).splitCheck).toEqual(split)
  })

  it('lists the kept readings newest first', () => {
    const kept = (id: string, readAt: string) => ({ ...keptRow, id, readAt })
    const r = { ...reply, kept: [kept('A', '2026-11-20 08:00:00'), kept('B', '2026-11-26 08:00:00')] }
    expect(barReading(r).kept.map((k) => k.id)).toEqual(['B', 'A'])
  })
})

const keptRow = {
  id: '',
  from: '2026-10-30 00:00:00',
  to: '2026-11-27 00:00:00',
  channelGroup: 'APP_SITE' as const,
  step: 'STORES_ONLY' as const,
  candidateName: 'Baseline',
  candidateVersion: 3,
  met: false,
  note: '',
  readBy: 'owner.dmsco',
  readAt: '',
}

describe('barPeriodEnd — the 28 days from the first', () => {
  it('ends 27 days after the first day', () => {
    expect(barPeriodEnd('2026-10-30')).toBe('2026-11-26')
    expect(barPeriodEnd('')).toBe('')
  })
})

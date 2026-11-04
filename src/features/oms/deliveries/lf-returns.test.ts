/**
 * "LF returns needing action" (ticket 764, spec 759 F6): the queue's pure projection — the age in
 * days from `bookedAt` against local wall-clock, the reason each outcome reads as, and the 03 gate.
 */
import { describe, expect, it } from 'vitest'
import type { LfReturnNeedingActionRow } from '@/core/models/lf-returns-needing-action'
import ar from '@/locales/ar/deliveries.json'
import en from '@/locales/en/deliveries.json'
import { ageInDays, needingActionReason, needingActionRows, offersLfReturnsQueue } from './lf-returns'

/** A local wall-clock moment, as the server sends it (no offset) and as `new Date()` reads it. */
const at = (y: number, m: number, d: number, h = 0, min = 0) => new Date(y, m - 1, d, h, min)

describe('age in days from bookedAt', () => {
  it('is 0 on the day it was booked, however late in the day', () => {
    expect(ageInDays('2026-11-04T08:15:00', at(2026, 11, 4, 23, 59))).toBe(0)
  })

  it('turns over at local midnight, not after 24 hours', () => {
    expect(ageInDays('2026-11-03T23:50:00', at(2026, 11, 4, 0, 10))).toBe(1)
    expect(ageInDays('2026-11-04T00:05:00', at(2026, 11, 4, 23, 55))).toBe(0)
  })

  it('counts calendar days across a month boundary', () => {
    expect(ageInDays('2026-10-30T12:00:00', at(2026, 11, 2, 9))).toBe(3)
    expect(ageInDays('2026-02-27T10:00:00', at(2026, 3, 1, 10))).toBe(2)
  })

  it('counts across a year boundary', () => {
    expect(ageInDays('2026-12-31T22:00:00', at(2027, 1, 1, 1))).toBe(1)
  })

  it('has no age for a missing or unreadable bookedAt', () => {
    expect(ageInDays(null, at(2026, 11, 4))).toBeNull()
    expect(ageInDays('', at(2026, 11, 4))).toBeNull()
    expect(ageInDays('not a date', at(2026, 11, 4))).toBeNull()
  })

  it('never reads a booking stamped after now as a negative age', () => {
    expect(ageInDays('2026-11-05T09:00:00', at(2026, 11, 4, 9))).toBe(0)
  })
})

const row = (returnDeliveryNo: string, outcome: string, bookedAt: string | null = '2026-11-01T10:00:00') =>
  ({ returnDeliveryNo, forwardDeliveryNo: '9' + returnDeliveryNo, outcome, bookedAt }) as LfReturnNeedingActionRow

describe('each outcome maps to its reason key', () => {
  it('reads the three needing-action outcomes as their own reasons', () => {
    expect(needingActionReason('unanswered')).toBe('unanswered')
    expect(needingActionReason('nothingReceived')).toBe('nothingReceived')
    expect(needingActionReason('short')).toBe('short')
  })

  it('reads 3369 prose spelling nothing-received as the same reason', () => {
    expect(needingActionReason('nothing-received')).toBe('nothingReceived')
  })

  it('gives no reason for an outcome that needs no action, or one it has not learned', () => {
    for (const outcome of ['open', 'refunded', 'forced', 'lost', '', null, undefined])
      expect(needingActionReason(outcome)).toBeNull()
  })

  it('every reason has its English wording', () => {
    expect(en.lfReturns.reason).toEqual({
      unanswered: 'Unanswered',
      nothingReceived: 'Nothing received',
      short: 'Short',
    })
  })

  it('lists the needing rows in the server order with reason and age, and drops the rest', () => {
    const now = new Date(2026, 10, 4, 9)
    const listed = needingActionRows(
      [
        row('7001', 'short', '2026-11-03T18:00:00'),
        row('7002', 'refunded'),
        row('7003', 'unanswered', '2026-10-20T08:00:00'),
        row('7004', 'forced'),
        row('7005', 'nothingReceived', null),
      ],
      now,
    )
    expect(listed).toEqual([
      { returnDeliveryNo: '7001', forwardDeliveryNo: '97001', reason: 'short', bookedAt: '2026-11-03T18:00:00', ageDays: 1 },
      { returnDeliveryNo: '7003', forwardDeliveryNo: '97003', reason: 'unanswered', bookedAt: '2026-10-20T08:00:00', ageDays: 15 },
      { returnDeliveryNo: '7005', forwardDeliveryNo: '97005', reason: 'nothingReceived', bookedAt: null, ageDays: null },
    ])
  })

  it('lists nothing for an empty or absent answer', () => {
    expect(needingActionRows([], new Date())).toEqual([])
    expect(needingActionRows(null, new Date())).toEqual([])
  })
})

describe('the preset is absent without 03', () => {
  const list = { canOpenList: true, canOpenDetail: true }

  it('is offered with LocalFulfillmentReturn 03', () => {
    expect(offersLfReturnsQueue({ ...list, canCreateLocalFulfillmentReturn: true })).toBe(true)
  })

  it('is absent without 03, whatever else the session holds', () => {
    expect(offersLfReturnsQueue(list)).toBe(false)
    expect(offersLfReturnsQueue({ ...list, canCreateLocalFulfillmentReturn: false })).toBe(false)
    // The bonded return grant is another grant, and 04 counts only beside 03.
    expect(offersLfReturnsQueue({ ...list, canCreateReturn: true, canForceLocalFulfillmentReturnRefund: true })).toBe(false)
  })

  it('is absent while the probe is pending or failed', () => {
    expect(offersLfReturnsQueue(undefined)).toBe(false)
    expect(offersLfReturnsQueue(null)).toBe(false)
  })
})

describe('the queue speaks Arabic too', () => {
  const keys = (o: object, at = ''): string[] =>
    Object.entries(o).flatMap(([k, v]) => (typeof v === 'object' && v ? keys(v, `${at}${k}.`) : [`${at}${k}`]))
  const base = (k: string) => k.replace(/_(zero|one|two|few|many|other)$/, '')

  it('has every English key of the queue in the ar bundle, and nothing else', () => {
    expect(new Set(keys(ar.lfReturns).map(base))).toEqual(new Set(keys(en.lfReturns).map(base)))
    expect(Object.keys(ar)).toEqual(['lfReturns'])
  })

  it('words the age in every Arabic plural form', () => {
    expect(Object.keys(ar.lfReturns).filter((k) => k.startsWith('age_')).sort()).toEqual([
      'age_few',
      'age_many',
      'age_one',
      'age_other',
      'age_two',
      'age_zero',
    ])
  })
})

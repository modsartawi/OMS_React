import { describe, expect, it } from 'vitest'
import type { ResultsDifferRow, ResultsSummaryReply } from '@/core/models/sourcing-results'
import stub from './stub-summary.json'
import { differRows } from './differ-rows-model'

const reply = stub as unknown as ResultsSummaryReply

describe('differRows — the estimate beside the endings, per class, in one view', () => {
  it('lists the classes that differ in the whole plan, then "same plan" last as the reference', () => {
    expect(differRows(reply.differ, 'WHOLE_PLAN').rows.map((r) => r.cls)).toEqual([
      'ANOTHER_STORE',
      'ANOTHER_MODE',
      'FEWER_SHIPMENTS',
      'MORE_SHIPMENTS',
      'OUTSIDE_RULES',
      'SAME_PLAN',
    ])
  })

  it('lists the stores-only classes, the callout fallback among them, and never "not comparable"', () => {
    const rows = differRows(reply.differ, 'STORES_ONLY').rows
    expect(rows.map((r) => r.cls)).toEqual(['ANOTHER_STORE', 'CALLOUT_FALLBACK', 'OUTSIDE_RULES', 'SAME_PLAN'])
  })

  it('carries the orders and the share as sent', () => {
    const store = differRows(reply.differ, 'WHOLE_PLAN').rows[0]
    expect([store.orders, store.percent]).toEqual([5260, 13.2])
  })

  it('reads the estimate as minutes earlier or later, the middle order and the middle half', () => {
    const rows = differRows(reply.differ, 'WHOLE_PLAN').rows
    const store = rows.find((r) => r.cls === 'ANOTHER_STORE')!.estimate
    const fewer = rows.find((r) => r.cls === 'FEWER_SHIPMENTS')!.estimate
    expect(store).toMatchObject({ kind: 'estimate', middle: 6, low: -2, high: 19, says: { way: 'earlier', minutes: 6 } })
    expect(fewer).toMatchObject({ kind: 'estimate', middle: -40, says: { way: 'later', minutes: 40 } })
  })

  it('reads a middle of zero as the same time', () => {
    const row: ResultsDifferRow = { ...reply.differ[1], estimate: { middle: 0, low: -5, high: 5 } }
    expect(differRows([row], 'WHOLE_PLAN').rows[0].estimate).toMatchObject({ says: { way: 'same', minutes: 0 } })
  })

  it('gives "outside the rules" and the callout fallback no estimate, and says why', () => {
    const whole = differRows(reply.differ, 'WHOLE_PLAN').rows
    const stores = differRows(reply.differ, 'STORES_ONLY').rows
    expect(whole.find((r) => r.cls === 'OUTSIDE_RULES')!.estimate).toEqual({ kind: 'none', why: 'rules' })
    expect(stores.find((r) => r.cls === 'CALLOUT_FALLBACK')!.estimate).toEqual({ kind: 'none', why: 'fallback' })
  })

  it('never draws an estimate for "outside the rules", even when one is sent', () => {
    const rules: ResultsDifferRow = { ...reply.differ[5], estimate: { middle: 12, low: 0, high: 30 } }
    expect(differRows([rules], 'WHOLE_PLAN').rows[0].estimate).toEqual({ kind: 'none', why: 'rules' })
  })

  it('marks "same plan" as the reference, with nothing to estimate', () => {
    const same = differRows(reply.differ, 'WHOLE_PLAN').rows.at(-1)!
    expect(same.reference).toBe(true)
    expect(same.estimate).toEqual({ kind: 'reference' })
  })

  it('shares one axis across the view, with zero on it, rounded out to half hours', () => {
    expect(differRows(reply.differ, 'WHOLE_PLAN').axis).toEqual({ from: -120, to: 300, zero: (120 / 420) * 100 })
    expect(differRows(reply.differ, 'STORES_ONLY').axis).toEqual({ from: -30, to: 30, zero: 50 })
  })

  it('places the dot and the bar on that axis', () => {
    const store = differRows(reply.differ, 'WHOLE_PLAN').rows[0].estimate
    if (store.kind !== 'estimate') throw new Error('expected an estimate')
    expect(store.at.middle).toBeCloseTo(30, 5)
    expect(store.at.start).toBeCloseTo((118 / 420) * 100, 5)
    expect(store.at.width).toBeCloseTo(5, 5)
  })

  it('draws the endings bar in order, the customer\'s own cancellation hatched as shown, not counted', () => {
    const store = differRows(reply.differ, 'WHOLE_PLAN').rows[0]
    expect(store.endings.map((e) => [e.ending, e.percent, e.hatched])).toEqual([
      ['ON_TIME', 80.3, false],
      ['LATE', 8.9, false],
      ['RETURNED', 5.6, false],
      ['CANCELLED', 3.5, false],
      ['CUSTOMER_CANCELLED', 1.7, true],
    ])
  })

  it('leaves out a differing class with no orders, but keeps "same plan" as the reference', () => {
    const rows: ResultsDifferRow[] = reply.differ.map((r) => (r.cls === 'MORE_SHIPMENTS' || r.cls === 'SAME_PLAN' ? { ...r, orders: 0, percent: 0 } : r))
    expect(differRows(rows, 'WHOLE_PLAN').rows.map((r) => r.cls)).toEqual([
      'ANOTHER_STORE',
      'ANOTHER_MODE',
      'FEWER_SHIPMENTS',
      'OUTSIDE_RULES',
      'SAME_PLAN',
    ])
  })
})

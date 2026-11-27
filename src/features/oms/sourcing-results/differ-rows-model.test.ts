import { describe, expect, it } from 'vitest'
import type { ResultsDifferReply, ResultsDifferRow } from '@/core/models/sourcing-results'
import stub from './stub-first.json'
import { differRows } from './differ-rows-model'

// `GET SourcingAdvisor/Results/Differ?view=` (BO 4393), both views. An estimate's minus is the advisor's plan EARLIER.
const whole = stub.differ.WHOLE_PLAN as unknown as ResultsDifferReply
const stores = stub.differ.STORES_ONLY as unknown as ResultsDifferReply
const withRows = (rows: ResultsDifferRow[]): ResultsDifferReply => ({ ...whole, rows })
const rowOf = (code: string) => whole.rows.find((r) => r.code === code)!

describe('differRows — the estimate beside the endings, per row, in one view', () => {
  it('keeps the server order: the classes that differ, then "same plan" last as the reference', () => {
    expect(differRows(whole).rows.map((r) => r.cls)).toEqual([
      'ANOTHER_MODE',
      'FEWER_SHIPMENTS',
      'MORE_SHIPMENTS',
      'ANOTHER_STORE',
      'OUTSIDE_RULES',
      'CALLOUT_FALLBACK',
      'SAME_PLAN',
    ])
    expect(differRows(stores).rows.map((r) => r.cls)).toEqual(['ANOTHER_STORE', 'OUTSIDE_RULES', 'CALLOUT_FALLBACK', 'SAME_PLAN'])
  })

  it('carries the orders as sent', () => {
    expect(differRows(whole).rows.find((r) => r.cls === 'ANOTHER_STORE')!.orders).toBe(4830)
  })

  it('reads a minus as the advisor\'s plan arriving earlier, a plus later, with the middle half', () => {
    const rows = differRows(whole).rows
    expect(rows.find((r) => r.cls === 'ANOTHER_STORE')!.estimate).toMatchObject({
      kind: 'estimate',
      middle: -6,
      low: -19,
      high: 2,
      says: { way: 'earlier', minutes: 6 },
    })
    expect(rows.find((r) => r.cls === 'FEWER_SHIPMENTS')!.estimate).toMatchObject({ kind: 'estimate', middle: 40, says: { way: 'later', minutes: 40 } })
  })

  it('reads a middle of zero as the same time', () => {
    const row: ResultsDifferRow = { ...rowOf('ANOTHER_STORE'), estimate: { middle: 0, low: -5, high: 5, orders: 10 } }
    expect(differRows(withRows([row])).rows[0].estimate).toMatchObject({ says: { way: 'same', minutes: 0 } })
  })

  it('gives "outside the rules" and the callout fallback no estimate, and says why, even when one is sent', () => {
    const rules: ResultsDifferRow = { ...rowOf('OUTSIDE_RULES'), estimate: { middle: 12, low: 0, high: 30, orders: 5 } }
    expect(differRows(withRows([rules])).rows[0].estimate).toEqual({ kind: 'none', why: 'rules' })
    expect(differRows(whole).rows.find((r) => r.cls === 'CALLOUT_FALLBACK')!.estimate).toEqual({ kind: 'none', why: 'fallback' })
  })

  it('says a differing row with no estimate sent has none', () => {
    const row: ResultsDifferRow = { ...rowOf('ANOTHER_MODE'), estimate: null }
    expect(differRows(withRows([row])).rows[0].estimate).toEqual({ kind: 'none', why: 'missing' })
  })

  it('marks "same plan" as the reference, with nothing to estimate', () => {
    const same = differRows(whole).rows.at(-1)!
    expect(same.reference).toBe(true)
    expect(same.estimate).toEqual({ kind: 'reference' })
  })

  it('shares one axis across the view, earlier at its start, rounded out to half hours', () => {
    expect(differRows(whole).axis).toEqual({ from: -300, to: 120, zero: (300 / 420) * 100 })
    expect(differRows(stores).axis).toEqual({ from: -30, to: 30, zero: 50 })
  })

  it('places the dot and the bar on that axis', () => {
    const e = differRows(whole).rows.find((r) => r.cls === 'ANOTHER_STORE')!.estimate
    if (e.kind !== 'estimate') throw new Error('expected an estimate')
    expect(e.at.middle).toBeCloseTo((294 / 420) * 100, 5)
    expect(e.at.start).toBeCloseTo((281 / 420) * 100, 5)
    expect(e.at.width).toBeCloseTo((21 / 420) * 100, 5)
  })

  it('draws the endings bar from the counts as sent, the customer\'s own cancellation hatched as shown, not counted', () => {
    const row = differRows(whole).rows.find((r) => r.cls === 'ANOTHER_STORE')!
    expect(row.endings.map((e) => [e.ending, e.count, e.hatched])).toEqual([
      ['ON_TIME', 3878, false],
      ['LATE', 430, false],
      ['RETURNED', 270, false],
      ['CANCELLED', 169, false],
      ['CUSTOMER_CANCELLED', 82, true],
      ['NOT_ENDED', 1, false],
    ])
  })

  it('leaves out a differing row with no orders, but keeps "same plan" as the reference', () => {
    const rows = whole.rows.map((r) => (r.code === 'MORE_SHIPMENTS' || r.code === 'SAME_PLAN' ? { ...r, orders: 0 } : r))
    expect(differRows(withRows(rows)).rows.map((r) => r.cls)).toEqual([
      'ANOTHER_MODE',
      'FEWER_SHIPMENTS',
      'ANOTHER_STORE',
      'OUTSIDE_RULES',
      'CALLOUT_FALLBACK',
      'SAME_PLAN',
    ])
  })
})

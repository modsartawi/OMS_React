import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import type { DispatchScorecardDrillRow } from '@/core/models/dispatch-scorecard'
import {
  CLOSE_OUTCOMES,
  causeKey,
  closedRows,
  closesFiltersFromParams,
  closesFiltersToParams,
  isFailedTakeOutcome,
  outcomeCounts,
  reasonCounts,
  withOutcomes,
} from './closes'

describe('who caused the close, in plain words (a label per outcome, nothing computed)', () => {
  it('names each known outcome its own words', () => {
    expect(
      ['StoreClosed', 'CourierBlamedStore', 'FallbackStoreClosed', 'CourierOtherReason', 'CourierNoReason', 'OtherClose'].map(causeKey),
    ).toEqual([
      'closes.cause.StoreClosed',
      'closes.cause.CourierBlamedStore',
      'closes.cause.FallbackStoreClosed',
      'closes.cause.CourierOtherReason',
      'closes.cause.CourierNoReason',
      'closes.cause.OtherClose',
    ])
  })
  it('an outcome the screen does not know reads "Unclear"', () => {
    expect(causeKey('CourierLostParcel')).toBe('closes.cause.unknown')
    expect(causeKey('')).toBe('closes.cause.unknown')
  })
  it('only a store close and a courier cancel naming the store are failed takes', () => {
    expect(
      ['StoreClosed', 'CourierBlamedStore', 'FallbackStoreClosed', 'CourierOtherReason', 'CourierNoReason', 'OtherClose', 'Whatever'].map(
        isFailedTakeOutcome,
      ),
    ).toEqual([true, true, false, false, false, false, false])
  })
})

const row = (calloutId: string, offeredAt: string, over: Partial<DispatchScorecardDrillRow> = {}) =>
  ({ calloutId, bidId: `B-${calloutId}`, offeredAt, afterTakeOutcome: '', ...over }) as DispatchScorecardDrillRow

describe('the rows the report lists', () => {
  it('keeps only the takes that were closed after the take, and adds the fallback cancels, oldest offer first', () => {
    const taken = [
      row('C1', '2026-11-01T08:00:00', { afterTakeOutcome: 'StoreClosed' }),
      row('C2', '2026-11-01T09:00:00'),
      row('C3', '2026-11-01T07:00:00', { afterTakeOutcome: 'CourierNoReason' }),
      row('C4', '2026-11-01T10:00:00', { afterTakeOutcome: 'SomethingNew' }),
    ]
    const fallback = [row('C9', '2026-11-01T08:30:00', { bidId: '', afterTakeOutcome: 'FallbackStoreClosed' })]
    expect(closedRows(taken, fallback).map((r) => r.calloutId)).toEqual(['C3', 'C1', 'C9', 'C4'])
  })
  it('a server before 3326 (no outcome field at all) lists nothing', () => {
    expect(closedRows([{ calloutId: 'C1', offeredAt: '2026-11-01T08:00:00' } as DispatchScorecardDrillRow], [])).toEqual([])
  })
  it("a fallback close is listed once, from the fallback read, never again on the original taker's bid", () => {
    const taken = [row('C5', '2026-11-01T08:00:00', { afterTakeOutcome: 'FallbackStoreClosed', party: 'P001' })]
    const fallback = [row('C5', '2026-11-01T08:00:00', { bidId: '', afterTakeOutcome: 'FallbackStoreClosed', party: 'P003' })]
    expect(closedRows(taken, fallback).map((r) => r.party)).toEqual(['P003'])
  })
})

describe('the reasons, ranked by how many rows give the identical text', () => {
  const r = (afterTakeReason: string | undefined, afterTakeOutcome = 'CourierBlamedStore') =>
    row('C', '2026-11-01T08:00:00', { afterTakeReason, afterTakeOutcome })
  it('groups identical text, most first; Arabic text is kept exactly as sent', () => {
    const ar = 'الطلب غير موجود في الفرع'
    const rows = [r('Order Not Found in branch'), r(ar), r('Order Not Found in branch'), r('Customer unreachable', 'StoreClosed'), r(ar), r('Order Not Found in branch')]
    expect(reasonCounts(rows)).toEqual([
      { reason: 'Order Not Found in branch', count: 3 },
      { reason: ar, count: 2 },
      { reason: 'Customer unreachable', count: 1 },
    ])
  })
  it('an empty, blank or missing reason counts as one "No reason given" (reason null), whoever closed it', () => {
    expect(reasonCounts([r(''), r('  ', 'StoreClosed'), r(undefined, 'OtherClose'), r('x')])).toEqual([
      { reason: null, count: 3 },
      { reason: 'x', count: 1 },
    ])
  })
  it('text differing only by surrounding spaces is the same reason; letter case is not touched', () => {
    expect(reasonCounts([r('Order Not Found in branch '), r('Order Not Found in branch'), r('order not found in branch')])).toEqual([
      { reason: 'Order Not Found in branch', count: 2 },
      { reason: 'order not found in branch', count: 1 },
    ])
  })
  it('a tie keeps the order the reasons first appear in', () => {
    expect(reasonCounts([r('b'), r('a')]).map((c) => c.reason)).toEqual(['b', 'a'])
  })
})

describe('the outcome chips', () => {
  const o = (afterTakeOutcome: string) => row('C', '2026-11-01T08:00:00', { afterTakeOutcome })
  const rows = [o('CourierBlamedStore'), o('StoreClosed'), o('CourierBlamedStore'), o('OtherClose'), o('CourierLostParcel')]
  it('count every known outcome (zero included) in the known order, then any unknown one the door sent', () => {
    expect(outcomeCounts(rows)).toEqual([
      { outcome: 'StoreClosed', count: 1 },
      { outcome: 'CourierBlamedStore', count: 2 },
      { outcome: 'FallbackStoreClosed', count: 0 },
      { outcome: 'CourierOtherReason', count: 0 },
      { outcome: 'CourierNoReason', count: 0 },
      { outcome: 'OtherClose', count: 1 },
      { outcome: 'CourierLostParcel', count: 1 },
    ])
  })
  it('the picked outcomes narrow the rows; none picked lists none', () => {
    expect(withOutcomes(rows, ['StoreClosed', 'CourierBlamedStore']).map((r) => r.afterTakeOutcome)).toEqual([
      'CourierBlamedStore',
      'StoreClosed',
      'CourierBlamedStore',
    ])
    expect(withOutcomes(rows, ['CourierLostParcel']).length).toBe(1)
    expect(withOutcomes(rows, [])).toEqual([])
  })
})

describe("the report's URL", () => {
  const read = (qs: string) => closesFiltersFromParams(new URLSearchParams(qs))
  const write = (qs: string) => closesFiltersToParams(read(qs)).toString()
  it('a bare URL is the closes tab, the default range, no filter, the two failed-take kinds', () => {
    expect(read('')).toEqual({
      tab: 'closes',
      from: '',
      to: '',
      type: '',
      channel: '',
      city: '',
      region: '',
      store: '',
      outcomes: ['StoreClosed', 'CourierBlamedStore'],
    })
    expect(write('')).toBe('')
  })
  it('holds the scorecard filters, the refused tab and a picked outcome list', () => {
    const f = read('tab=refused&from=2026-10-01&to=2026-10-31&city=Al%20Khobar&store=P001&outcome=OtherClose,CourierNoReason')
    expect(f.tab).toBe('refused')
    expect(f.city).toBe('Al Khobar')
    expect(f.outcomes).toEqual(['OtherClose', 'CourierNoReason'])
    expect(write('tab=refused&city=Al%20Khobar&outcome=OtherClose,CourierNoReason')).toBe('tab=refused&city=Al+Khobar&outcome=OtherClose%2CCourierNoReason')
  })
  it('the default outcomes (in any order) write nothing; none picked is kept as none', () => {
    expect(write('outcome=CourierBlamedStore,StoreClosed')).toBe('')
    expect(read('outcome=').outcomes).toEqual([])
    expect(write('outcome=')).toBe('outcome=')
  })
  it('an unknown tab reads as the closes tab; an unknown outcome is kept as sent', () => {
    expect(read('tab=staff').tab).toBe('closes')
    expect(read('outcome=CourierLostParcel').outcomes).toEqual(['CourierLostParcel'])
  })
})

describe('the words of the report', () => {
  const read = (lng: string) => JSON.parse(readFileSync(`src/locales/${lng}/dispatch-scorecard.json`, 'utf8'))
  it.each(['en', 'ar'])('%s: every who-caused-it label exists (known, unknown, refused), and none says no stock', (lng) => {
    const ns = read(lng)
    for (const k of [...CLOSE_OUTCOMES, 'unknown', 'refused']) expect(ns.closes.cause[k], k).toBeTruthy()
    expect(ns.menu.closesAfterTake).toBeTruthy()
    expect(JSON.stringify(ns.closes)).not.toMatch(/no stock|out of stock|not in stock|لا يوجد مخزون|نفد|نفاد|غير متوفر/i)
  })
})

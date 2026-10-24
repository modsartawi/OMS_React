/**
 * Ticket 546 — the To open tab's group view and its address ↔ door. Pure.
 */
import { describe, expect, it } from 'vitest'
import type { PrescriptionSessionHqToOpen, PrescriptionSessionHqToOpenOrder } from '@/core/models/prescription-session'
import { toOpenFilterFromParams, toOpenFilterToParams, toOpenGroups, toOpenRequest } from './to-open'

const order = (documentNo: string, over: Partial<PrescriptionSessionHqToOpenOrder> = {}): PrescriptionSessionHqToOpenOrder => ({
  documentNo,
  documentType: 'ZPRS',
  sourceKind: 'NPHS',
  documentSource: '',
  patientId: '1012345678',
  approvalNumber: 'AP-1',
  orderedAt: '2026-10-20T09:00:00',
  ageDays: 4,
  ...over,
})

const answer = (over: Partial<PrescriptionSessionHqToOpen> = {}): PrescriptionSessionHqToOpen => ({
  stores: [
    { storeCode: 'P002', count: 1, oldestAgeDays: 2, oldestOrderedAt: '2026-10-22T08:00:00', orders: [order('3001')] },
    {
      storeCode: 'P009',
      count: 5,
      oldestAgeDays: 11,
      oldestOrderedAt: '2026-10-13T10:00:00',
      orders: [order('2001', { documentSource: 'BKOF' }), order('2002')],
    },
    { storeCode: 'P001', count: 2, oldestAgeDays: 11, oldestOrderedAt: '2026-10-13T09:30:00', orders: [order('1001'), order('1002')] },
  ],
  total: 8,
  byUpload: false,
  ...over,
})

describe('toOpenGroups', () => {
  it('orders the stores oldest unopened order first, the earlier minute winning a same-age tie', () => {
    expect(toOpenGroups(answer()).map((g) => g.storeCode)).toEqual(['P001', 'P009', 'P002'])
  })

  it('says a group is capped only when it lists fewer orders than its count', () => {
    const byStore = Object.fromEntries(toOpenGroups(answer()).map((g) => [g.storeCode, g]))
    expect(byStore.P009.capped).toEqual({ shown: 2, count: 5 })
    expect(byStore.P001.capped).toBeNull()
    expect(byStore.P002.capped).toBeNull()
  })

  it('marks an order from a BKOF upload as a bulk upload, and no other', () => {
    const p009 = toOpenGroups(answer()).find((g) => g.storeCode === 'P009')!
    expect(p009.orders.map((o) => [o.documentNo, o.bulkUpload])).toEqual([
      ['2001', true],
      ['2002', false],
    ])
  })

  it('reads the BKOF source case- and blank-tolerantly', () => {
    const one = answer({
      stores: [{ storeCode: 'P001', count: 1, oldestAgeDays: 1, oldestOrderedAt: '2026-10-23T09:00:00', orders: [order('9', { documentSource: ' bkof ' })] }],
    })
    expect(toOpenGroups(one)[0].orders[0].bulkUpload).toBe(true)
  })

  it('reads the source kind as its word', () => {
    const g = toOpenGroups(answer())[0]
    expect(g.orders[0].source).toEqual({ key: 'source.NPHS', raw: 'NPHS' })
  })

  it('ignores byUpload: still one group per store', () => {
    expect(toOpenGroups(answer({ byUpload: true })).map((g) => g.storeCode)).toEqual(['P001', 'P009', 'P002'])
  })

  it('draws nothing for an empty answer', () => {
    expect(toOpenGroups({ stores: [], total: 0, byUpload: false })).toEqual([])
  })
})

describe('the To open address and door', () => {
  it('keeps tab=toOpen and the store in the address, and drops an empty store', () => {
    expect(toOpenFilterToParams({ store: ' P019 ' }).toString()).toBe('tab=toOpen&store=P019')
    expect(toOpenFilterToParams({ store: '' }).toString()).toBe('tab=toOpen')
  })

  it('reads the store back from the address', () => {
    expect(toOpenFilterFromParams(new URLSearchParams('tab=toOpen&store=P019'))).toEqual({ store: 'P019' })
    expect(toOpenFilterFromParams(new URLSearchParams('tab=toOpen'))).toEqual({ store: '' })
  })

  it('asks ToOpen with the store, or with nothing', () => {
    expect(toOpenRequest({ store: 'P019' })).toEqual({ path: 'PrescriptionSessionWeb/ToOpen', params: { store: 'P019' } })
    expect(toOpenRequest({ store: '  ' })).toEqual({ path: 'PrescriptionSessionWeb/ToOpen', params: {} })
  })
})

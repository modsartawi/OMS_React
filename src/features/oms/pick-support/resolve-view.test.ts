/** The Search tab's reading of a Resolve answer, and its URL state (ticket 496, brief 2691). */
import { describe, expect, it } from 'vitest'
import type { PickSupportResolution, PickSupportSerialHold } from '@/core/models/pick-support'
import { oneDeliveryResolution } from '@/core/pick-support/__fixtures__/brief'
import { openable, resolveView, searchFromParams, searchToParams } from './resolve-view'

const hold = (over: Partial<PickSupportSerialHold> = {}): PickSupportSerialHold => ({
  serialNumber: 'SN12345',
  gtin: '06281234567890',
  documentNo: 'PD0001234',
  sourceType: 'OMS',
  sourceKey: '8006777365',
  storeCode: '1112',
  documentState: 'PUTBACK',
  consumedByTrx: '',
  deliveryNo: '8006777365',
  hold: 'PUT_BACK_BASKET',
  shapes: [],
  explanationEn: 'A put-back basket.',
  explanationAr: 'سلة إرجاع.',
  ...over,
})

describe('resolveView', () => {
  it('one delivery and no serials opens its diagnosis', () => {
    expect(resolveView(oneDeliveryResolution())).toEqual({ kind: 'diagnosis', deliveryNo: '8006777365' })
  })

  it('several deliveries give a pick list, in the server order', () => {
    const one = oneDeliveryResolution()
    const r: PickSupportResolution = {
      ...one,
      key: '1000456789',
      deliveries: [
        { ...one.deliveries[0], matchedBy: ['ORDER'] },
        { ...one.deliveries[0], deliveryNo: '8006777366', matchedBy: ['ORDER'], shapes: [] },
      ],
    }
    const view = resolveView(r)
    expect(view.kind).toBe('list')
    if (view.kind === 'list') expect(view.deliveries.map((d) => d.deliveryNo)).toEqual(['8006777365', '8006777366'])
  })

  it('serials give the holds table — even with one delivery, which it carries along', () => {
    const one = oneDeliveryResolution()
    const holds = [hold(), hold({ documentNo: 'PD0000999', hold: 'STUCK', shapes: ['DONOR_AT_OLD_ORDER_STORE'] })]
    const view = resolveView({ ...one, key: 'SN12345', serials: holds })
    expect(view).toEqual({ kind: 'holds', holds, deliveries: one.deliveries })
  })

  it('matched:false gives the server sentence, EN and AR', () => {
    const view = resolveView({
      key: 'ZZZ',
      matched: false,
      messageEn: "Nothing matches 'ZZZ'.",
      messageAr: "لا شيء يطابق 'ZZZ'.",
      deliveries: [],
      serials: [],
    })
    expect(view).toEqual({ kind: 'noMatch', messageEn: "Nothing matches 'ZZZ'.", messageAr: "لا شيء يطابق 'ZZZ'." })
  })

  it('a match that names nothing is an empty list, not a diagnosis', () => {
    expect(resolveView({ ...oneDeliveryResolution(), deliveries: [] })).toEqual({ kind: 'list', deliveries: [] })
  })
})

describe('openable', () => {
  it("a list opens its own deliveries, holds theirs and their holds' deliveries, the rest nothing", () => {
    const d = oneDeliveryResolution().deliveries[0]
    expect(openable({ kind: 'list', deliveries: [d, { ...d, deliveryNo: '8006777366' }] })).toEqual(['8006777365', '8006777366'])
    expect(openable({ kind: 'holds', deliveries: [], holds: [hold({ deliveryNo: '8006777399' }), hold({ deliveryNo: '' })] })).toEqual(['8006777399'])
    expect(openable({ kind: 'diagnosis', deliveryNo: '8006777365' })).toEqual([])
    expect(openable({ kind: 'noMatch', messageEn: '', messageAr: '' })).toEqual([])
  })
})

describe('search URL state', () => {
  it('reads the key and the opened delivery, trimmed', () => {
    expect(searchFromParams(new URLSearchParams('key=%208006777365%20&delivery=8006777366'))).toEqual({
      key: '8006777365',
      delivery: '8006777366',
    })
    expect(searchFromParams(new URLSearchParams(''))).toEqual({ key: '', delivery: '' })
  })

  it('drops blanks, and a delivery without a key', () => {
    expect(searchToParams({ key: '8006777365', delivery: '' }).toString()).toBe('key=8006777365')
    expect(searchToParams({ key: ' ', delivery: '8006777366' }).toString()).toBe('')
    expect(searchToParams({ key: '1000456789', delivery: '8006777366' }).toString()).toBe('key=1000456789&delivery=8006777366')
  })
})

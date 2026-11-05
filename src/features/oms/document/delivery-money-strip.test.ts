/**
 * Delivery Details' money strip (ticket 789, BackOffice spec 3389 user stories 67–70): a delivery of
 * an insurance order shows whose money stands, the order's patient and insurer totals, the
 * delivery's own amount due, and — with the insurance-view grant only — a link to the order's
 * Insurance section.
 */
import { describe, expect, it } from 'vitest'
import type { OrderDocumentRow } from '@/core/models/order-document'
import { asksDeliveryMoneyStrip, deliveryMoneyStrip, orderRowKey, orderRowOf, stripRefreshKey } from './delivery-money-strip'

/** The order 1006358459's search row, as 3391 would answer an identifier search for it. */
const ROW: OrderDocumentRow = {
  orderNo: 'BUPA-20261105125734-451',
  documentNo: '1006358459',
  documentCategory: 'O',
  documentType: 'BUPA',
  documentTypeDescription: 'Bupa',
  documentSource: 'ERX',
  documentSourceDescription: 'eRx',
  storeCode: '1101',
  customerName: 'Patient',
  customerPhone: '0500000000',
  entryTime: '2026-11-05T12:57:34',
  overallStatus: 'B',
  lastAction: 'ORDY',
  readyStatus: 'C',
  deliveryStatus: 'B',
  clearStatus: '',
  closeStatus: '',
  controlStatus: '',
  netTotal: 66.31,
  amountDue: 63.65,
  latestDeliveryNo: '8000123456',
  guardState: 'none',
  isInsuranceOrder: true,
  moneySource: 'CHANNEL',
  patientTotal: 63.65,
  insurerTotal: 2.66,
  patientId: null,
  memberId: null,
}

const DELIVERY = { refDocumentNo: '1006358459', amountDue: 40.5 }
const GRANTED = { canOpenList: true, canOpenDetail: true, canViewInsurance: true }
const NO_INSURANCE_GRANT = { canOpenList: true, canOpenDetail: true }

describe('delivery money strip: shows source, patient, insurer and the delivery\'s amount due', () => {
  it('1006358459: CHANNEL, patient 63.65, insurer 2.66 and the delivery\'s own 40.50, linked to the order\'s Insurance section', () => {
    const strip = deliveryMoneyStrip(ROW, DELIVERY, GRANTED)!
    expect(strip.source.code).toBe('CHANNEL')
    expect(strip.patient).toEqual({ kind: 'amount', text: '63.65' })
    expect(strip.insurer).toEqual({ kind: 'amount', text: '2.66' })
    expect(strip.amountDue).toEqual({ kind: 'amount', text: '40.50' })
    expect(strip.link).toBe('/oms/document/1006358459#insurance')
  })

  it('the search row carries no currency, so every figure reads in the 2-decimal default', () => {
    const strip = deliveryMoneyStrip({ ...ROW, patientTotal: 63.6 }, { ...DELIVERY, amountDue: 40 }, GRANTED)!
    expect([strip.patient, strip.insurer, strip.amountDue]).toEqual([
      { kind: 'amount', text: '63.60' },
      { kind: 'amount', text: '2.66' },
      { kind: 'amount', text: '40.00' },
    ])
  })

  it('an unknown total is "none", never 0.00', () => {
    const strip = deliveryMoneyStrip({ ...ROW, insurerTotal: null }, DELIVERY, GRANTED)!
    expect(strip.insurer).toEqual({ kind: 'none' })
  })

  it('an order that is not an insurance order has no strip; nor does no row', () => {
    expect(deliveryMoneyStrip({ ...ROW, isInsuranceOrder: false }, DELIVERY, GRANTED)).toBeNull()
    expect(deliveryMoneyStrip(null, DELIVERY, GRANTED)).toBeNull()
  })

  it('the order row is the one whose document no IS the delivery order, never a near match', () => {
    const other = { ...ROW, documentNo: '10063584590' }
    expect(orderRowOf([other, ROW], ' 1006358459 ')).toBe(ROW)
    expect(orderRowOf([other], '1006358459')).toBeNull()
    expect(orderRowOf(null, '1006358459')).toBeNull()
    expect(orderRowOf({} as unknown as OrderDocumentRow[], '1006358459')).toBeNull()
  })

  it('the row is asked only on a delivery with an order, under the list grant', () => {
    const ctx = { openedAs: 'delivery' as const, refDocumentNo: '1006358459', access: NO_INSURANCE_GRANT }
    expect(asksDeliveryMoneyStrip(ctx)).toBe(true)
    expect(asksDeliveryMoneyStrip({ ...ctx, openedAs: 'document' })).toBe(false)
    expect(asksDeliveryMoneyStrip({ ...ctx, refDocumentNo: ' ' })).toBe(false)
    expect(asksDeliveryMoneyStrip({ ...ctx, access: { canOpenDetail: true } })).toBe(false)
    expect(asksDeliveryMoneyStrip({ ...ctx, access: undefined })).toBe(false)
  })
})

describe('delivery money strip: no link without the insurance grant', () => {
  it('the money still shows; the link does not', () => {
    const strip = deliveryMoneyStrip(ROW, DELIVERY, NO_INSURANCE_GRANT)!
    expect(strip.patient).toEqual({ kind: 'amount', text: '63.65' })
    expect(strip.amountDue).toEqual({ kind: 'amount', text: '40.50' })
    expect(strip.link).toBeNull()
  })

  it('a pending or failed probe is no grant', () => {
    expect(deliveryMoneyStrip(ROW, DELIVERY, undefined)!.link).toBeNull()
  })

  it('an order number that needs encoding is encoded in the link', () => {
    const strip = deliveryMoneyStrip({ ...ROW, documentNo: 'A/1' }, { ...DELIVERY, refDocumentNo: 'A/1' }, GRANTED)!
    expect(strip.link).toBe('/oms/document/A%2F1#insurance')
  })
})

describe("delivery money strip: the page's Refresh re-reads it", () => {
  it("a delivery whose strip is asked hands Refresh its order row's key", () => {
    const key = stripRefreshKey({ openedAs: 'delivery', refDocumentNo: ' 1006358459 ', access: { canOpenList: true } })
    expect(key).toEqual(['document', 'order-row', '1006358459'])
    expect(key).toEqual(orderRowKey('1006358459'))
  })

  it('no strip asked, nothing to refresh: a document, a delivery without its order, or without the list grant', () => {
    expect(stripRefreshKey({ openedAs: 'document', refDocumentNo: '1006358459', access: { canOpenList: true } })).toBeNull()
    expect(stripRefreshKey({ openedAs: 'delivery', refDocumentNo: '', access: { canOpenList: true } })).toBeNull()
    expect(stripRefreshKey({ openedAs: 'delivery', refDocumentNo: '1006358459', access: {} })).toBeNull()
  })
})

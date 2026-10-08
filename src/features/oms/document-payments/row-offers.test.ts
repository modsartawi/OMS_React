/**
 * Ticket 433 — `paymentRowOffers`: what a payment row opens (spec 430 D10). Its document always;
 * its delivery only when it names one, so a row without a delivery offers no dead link.
 */
import { describe, expect, it } from 'vitest'
import { paymentRowOffers } from './row-offers'

describe('paymentRowOffers', () => {
  it('a row with a delivery offers its document and its delivery', () => {
    expect(paymentRowOffers({ documentNo: '1000000123', deliveryNo: '8000000500' })).toEqual({
      document: '/oms/document/1000000123',
      delivery: '/oms/delivery/8000000500',
    })
  })

  it.each([null, undefined, '', '   '])('🚩 a row whose delivery is %j offers no delivery', (deliveryNo) => {
    expect(paymentRowOffers({ documentNo: '1000000123', deliveryNo })).toEqual({
      document: '/oms/document/1000000123',
      delivery: null,
    })
  })

  it('trims and encodes the numbers into the route', () => {
    expect(paymentRowOffers({ documentNo: ' 10/1 ', deliveryNo: ' 80 00 ' })).toEqual({
      document: '/oms/document/10%2F1',
      delivery: '/oms/delivery/80%2000',
    })
  })

  it('a row with no document number (never sent, but read defensively) offers no document', () => {
    expect(paymentRowOffers({ documentNo: '', deliveryNo: '8000000500' }).document).toBeNull()
  })
})

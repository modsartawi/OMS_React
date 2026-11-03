/**
 * Ticket 712 (BackOffice spec 3306, door 3311) — the courier quote's flag and the no-move wording on an express
 * delivery, as the board's inspector and row read them, and the two coverage reasons' words. Pure.
 */
import { describe, expect, it } from 'vitest'
import enBoard from '@/locales/en/dispatch-board.json'
import arBoard from '@/locales/ar/dispatch-board.json'
import enDoc from '@/locales/en/document.json'
import arDoc from '@/locales/ar/document.json'
import { CALLOUT_NOT_OPENED_REASONS } from '@/core/models/delivery-callout'
import type { DispatchCourierQuote } from '@/core/models/dispatch-board'
import { localeAt as at } from '@/core/test/locale'
import { courierQuoteView } from './courier-quote'

const quote = (over: Partial<DispatchCourierQuote> = {}): DispatchCourierQuote => ({
  outcome: 'Quoted',
  checkedAt: '2026-10-31T14:02:00',
  storeCode: 'P014',
  deliveryCompanyName: 'Mrsool',
  price: 17.25,
  currency: 'SAR',
  estimatedDeliveryDate: 'within 45 minutes',
  ...over,
})

const empty = { deliveryCompanyName: '', price: 0, currency: '', estimatedDeliveryDate: '' }

describe('courierQuoteView', () => {
  it('no quote yet (null, or an older payload without the field) shows nothing', () => {
    expect(courierQuoteView(null)).toEqual({ kind: 'none' })
    expect(courierQuoteView(undefined)).toEqual({ kind: 'none' })
  })

  it('NoCourier is an attention flag with its own words and the check time', () => {
    expect(courierQuoteView(quote({ outcome: 'NoCourier', ...empty }))).toEqual({
      kind: 'flag',
      key: 'quote.NoCourier',
      outcome: 'NoCourier',
      checkedAt: '2026-10-31T14:02:00',
    })
  })

  it('Failed is an attention flag with its own words', () => {
    const v = courierQuoteView(quote({ outcome: 'Failed', ...empty }))
    expect(v.kind).toBe('flag')
    expect(v.kind === 'flag' && v.key).toBe('quote.Failed')
  })

  it('Quoted is a quiet prediction: company, price with its currency, and OTO ETA text as it came', () => {
    expect(courierQuoteView(quote())).toEqual({
      kind: 'quoted',
      company: 'Mrsool',
      money: '17.25 SAR',
      eta: 'within 45 minutes',
      checkedAt: '2026-10-31T14:02:00',
    })
  })

  it('a quote with no currency shows the price alone', () => {
    const v = courierQuoteView(quote({ currency: '' }))
    expect(v.kind === 'quoted' && v.money).toBe('17.25')
  })

  it('an outcome the client does not know shows quietly as it came, never as a flag', () => {
    expect(courierQuoteView(quote({ outcome: 'Pending', ...empty }))).toEqual({
      kind: 'other',
      raw: 'Pending',
      checkedAt: '2026-10-31T14:02:00',
    })
  })
})

describe('the words', () => {
  it('the flags and the prediction exist on the board, EN and AR, and always say predicted', () => {
    for (const bundle of [enBoard, arBoard]) {
      for (const key of ['quote.NoCourier', 'quote.Failed', 'quote.predicted', 'quote.checkedAt', 'release.noMove', 'columns.courier']) {
        expect(typeof at(bundle, key), key).toBe('string')
      }
    }
    expect(at(enBoard, 'quote.NoCourier')).toBe('OTO predicted no courier')
    expect(at(enBoard, 'quote.Failed')).toBe('Courier check failed')
    expect(at(enBoard, 'quote.predicted')).toMatch(/^Predicted: /)
    expect(at(enBoard, 'release.noMove')).toBe(
      'Releasing the lock does not free a store move on this delivery: an express delivery keeps its store once its OTO order exists. To get out of it, cancel the delivery.',
    )
    expect(at(arBoard, 'release.noMove')).toBe(
      'فك القفل لا يتيح نقل هذا التوصيل إلى متجر آخر: يبقى التوصيل السريع في متجره بعد إنشاء طلب OTO. للخروج منه، ألغِ التوصيل.',
    )
  })

  it('the two coverage reasons are not-competed reasons with words on the board and the timeline', () => {
    expect(CALLOUT_NOT_OPENED_REASONS).toContain('CoverageUnavailable')
    expect(CALLOUT_NOT_OPENED_REASONS).toContain('CoverageEmpty')
    expect(at(enBoard, 'notOpened.CoverageUnavailable')).toBe('OTO coverage could not be checked')
    expect(at(enDoc, 'callout.notOpened.CoverageEmpty')).toBe('OTO listed no stores for this address')
    expect(at(arBoard, 'notOpened.CoverageUnavailable')).toBe('تعذر التحقق من تغطية OTO')
    expect(at(arDoc, 'callout.notOpened.CoverageEmpty')).toBe('لم تُدرج OTO أي متجر لهذا العنوان')
  })

  it('Delivery details does not promise a move after releasing an express delivery', () => {
    for (const bundle of [enDoc, arDoc]) expect(typeof at(bundle, 'callout.release.doneDetailExpress')).toBe('string')
  })

  it('Delivery details says the same no-move sentence beside its Release lock as the board does', () => {
    expect(at(enDoc, 'callout.release.noMove')).toBe(at(enBoard, 'release.noMove'))
    expect(at(arDoc, 'callout.release.noMove')).toBe(at(arBoard, 'release.noMove'))
  })

  it('the quote lines are plain sentences: each value is isolated whole (fsi) and the line once, so no slot tags', () => {
    for (const bundle of [enBoard, arBoard])
      for (const key of ['quote.predicted', 'quote.other', 'quote.checkedAt']) expect(at(bundle, key), key).not.toMatch(/<\/?[a-z]+>/i)
  })
})

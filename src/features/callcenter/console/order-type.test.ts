/**
 * Ticket 1007 (spec 1006 D1, D10, default A): which order types the picker offers, and the
 * one line that says what a switch took off.
 *
 * Expected strings are literals written from the ticket's own example (*"Wasfaty order: 2
 * promotions and coupon SAVE10 were removed"*), never re-derived the way the module derives
 * them. The isolates around machine values are part of the expected text.
 */
import i18next from 'i18next'
import { describe, expect, it } from 'vitest'
import en from '@/locales/en/callcenter.json'
import ar from '@/locales/ar/callcenter.json'
import type { SessionCapabilities, SessionHeader } from '@/core/models/callcenter'
import { ATTACHED_SESSION } from './__fixtures__/payloads'
import { isPrescriptionOrder, offeredOrderTypes, orderTypeNotice, orderTypeOf } from './order-type'

const instance = i18next.createInstance()
instance.init({
  lng: 'en',
  resources: { en: { callcenter: en }, ar: { callcenter: ar } },
  ns: ['callcenter'],
  defaultNS: 'callcenter',
  initAsync: false,
  interpolation: { escapeValue: false },
})
const tEn = instance.getFixedT('en', 'callcenter')
const tAr = instance.getFixedT('ar', 'callcenter')

/** The isolate pair the bidi rule puts around an interpolated machine value. */
const iso = (value: string) => `⁨${value}⁩`

const caps = (orderTypes?: string[]): SessionCapabilities => ({
  ...ATTACHED_SESSION.capabilities,
  ...(orderTypes ? { orderTypes } : {}),
})
const header = (orderType?: string): SessionHeader => ({
  ...ATTACHED_SESSION.header,
  ...(orderType ? { orderType } : {}),
})

describe('offeredOrderTypes', () => {
  it('offers every type the seat may mint, phone order first', () => {
    expect(offeredOrderTypes(caps(['Nphies', 'Ordinary', 'Wasfaty']), header('Ordinary'))).toEqual([
      'Ordinary',
      'Wasfaty',
      'Nphies',
    ])
  })

  it('offers only the types in capabilities.orderTypes', () => {
    expect(offeredOrderTypes(caps(['Ordinary', 'Wasfaty']), header('Ordinary'))).toEqual(['Ordinary', 'Wasfaty'])
  })

  it('is empty (the picker hidden) when only Ordinary is offered', () => {
    expect(offeredOrderTypes(caps(['Ordinary']), header('Ordinary'))).toEqual([])
  })

  it('is empty on a pre-1.15 server, which sends neither field', () => {
    expect(offeredOrderTypes(caps(), header())).toEqual([])
  })

  it('keeps the type the order already has, even when it is no longer offered', () => {
    expect(offeredOrderTypes(caps(['Ordinary']), header('Nphies'))).toEqual(['Ordinary', 'Nphies'])
  })

  it('drops a type this console does not know', () => {
    expect(offeredOrderTypes(caps(['Ordinary', 'P2E']), header('Ordinary'))).toEqual([])
  })
})

describe('orderTypeOf / isPrescriptionOrder', () => {
  it('reads an absent type as the phone order', () => {
    expect(orderTypeOf(header())).toBe('Ordinary')
    expect(isPrescriptionOrder(header())).toBe(false)
  })

  it('a Wasfaty or Nphies order is a prescription order', () => {
    expect(isPrescriptionOrder(header('Wasfaty'))).toBe(true)
    expect(isPrescriptionOrder(header('Nphies'))).toBe(true)
    expect(isPrescriptionOrder(header('Ordinary'))).toBe(false)
  })
})

describe('orderTypeNotice', () => {
  it('says nothing for an empty removed', () => {
    expect(orderTypeNotice(tEn, 'Wasfaty', { coupons: [], promotions: 0 })).toBeNull()
    expect(orderTypeNotice(tEn, 'Wasfaty', null)).toBeNull()
  })

  it('names promotions and the coupon together (the ticket example)', () => {
    expect(orderTypeNotice(tEn, 'Wasfaty', { coupons: ['SAVE10'], promotions: 2 })).toBe(
      `Wasfaty order: ${iso('2')} promotions and coupon ${iso('SAVE10')} were removed.`,
    )
  })

  it('names one promotion alone', () => {
    expect(orderTypeNotice(tEn, 'Nphies', { coupons: [], promotions: 1 })).toBe(
      `Nphies order: ${iso('1')} promotion was removed.`,
    )
  })

  it('names several coupons alone', () => {
    expect(orderTypeNotice(tEn, 'Wasfaty', { coupons: ['SAVE10', 'RAMADAN'], promotions: 0 })).toBe(
      `Wasfaty order: coupons ${iso('SAVE10')}, ${iso('RAMADAN')} were removed.`,
    )
  })

  it('in Arabic: promotions and the coupon together', () => {
    expect(orderTypeNotice(tAr, 'Wasfaty', { coupons: ['SAVE10'], promotions: 2 })).toBe(
      `طلب وصفتي: تمت إزالة عرضين والقسيمة ${iso('SAVE10')}.`,
    )
  })

  it('in Arabic: promotions alone', () => {
    expect(orderTypeNotice(tAr, 'Nphies', { coupons: [], promotions: 3 })).toBe(
      `طلب نفيس: تمت إزالة ${iso('3')} عروض.`,
    )
  })

  it('in Arabic: coupons alone', () => {
    expect(orderTypeNotice(tAr, 'Wasfaty', { coupons: ['SAVE10', 'RAMADAN'], promotions: 0 })).toBe(
      `طلب وصفتي: تمت إزالة القسيمتين ${iso('SAVE10')}، ${iso('RAMADAN')}.`,
    )
  })

  it('in Arabic: says nothing for an empty removed', () => {
    expect(orderTypeNotice(tAr, 'Nphies', { coupons: [], promotions: 0 })).toBeNull()
  })
})

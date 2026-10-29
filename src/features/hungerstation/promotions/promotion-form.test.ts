/**
 * Ticket 666 — the strikethrough editor's form, and the save body it becomes.
 */
import { describe, expect, it } from 'vitest'
import { emptyForm, formFromDetail, formProblems, saveBody, toggleStore } from './promotion-form'
import type { HungerStationPromotionDetail } from '@/core/models/hungerstation'

const NOW = new Date('2026-10-29T08:00:00Z')
const filled = () => ({
  ...emptyForm(NOW),
  chainKey: 'OlaCare',
  name: 'Ramadan',
  displayNameEn: 'Up to 20% off',
  displayNameAr: 'خصم حتى ٢٠٪',
  window: { startDate: '2026-11-01', startTime: '00:00', endDate: '2026-11-30', endTime: '23:59' },
  defaultValue: '20',
})

describe('emptyForm', () => {
  it('Competitiveness by default, Percentage off, every store, the window from now', () => {
    const f = emptyForm(NOW)
    expect([f.hsReason, f.defaultSubtype, f.stores, f.window.startTime, f.window.endTime]).toEqual(['COMPETITIVENESS', 'PERCENTAGE', 'all', '11:00', '23:59'])
  })
})

describe('saveBody', () => {
  it('carries every field of the contract, the window as typed, limits as numbers, blank as null', () => {
    const f = {
      ...filled(),
      orderLimit: '2',
      globalLimit: '',
      items: [{ materialNumber: '101001', subtype: null, value: null, maxQuantity: 3, buyQuantity: null, getQuantity: null }],
    }
    expect(saveBody(f, ' Ramadan launch ')).toEqual({
      chainKey: 'OlaCare',
      name: 'Ramadan',
      displayNameEn: 'Up to 20% off',
      displayNameAr: 'خصم حتى ٢٠٪',
      type: 'STRIKETHROUGH',
      hsReason: 'COMPETITIVENESS',
      startAt: '2026-11-01T00:00:00',
      endAt: '2026-11-30T23:59:00',
      orderLimit: 2,
      globalLimit: null,
      defaultSubtype: 'PERCENTAGE',
      defaultValue: 20,
      defaultBuyQuantity: null,
      defaultGetQuantity: null,
      allStores: true,
      storeCodes: [],
      items: [{ materialNumber: '101001', subtype: null, value: null, maxQuantity: 3, buyQuantity: null, getQuantity: null }],
      reason: 'Ramadan launch',
    })
  })

  it('a narrowed store list is sent by code, not as all', () => {
    const body = saveBody({ ...filled(), stores: ['1001', '2001'] }, 'r')
    expect([body.allStores, body.storeCodes]).toEqual([false, ['1001', '2001']])
  })
})

describe('toggleStore', () => {
  const choices = ['1001', '1002', '2001']
  it('unticking from all leaves the others', () => {
    expect(toggleStore('all', '1002', choices)).toEqual(['1001', '2001'])
  })
  it('ticking the last one back is all again', () => {
    expect(toggleStore(['1001', '2001'], '1002', choices)).toBe('all')
  })
})

describe('formProblems', () => {
  it('a filled form has none', () => {
    expect(formProblems(filled(), NOW)).toEqual([])
  })
  it('names the empty and the unreadable fields', () => {
    const f = { ...filled(), name: ' ', displayNameAr: '', orderLimit: '0', globalLimit: '1.5', defaultValue: 'x', stores: [] as string[] }
    expect(formProblems(f, NOW)).toEqual(['name', 'displayNameAr', 'orderLimit', 'globalLimit', 'defaultValue', 'stores'])
  })
  it('a window ending before it starts is a problem', () => {
    const f = { ...filled(), window: { ...filled().window, endDate: '2026-10-31' } }
    expect(formProblems(f, NOW)).toEqual(['window'])
  })
  it('more than 20,000 items is a problem', () => {
    const item = (i: number) => ({ materialNumber: String(i), subtype: null, value: null, maxQuantity: null, buyQuantity: null, getQuantity: null })
    expect(formProblems({ ...filled(), items: Array.from({ length: 20001 }, (_, i) => item(i)) }, NOW)).toEqual(['items'])
  })
})

describe('formFromDetail', () => {
  it('a saved draft reads back into the form, its active items only', () => {
    const d = {
      chainKey: 'OlaCare',
      name: 'Winter',
      displayNameEn: 'en',
      displayNameAr: 'ar',
      hsReason: 'OVERSTOCK',
      startAt: '2026-11-01T09:30:00',
      endAt: '2026-11-30T23:59:00',
      orderLimit: 2,
      globalLimit: null,
      defaultSubtype: 'ABSOLUTE',
      defaultValue: 5.5,
      allStores: false,
      stores: [{ storeCode: '1001', storeName: '', vendorId: 'v' }],
      items: [
        { itemId: 'a', materialNumber: '101001', sku: null, subtype: 'ABSOLUTE', value: 5.5, maxQuantity: null, buyQuantity: null, getQuantity: null, partId: null, active: true },
        { itemId: 'b', materialNumber: '101002', sku: null, subtype: 'ABSOLUTE', value: 5.5, maxQuantity: null, buyQuantity: null, getQuantity: null, partId: null, active: false },
      ],
    } as unknown as HungerStationPromotionDetail
    const f = formFromDetail(d)
    expect([f.name, f.hsReason, f.orderLimit, f.globalLimit, f.defaultValue, f.stores, f.window.startTime]).toEqual(['Winter', 'OVERSTOCK', '2', '', '5.5', ['1001'], '09:30'])
    expect(f.items.map((i) => i.materialNumber)).toEqual(['101001'])
  })
})

// Ticket 668 — the same-item bundle: its type, its default buy / get, its rows' own buy / get.
describe('the same-item bundle (668)', () => {
  const bundle = () => ({
    ...filled(),
    type: 'SAME_ITEM_BUNDLE' as const,
    defaultBuy: '2',
    defaultGet: '1',
    defaultValue: '50',
    items: [
      { materialNumber: '201001', buyQuantity: null, getQuantity: null, subtype: null, value: null, maxQuantity: null },
      { materialNumber: '201009', buyQuantity: 1, getQuantity: 1, subtype: 'PERCENTAGE' as const, value: 100, maxQuantity: 2 },
    ],
  })

  it('a new form is a strikethrough with no default buy / get', () => {
    const f = emptyForm(NOW)
    expect([f.type, f.defaultBuy, f.defaultGet]).toEqual(['STRIKETHROUGH', '', ''])
  })

  it('the body names the type, the default buy / get, and each row as pasted (blank = null)', () => {
    const body = saveBody(bundle(), 'Eid')
    expect([body.type, body.defaultBuyQuantity, body.defaultGetQuantity, body.defaultValue]).toEqual(['SAME_ITEM_BUNDLE', 2, 1, 50])
    expect(body.items).toEqual(bundle().items)
  })

  it('a strikethrough sends no default buy / get, whatever the boxes hold', () => {
    const body = saveBody({ ...bundle(), type: 'STRIKETHROUGH', items: [] }, 'r')
    expect([body.defaultBuyQuantity, body.defaultGetQuantity]).toEqual([null, null])
  })

  it('a default buy or get must be a whole number of at least 1, or blank', () => {
    expect(formProblems(bundle(), NOW)).toEqual([])
    expect(formProblems({ ...bundle(), defaultBuy: '0', defaultGet: '1.5' }, NOW)).toEqual(['defaultBuy', 'defaultGet'])
    expect(formProblems({ ...bundle(), defaultBuy: '', defaultGet: '' }, NOW)).toEqual([])
    // Not a bundle: the boxes are not read.
    expect(formProblems({ ...bundle(), type: 'STRIKETHROUGH', defaultBuy: 'x' }, NOW)).toEqual([])
  })

  it('a saved bundle reads back with its type, default buy / get and each row’s buy / get', () => {
    const d = {
      chainKey: 'OlaCare', name: 'Eid', displayNameEn: 'e', displayNameAr: 'ع', type: 'SAME_ITEM_BUNDLE', hsReason: 'COMPETITIVENESS',
      startAt: '2026-11-01T00:00:00', endAt: '2026-11-30T23:59:00', orderLimit: null, globalLimit: null,
      defaultSubtype: 'PERCENTAGE', defaultValue: 50, defaultBuyQuantity: 2, defaultGetQuantity: 1, allStores: true, stores: [],
      items: [{ itemId: 'i', materialNumber: '201009', sku: null, subtype: 'PERCENTAGE', value: 100, maxQuantity: null, buyQuantity: 1, getQuantity: 1, partId: null, active: true }],
    } as unknown as HungerStationPromotionDetail
    const f = formFromDetail(d)
    expect([f.type, f.defaultBuy, f.defaultGet]).toEqual(['SAME_ITEM_BUNDLE', '2', '1'])
    expect(f.items).toEqual([{ materialNumber: '201009', subtype: 'PERCENTAGE', value: 100, maxQuantity: null, buyQuantity: 1, getQuantity: 1 }])
  })
})

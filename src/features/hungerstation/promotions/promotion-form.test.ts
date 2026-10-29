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

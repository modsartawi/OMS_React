/**
 * Ticket 666 / 668 (reconciled to the BackOffice 3201 door contract, 2026-10-29) — the editor's
 * form, and the save body it becomes: `storeCodes: null` is ALL stores (there is no `allStores`
 * key, and `[]` is no store); there is no promotion-level buy / get default.
 */
import { describe, expect, it } from 'vitest'
import { emptyForm, formFromDetail, formProblems, saveBody, toggleStore } from './promotion-form'
import type { HungerStationPromotionDetail, HungerStationPromotionItem } from '@/core/models/hungerstation'

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

const row = (over: Partial<HungerStationPromotionItem>): HungerStationPromotionItem => ({
  rowNo: 1,
  materialNumber: '101001',
  sku: null,
  subtype: null,
  value: null,
  maxQuantity: null,
  buyQuantity: null,
  getQuantity: null,
  partId: null,
  active: true,
  ...over,
})
const saved = (over: Partial<HungerStationPromotionDetail> = {}) =>
  ({
    chainKey: 'OlaCare',
    name: 'Winter',
    displayNameEn: 'en',
    displayNameAr: 'ar',
    type: 'STRIKETHROUGH',
    hsReason: 'OVERSTOCK',
    startAt: '2026-11-01T09:30:00',
    endAt: '2026-11-30T23:59:00',
    orderLimit: 2,
    globalLimit: null,
    defaultSubtype: 'ABSOLUTE',
    defaultValue: 5.5,
    allStores: false,
    status: 'draft',
    stores: [{ storeCode: '1001', storeName: '', vendorId: 'v', syncActive: true }],
    items: [row({ materialNumber: '101001' }), row({ rowNo: 2, materialNumber: '101002', active: false })],
    ...over,
  }) as unknown as HungerStationPromotionDetail

describe('emptyForm', () => {
  it('Competitiveness by default, Percentage off, every store, the window from now', () => {
    const f = emptyForm(NOW)
    expect([f.type, f.hsReason, f.defaultSubtype, f.stores, f.window.startTime, f.window.endTime]).toEqual(['STRIKETHROUGH', 'COMPETITIVENESS', 'PERCENTAGE', 'all', '11:00', '23:59'])
  })
})

describe('saveBody', () => {
  it('carries exactly the contract’s fields: the window as typed, limits as numbers, blank as null, all stores as storeCodes null', () => {
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
      storeCodes: null,
      items: [{ materialNumber: '101001', subtype: null, value: null, maxQuantity: 3, buyQuantity: null, getQuantity: null }],
      reason: 'Ramadan launch',
    })
  })

  it('a narrowed store list is sent by code', () => {
    expect(saveBody({ ...filled(), stores: ['1001', '2001'] }, 'r').storeCodes).toEqual(['1001', '2001'])
  })

  it('a strikethrough row carries no buy / get, whatever it was pasted as before a type change', () => {
    const f = { ...filled(), items: [{ materialNumber: '1', subtype: null, value: null, maxQuantity: null, buyQuantity: 2, getQuantity: 1 }] }
    expect(saveBody(f, 'r').items[0]).toMatchObject({ buyQuantity: null, getQuantity: null })
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
    const f = formFromDetail(saved())
    expect([f.name, f.hsReason, f.orderLimit, f.globalLimit, f.defaultValue, f.stores, f.window.startTime]).toEqual(['Winter', 'OVERSTOCK', '2', '', '5.5', ['1001'], '09:30'])
    expect(f.items.map((i) => i.materialNumber)).toEqual(['101001'])
  })

  // Review B4: reopening a draft must not bake the resolved default into a blank row — a later
  // change of the default would then miss it. The contract keeps a row's subtype / value as entered.
  it('a blank row stays blank (null), so it keeps following the default', () => {
    const f = formFromDetail(saved({ items: [row({ subtype: null, value: null }), row({ rowNo: 2, materialNumber: '2', subtype: 'PERCENTAGE', value: 30 })] }))
    expect(f.items.map((i) => [i.subtype, i.value])).toEqual([
      [null, null],
      ['PERCENTAGE', 30],
    ])
    expect(saveBody(f, 'r').items[0]).toMatchObject({ subtype: null, value: null })
  })

  // Review B5: an in-place edit of an "all stores" promotion sends storeCodes null — the stores
  // frozen at send (3215) — never a list of the chain's stores now.
  it('a sent "all stores" promotion reads back as all, and saves as storeCodes null', () => {
    const f = formFromDetail(saved({ status: 'live', allStores: true, stores: [{ storeCode: '1001', storeName: '', vendorId: 'v', syncActive: true }] }))
    expect(f.stores).toBe('all')
    expect(saveBody(f, 'r').storeCodes).toBeNull()
  })

  it('a draft with no window yet reads as blank boxes', () => {
    expect(formFromDetail(saved({ startAt: null, endAt: null })).window).toEqual({ startDate: '', startTime: '', endDate: '', endTime: '' })
  })

  it('a default value of 0 (none set) reads blank', () => {
    expect(formFromDetail(saved({ defaultValue: 0 })).defaultValue).toBe('')
  })
})

// Ticket 668 — the same-item bundle: each row carries its own buy / get (no header default).
describe('the same-item bundle (668)', () => {
  const bundle = () => ({
    ...filled(),
    type: 'SAME_ITEM_BUNDLE' as const,
    defaultValue: '50',
    items: [
      { materialNumber: '201001', buyQuantity: null, getQuantity: null, subtype: null, value: null, maxQuantity: null },
      { materialNumber: '201009', buyQuantity: 1, getQuantity: 1, subtype: 'PERCENTAGE' as const, value: 100, maxQuantity: 2 },
    ],
  })

  it('the body names the type and each row as pasted (blank = null): the checks report a blank buy / get', () => {
    const body = saveBody(bundle(), 'Eid')
    expect([body.type, body.defaultValue]).toEqual(['SAME_ITEM_BUNDLE', 50])
    expect(body.items).toEqual(bundle().items)
    expect(Object.keys(body)).not.toContain('defaultBuyQuantity')
  })

  it('a saved bundle reads back with its type and each row’s buy / get', () => {
    const f = formFromDetail(saved({ type: 'SAME_ITEM_BUNDLE', items: [row({ materialNumber: '201009', subtype: 'PERCENTAGE', value: 100, buyQuantity: 1, getQuantity: 1 })] }))
    expect(f.type).toBe('SAME_ITEM_BUNDLE')
    expect(f.items).toEqual([{ materialNumber: '201009', subtype: 'PERCENTAGE', value: 100, maxQuantity: null, buyQuantity: 1, getQuantity: 1 }])
  })
})

/**
 * Ticket 669 — what HungerStation refused in a part's answer (BackOffice spec 3201 / 3214), grouped
 * per store and counted; a part with nothing refused (or no final answer yet) has no section. And
 * when a part reads as Sending, so Resend waits and the detail re-reads itself.
 */
import { describe, expect, it } from 'vitest'
import type { HungerStationPromotionPart, HungerStationPromotionRefusals } from '@/core/models/hungerstation'
import { partSending, PROMOTION_POLL_MS, promotionPollInterval, refusalsByStore, refusalsCopyText, refusalsForStore } from './part-refusals'

const REFUSALS: HungerStationPromotionRefusals = {
  invalidVendors: [
    { storeCode: '2001', vendorId: 'hs-77821' },
    { storeCode: null, vendorId: 'hs-00009' },
  ],
  missingSkus: [
    { storeCode: '1002', vendorId: 'v-1002', skus: [{ sku: 'SKU-201002', materialNumber: '201002' }] },
    {
      storeCode: '1001',
      vendorId: 'v-1001',
      skus: [
        { sku: 'SKU-201001', materialNumber: '201001' },
        { sku: 'HS-ORPHAN', materialNumber: null },
      ],
    },
  ],
  invalidDiscountedSkus: [{ storeCode: '1001', vendorId: 'v-1001', skus: [{ sku: 'SKU-201002', materialNumber: '201002' }] }],
}

describe('refusalsByStore', () => {
  it('groups the three lists per store, ordered by store code, an unresolved vendor last', () => {
    const g = refusalsByStore(REFUSALS)
    expect(g?.stores.map((s) => [s.key, s.storeCode, s.vendorId, s.invalidVendor, s.missing.length, s.overList.length])).toEqual([
      ['1001', '1001', 'v-1001', false, 2, 1],
      ['1002', '1002', 'v-1002', false, 1, 0],
      ['2001', '2001', 'hs-77821', true, 0, 0],
      ['vendor:hs-00009', null, 'hs-00009', true, 0, 0],
    ])
  })

  it('counts each list (SKUs one by one) and the stores touched', () => {
    expect(refusalsByStore(REFUSALS)?.counts).toEqual({ invalidVendors: 2, missingSkus: 3, invalidDiscountedSkus: 1, stores: 4 })
  })

  it('has no section when HungerStation refused nothing, or has not answered finally yet', () => {
    expect(refusalsByStore({ invalidVendors: [], missingSkus: [], invalidDiscountedSkus: [] })).toBeNull()
    expect(refusalsByStore({ invalidVendors: [], missingSkus: [{ storeCode: '1001', vendorId: 'v-1001', skus: [] }], invalidDiscountedSkus: [] })).toBeNull()
    expect(refusalsByStore(null)).toBeNull()
  })

  it('a store listed twice in one list is one store', () => {
    const g = refusalsByStore({
      invalidVendors: [],
      missingSkus: [
        { storeCode: '1001', vendorId: 'v-1001', skus: [{ sku: 'A', materialNumber: '1' }] },
        { storeCode: '1001', vendorId: 'v-1001', skus: [{ sku: 'B', materialNumber: '2' }] },
      ],
      invalidDiscountedSkus: [],
    })
    expect(g?.stores.map((s) => [s.key, s.missing.map((k) => k.sku)])).toEqual([['1001', ['A', 'B']]])
    expect(g?.counts).toEqual({ invalidVendors: 0, missingSkus: 2, invalidDiscountedSkus: 0, stores: 1 })
  })
})

describe('refusalsForStore + refusalsCopyText', () => {
  const g = refusalsByStore(REFUSALS)!

  it('every store when no store is chosen; only that store when one is', () => {
    expect(refusalsForStore(g, null).map((s) => s.key)).toEqual(['1001', '1002', '2001', 'vendor:hs-00009'])
    expect(refusalsForStore(g, '1001').map((s) => s.key)).toEqual(['1001'])
    expect(refusalsForStore(g, 'nope')).toEqual([])
  })

  it('copies a list as tab-separated lines: store, vendor id (and material, SKU) — a blank for an unresolved one', () => {
    const all = refusalsForStore(g, null)
    expect(refusalsCopyText(all, 'invalidVendors')).toBe('2001\ths-77821\n\ths-00009')
    expect(refusalsCopyText(all, 'missingSkus')).toBe('1001\tv-1001\t201001\tSKU-201001\n1001\tv-1001\t\tHS-ORPHAN\n1002\tv-1002\t201002\tSKU-201002')
    expect(refusalsCopyText(refusalsForStore(g, '1001'), 'invalidDiscountedSkus')).toBe('1001\tv-1001\t201002\tSKU-201002')
  })
})

const part = (over: Partial<HungerStationPromotionPart>): HungerStationPromotionPart => ({
  partId: 'pt',
  name: 'n',
  active: true,
  skuCount: 1,
  latestJobStatus: 'COMPLETED',
  unanswered: false,
  refusals: null,
  buyQuantity: null,
  getQuantity: null,
  subtype: null,
  value: null,
  ...over,
})

describe('partSending + promotionPollInterval', () => {
  it('a part is Sending while its latest job is QUEUED and not yet past 24 hours', () => {
    expect(partSending(part({ latestJobStatus: 'QUEUED' }))).toBe(true)
    expect(partSending(part({ latestJobStatus: 'QUEUED', unanswered: true }))).toBe(false)
    expect(partSending(part({ latestJobStatus: 'COMPLETED' }))).toBe(false)
    expect(partSending(part({ latestJobStatus: null }))).toBe(false)
  })

  it('the detail re-reads every 15 s while any part is Sending, and not otherwise', () => {
    expect(PROMOTION_POLL_MS).toBe(15000)
    expect(promotionPollInterval({ parts: [part({}), part({ latestJobStatus: 'QUEUED' })] })).toBe(15000)
    expect(promotionPollInterval({ parts: [part({}), part({ latestJobStatus: 'QUEUED', unanswered: true })] })).toBe(false)
    expect(promotionPollInterval(undefined)).toBe(false)
  })
})

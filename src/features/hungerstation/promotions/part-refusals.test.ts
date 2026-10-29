/**
 * Ticket 669 (reconciled to the BackOffice 3201 door contract, 2026-10-29) — what HungerStation refused in a part's answer (BackOffice spec 3201 / 3214), grouped
 * per store and counted; a part with nothing refused (or no final answer yet) has no section. And
 * when a part reads as Sending, so Resend waits and the detail re-reads itself.
 */
import { describe, expect, it } from 'vitest'
import type { HungerStationPromotionPart, HungerStationPromotionRefusals, HungerStationPromotionSend } from '@/core/models/hungerstation'
import { partSending, partUnanswered, PROMOTION_POLL_MS, promotionPollInterval, refusalsByStore, refusalsCopyText, refusalsForStore, sendUnanswered } from './part-refusals'

const REFUSALS: HungerStationPromotionRefusals = {
  invalidVendors: [
    { storeCode: '2001', vendorId: 'hs-77821' },
    { storeCode: null, vendorId: 'hs-00009' },
  ],
  missingSkus: [
    { storeCode: '1002', vendorId: 'v-1002', items: [{ sku: 'SKU-201002', materialNumber: '201002' }] },
    {
      storeCode: '1001',
      vendorId: 'v-1001',
      items: [
        { sku: 'SKU-201001', materialNumber: '201001' },
        { sku: 'HS-ORPHAN', materialNumber: null },
      ],
    },
  ],
  invalidDiscountedSkus: [{ storeCode: '1001', vendorId: 'v-1001', items: [{ sku: 'SKU-201002', materialNumber: '201002' }] }],
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
    expect(refusalsByStore({ invalidVendors: [], missingSkus: [{ storeCode: '1001', vendorId: 'v-1001', items: [] }], invalidDiscountedSkus: [] })).toBeNull()
    expect(refusalsByStore(null)).toBeNull()
  })

  it('a store listed twice in one list is one store', () => {
    const g = refusalsByStore({
      invalidVendors: [],
      missingSkus: [
        { storeCode: '1001', vendorId: 'v-1001', items: [{ sku: 'A', materialNumber: '1' }] },
        { storeCode: '1001', vendorId: 'v-1001', items: [{ sku: 'B', materialNumber: '2' }] },
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
  partNo: 1,
  name: 'n',
  combination: 'ALL',
  active: true,
  status: 'live',
  refusals: null,
  ...over,
})
const send = (partId: string, jobStatus: string | null, error: string | null = null) =>
  ({ sendId: `s-${partId}-${jobStatus}`, partId, jobStatus, error }) as HungerStationPromotionSend

describe('a SKU refusal that names no vendor (a plain SKU list) — contract 3214', () => {
  it('is one "unresolved" store, after every store', () => {
    const g = refusalsByStore({ invalidVendors: [], missingSkus: [{ storeCode: null, vendorId: null, items: [{ sku: 'X', materialNumber: '1' }] }, { storeCode: '1001', vendorId: 'v', items: [{ sku: 'Y', materialNumber: '2' }] }], invalidDiscountedSkus: [] })
    expect(g?.stores.map((s) => [s.key, s.storeCode, s.vendorId])).toEqual([
      ['1001', '1001', 'v'],
      ['unresolved', null, null],
    ])
    expect(refusalsCopyText(g!.stores, 'missingSkus')).toBe('1001\tv\t2\tY\n\t\t1\tX')
  })
})

describe('partSending + promotionPollInterval (reconciled to the contract: the part and promotion STATUS)', () => {
  it('a part is Sending exactly when it reads sending', () => {
    expect(partSending(part({ status: 'sending' }))).toBe(true)
    // Unanswered for 24 hours: the server reads it Failed (so it can be resent).
    expect(partSending(part({ status: 'failed' }))).toBe(false)
    expect(partSending(part({ status: 'live' }))).toBe(false)
    expect(partSending(part({ status: null }))).toBe(false)
  })

  it('the detail re-reads every 15 s while any part is Sending, and not otherwise', () => {
    expect(PROMOTION_POLL_MS).toBe(15000)
    expect(promotionPollInterval({ status: 'live', parts: [part({}), part({ status: 'sending' })] })).toBe(15000)
    expect(promotionPollInterval({ status: 'failed', parts: [part({ status: 'failed' })] })).toBe(false)
    expect(promotionPollInterval(undefined)).toBe(false)
  })

  // Review B3: a promotion reading Sending with no part that does (a job IN_PROGRESS, a switch-off
  // still open, a roll-up ahead of its parts) locked every write and was never re-read.
  it('a promotion that reads Sending is re-read, whatever its parts say', () => {
    expect(promotionPollInterval({ status: 'sending', parts: [part({ status: 'live' })] })).toBe(15000)
    expect(promotionPollInterval({ status: 'sending', parts: [] })).toBe(15000)
  })
})

describe('partUnanswered — the 24-hour part (contract 3214: it reads Failed, its job still QUEUED)', () => {
  const detail = (status: HungerStationPromotionPart['status'], sends: HungerStationPromotionSend[]) => ({ parts: [part({ partId: 'a', status })], sends })

  it('a failed part whose LATEST send is still QUEUED is unanswered', () => {
    expect(partUnanswered(detail('failed', [send('a', 'COMPLETED'), send('a', 'QUEUED')]), 'a')).toBe(true)
  })

  it('a refused part (latest FAILED), a Sending one (still polled), or an older QUEUED send is not', () => {
    expect(partUnanswered(detail('failed', [send('a', 'QUEUED'), send('a', 'FAILED')]), 'a')).toBe(false)
    expect(partUnanswered(detail('sending', [send('a', 'QUEUED')]), 'a')).toBe(false)
    expect(partUnanswered(detail('failed', []), 'a')).toBe(false)
  })

  it('sendUnanswered marks only that latest send', () => {
    const sends = [send('a', 'QUEUED'), send('a', 'QUEUED', 'HungerStation has not answered this job in 24 hours')]
    const d = detail('failed', sends)
    expect(sends.map((s) => sendUnanswered(d, s))).toEqual([false, true])
  })
})

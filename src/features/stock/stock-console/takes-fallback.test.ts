/**
 * BackOffice 4277 (spec 4275 "What head office sees", ADR 0146): the Takes list's fallback column and filter. A take the
 * expiry fallback placed says so with the pack's vendor batch and the batch chosen; a refusal in a `Record` store says
 * which batch the fallback would have chosen; a refusal whose dates disagree says why. Filtering on it asks
 * `fallback=true`, and failed calls are then left out.
 */
import { describe, expect, it } from 'vitest'
import type { StockConsoleTakeRow } from '@/core/models/stock-console'
import { searchFromParams, wireParams } from './search'
import { TAKES_LIST, failedNotSearchable, fallbackNoteWord, fallbackOnly, takeFallback, takeFallbackValue } from './takes'

const state = (qs: string) => searchFromParams(new URLSearchParams(qs), TAKES_LIST)

const take = (over: Partial<StockConsoleTakeRow>): StockConsoleTakeRow => ({
  kind: '',
  at: '2026-11-25T09:00:00',
  takeId: null,
  item: null,
  nameEn: '',
  nameAr: '',
  code: null,
  stage: null,
  available: null,
  quantity: null,
  scannedVendorBatch: null,
  scannedExpiry: null,
  enteredBatch: null,
  batches: null,
  batch: null,
  batchWithStock: null,
  reason: null,
  asked: null,
  shadow: null,
  durationMs: null,
  statusCode: null,
  instance: null,
  ...over,
})

describe('the fallback cell', () => {
  it('a take the fallback placed shows the mark, the pack’s vendor batch and only the batches the fallback chose', () => {
    const row = take({
      kind: 'granted',
      item: '1001',
      quantity: 3,
      scannedVendorBatch: 'LOT77',
      isExpiryFallback: true,
      batches: [
        { batch: '0000123456', quantity: 1, state: 'Held', isExpiryFallback: false },
        { batch: '0000123999', quantity: 2, state: 'Held', isExpiryFallback: true },
      ],
    })
    expect(takeFallback(row)).toEqual({
      key: 'takes.fallback.placed',
      sev: 'warn',
      vendorBatch: 'LOT77',
      batches: ['0000123999 · 2'],
      note: null,
    })
  })

  it('a refusal in a Record store names the batch the fallback would have chosen, with its quantity', () => {
    const row = take({
      kind: 'refused',
      isExpiryFallback: false,
      scannedVendorBatch: 'LOT88',
      fallbackBatch: '0000777001',
      fallbackQuantity: 2,
    })
    expect(takeFallback(row)).toEqual({
      key: 'takes.fallback.wouldBe',
      sev: 'mute',
      vendorBatch: 'LOT88',
      batches: ['0000777001 · 2'],
      note: null,
    })
  })

  it('a refusal the fallback could not run on says why', () => {
    const row = take({ kind: 'refused', scannedVendorBatch: 'LOT88', fallbackNote: 'ScannedDateDisagrees' })
    expect(takeFallback(row)).toEqual({
      key: 'takes.fallback.note',
      sev: 'bad',
      vendorBatch: 'LOT88',
      batches: [],
      note: 'ScannedDateDisagrees',
    })
  })

  it('a take the fallback never touched, a failed call, and a row from an older server have none', () => {
    expect(takeFallback(take({ kind: 'granted', isExpiryFallback: false, scannedVendorBatch: 'LOT1' }))).toBeNull()
    expect(takeFallback(take({ kind: 'granted', scannedVendorBatch: 'LOT1' }))).toBeNull()
    expect(takeFallback(take({ kind: 'refused', isExpiryFallback: false }))).toBeNull()
    expect(takeFallback(take({ kind: 'failed', isExpiryFallback: null }))).toBeNull()
  })
})

describe('the fallback note', () => {
  it('a known note is said in the console’s words; an unknown one as it came', () => {
    expect(fallbackNoteWord('ScannedDateDisagrees')).toEqual({ key: 'takes.fallbackNote.ScannedDateDisagrees' })
    expect(fallbackNoteWord('SomethingNew')).toEqual({ raw: 'SomethingNew' })
  })
})

describe('the fallback cell’s value (sort, filter, copy and export; review O6)', () => {
  const t = (key: string) => `<${key}>`

  it('is the mark, the batches and the note, the note in the console’s words when known, else as it came', () => {
    expect(takeFallbackValue(take({ kind: 'refused', fallbackNote: 'ScannedDateDisagrees' }), t)).toBe(
      '<takes.fallback.note> <takes.fallbackNote.ScannedDateDisagrees>',
    )
    expect(
      takeFallbackValue(take({ kind: 'refused', fallbackBatch: 'FB1', fallbackQuantity: 2, fallbackNote: 'SomethingNew' }), t),
    ).toBe('<takes.fallback.wouldBe> FB1 · 2 SomethingNew')
    expect(takeFallbackValue(take({ kind: 'refused', fallbackBatch: 'FB1', fallbackQuantity: 2 }), t)).toBe(
      '<takes.fallback.wouldBe> FB1 · 2',
    )
    expect(takeFallbackValue(take({ kind: 'failed' }), t)).toBe('')
  })
})

describe('the fallback filter', () => {
  it('is off by default and sends nothing; on, it goes to the wire as fallback=true', () => {
    expect(fallbackOnly(state('ran=1'))).toBe(false)
    expect(wireParams(state('ran=1'))).not.toHaveProperty('fallback')
    expect(fallbackOnly(state('ran=1&fallback=true'))).toBe(true)
    expect(wireParams(state('ran=1&fallback=true'))).toMatchObject({ fallback: 'true' })
  })

  it('says failed calls are left out while it is on, as Stock Visibility leaves them out', () => {
    expect(failedNotSearchable(state('ran=1&fallback=true'), undefined)).toBe(true)
    expect(failedNotSearchable(state('ran=1'), undefined)).toBe(false)
  })
})

import { describe, expect, it } from 'vitest'
import type { StockConsoleBatchRow } from '@/core/models/stock-console'
import { batchMarks, expiryCell } from './batches'

const TODAY = '2026-11-22'

const batch = (over: Partial<StockConsoleBatchRow> = {}): StockConsoleBatchRow => ({
  item: '1001',
  nameEn: 'Panadol 500',
  nameAr: 'بنادول ٥٠٠',
  batch: 'B1',
  vendorBatch: 'L77',
  expiry: '2027-06-30',
  sapStock: 10,
  tillStock: 9,
  held: 2,
  freeForTheDoor: 7,
  firstReceivedOn: '2026-01-05',
  placeholder: false,
  ...over,
})

describe('a batch row’s expiry cell', () => {
  it('a day before today is expired', () => {
    expect(expiryCell('2026-11-21', TODAY)).toEqual({ day: '2026-11-21', mark: 'expired' })
  })

  it('today and the next 90 days expire within 90 days', () => {
    expect(expiryCell('2026-11-22', TODAY).mark).toBe('within90')
    expect(expiryCell('2027-02-20', TODAY).mark).toBe('within90')
  })

  it('the 91st day on is not marked', () => {
    expect(expiryCell('2027-02-21', TODAY)).toEqual({ day: '2027-02-21', mark: 'ok' })
  })

  it('a time on the day is read as the day', () => {
    expect(expiryCell('2026-11-01T00:00:00', TODAY)).toEqual({ day: '2026-11-01', mark: 'expired' })
  })

  it('no expiry, or one that is not a day, has no mark and no day', () => {
    expect(expiryCell(null, TODAY)).toEqual({ day: null, mark: 'none' })
    expect(expiryCell('', TODAY)).toEqual({ day: null, mark: 'none' })
    expect(expiryCell('soon', TODAY)).toEqual({ day: null, mark: 'none' })
  })
})

describe('a batch row’s marks', () => {
  it('a placeholder batch is marked, as Stock Visibility’s own rule says', () => {
    expect(batchMarks(batch({ placeholder: true }), TODAY).placeholder).toBe(true)
    expect(batchMarks(batch(), TODAY).placeholder).toBe(false)
  })

  it('carries its expiry cell', () => {
    expect(batchMarks(batch({ expiry: '2026-12-01' }), TODAY).expiry).toEqual({ day: '2026-12-01', mark: 'within90' })
  })
})

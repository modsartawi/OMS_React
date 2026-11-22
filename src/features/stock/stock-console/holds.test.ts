import { describe, expect, it } from 'vitest'
import type { StockConsoleHoldRow } from '@/core/models/stock-console'
import { holdAge, holdColumns, holdDocument, holdStateCell } from './holds'

const hold = (over: Partial<StockConsoleHoldRow> = {}): StockConsoleHoldRow => ({
  takeId: 'T1',
  item: '1001',
  nameEn: 'Panadol',
  nameAr: 'بانادول',
  batch: 'B12',
  quantity: 2,
  takenAt: '2026-11-19T06:00:00',
  state: 'Held',
  source: 'Picking',
  documentNo: null,
  lineNumber: null,
  soldStore: null,
  soldTrx: null,
  updatedAt: null,
  releasedAt: null,
  releaseReason: null,
  ...over,
})

/** The reader's clock: local wall time, as the server's times are. */
const at = (local: string) => new Date(local).getTime()

describe('a hold’s age', () => {
  it('is days and hours once a day old', () => {
    expect(holdAge(hold({ takenAt: '2026-11-19T06:00:00' }), at('2026-11-22T10:30:00'))).toEqual({
      key: 'age.days',
      values: { d: 3, h: 4 },
    })
  })

  it('is hours and minutes under a day, minutes under an hour, and "just now" under a minute', () => {
    expect(holdAge(hold({ takenAt: '2026-11-22T07:05:00' }), at('2026-11-22T10:30:00'))).toEqual({
      key: 'age.hours',
      values: { h: 3, m: 25 },
    })
    expect(holdAge(hold({ takenAt: '2026-11-22T10:01:00' }), at('2026-11-22T10:30:00'))).toEqual({
      key: 'age.minutes',
      values: { m: 29 },
    })
    expect(holdAge(hold({ takenAt: '2026-11-22T10:29:30' }), at('2026-11-22T10:30:00'))).toEqual({ key: 'age.justNow', values: {} })
  })

  it('a time ahead of the reader’s clock reads "just now", never a negative age', () => {
    expect(holdAge(hold({ takenAt: '2026-11-22T11:00:00' }), at('2026-11-22T10:30:00'))).toEqual({ key: 'age.justNow', values: {} })
  })

  it('a released hold’s age is how long it was held, not how long ago it was taken', () => {
    const released = hold({ state: 'Released', takenAt: '2026-11-20T08:00:00', releasedAt: '2026-11-20T10:15:00' })
    expect(holdAge(released, at('2026-11-22T10:30:00'))).toEqual({ key: 'age.hours', values: { h: 2, m: 15 } })
  })

  it('a time that does not read has no age', () => {
    expect(holdAge(hold({ takenAt: 'yesterday' }), at('2026-11-22T10:30:00'))).toBeNull()
  })
})

describe('a hold’s state cell', () => {
  it('Held is standing, Sold is sold not applied, Released is released — each in its own words', () => {
    expect(holdStateCell('Held')).toEqual({ key: 'holds.state.Held', sev: 'go' })
    expect(holdStateCell('Sold')).toEqual({ key: 'holds.state.Sold', sev: 'warn' })
    expect(holdStateCell('Released')).toEqual({ key: 'holds.state.Released', sev: 'mute' })
  })

  it('a state the console does not know is drawn as it came, as a Watch', () => {
    expect(holdStateCell('Frozen')).toEqual({ raw: 'Frozen', sev: 'warn' })
  })
})

describe('a hold’s picking document or till sale', () => {
  it('a picking hold shows its document and line, as one value', () => {
    expect(holdDocument(hold({ documentNo: '4500012', lineNumber: 3 }))).toEqual({
      key: 'holds.document.picking',
      text: '4500012 · 3',
    })
  })

  it('a till sale shows its store and transaction, as one value', () => {
    expect(holdDocument(hold({ soldStore: 'P077', soldTrx: '889102' }))).toEqual({
      key: 'holds.document.till',
      text: 'P077 · 889102',
    })
  })

  it('a hold with neither shows nothing', () => {
    expect(holdDocument(hold())).toBeNull()
  })
})

describe('the Holds columns', () => {
  it('in the prototype’s order, without the released columns by default', () => {
    expect(holdColumns('open')).toEqual([
      'takeId',
      'item',
      'name',
      'batch',
      'quantity',
      'takenAt',
      'age',
      'state',
      'source',
      'document',
    ])
    expect(holdColumns('standing')).not.toContain('releasedAt')
    expect(holdColumns('sold')).not.toContain('releaseReason')
  })

  it('released in the last 7 days adds when and why', () => {
    expect(holdColumns('released').slice(-2)).toEqual(['releasedAt', 'releaseReason'])
  })
})

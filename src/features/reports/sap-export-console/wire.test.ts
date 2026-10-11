import { describe, expect, it } from 'vitest'
import type { StoreDay, StoreDayRow } from '@/core/models/sap-export'
import { normaliseFleet, normaliseFleetSummary, normaliseStoreDay, type WireFleetStoreRow, type WireStoreDay } from './wire'

const fullRow = (over: Partial<StoreDayRow> = {}): StoreDayRow => ({
  trxNumber: '000123',
  machineCode: 'M01',
  trxDate: '2026-10-10',
  counter: 4567,
  rail: 'new',
  state: 'N1',
  label: 'stuck',
  version: 'N',
  trxType: 1,
  documentType: 2,
  customerId: null,
  reason: 'Missing rows',
  hoursPastDayEnd: 30,
  held: { held: 1, of: 2, missingRows: true },
  flags: ['X2'],
  watermark: null,
  ...over,
})

const full = (): StoreDay => ({
  code: 'P001',
  day: '2026-10-10',
  asOf: '2026-10-11T08:00:00',
  total: 12,
  labels: { exported: 8, byDesign: 1, waiting: 0, heldForInventory: 0, behind: 2, stuck: 1 },
  states: { N5: 8, L3: 1, N4: 2, N1: 1 },
  flags: { X1: 0, X1p: 0, X2: 1, X3: 0, X4: 0, legacyResend: 0, failClosedNoDetail: 0 },
  accounting: 'breaks',
  rows: { items: [fullRow()], total: 1, page: 1, pageSize: 50 },
})

const ZERO_FLAGS = { X1: 0, X1p: 0, X2: 0, X3: 0, X4: 0, legacyResend: 0, failClosedNoDetail: 0 }

describe('normaliseStoreDay', () => {
  it('passes a full answer through unchanged', () => {
    const data = full()
    expect(normaliseStoreDay(structuredClone(data))).toEqual(data)
  })

  it('fills what an older door leaves out: flag counts, the verdict, row flags, holds and reasons', () => {
    const { flags: _f, accounting: _a, ...rest } = full()
    const { flags: _rf, held: _h, reason: _r, ...row } = fullRow()
    const old: WireStoreDay = { ...rest, rows: { items: [row], total: 1, page: 1, pageSize: 50 } }
    const filled = normaliseStoreDay(old)
    expect(filled.accounting).toBe('agrees')
    expect(filled.flags).toEqual(ZERO_FLAGS)
    expect(filled.rows.items[0].flags).toEqual([])
    expect(filled.rows.items[0].held).toBeNull()
    expect(filled.rows.items[0].reason).toBe('')
    expect(filled.rows.items[0].trxNumber).toBe('000123')
    expect(filled.rows.items[0].state).toBe('N1')
  })

  it('fills a null member as it fills a missing one', () => {
    const old = { ...full(), flags: null, accounting: null, rows: { items: [{ ...fullRow(), flags: null, held: null, reason: null, watermark: undefined }], total: 1, page: 1, pageSize: 50 } }
    const filled = normaliseStoreDay(old as unknown as WireStoreDay)
    expect(filled.accounting).toBe('agrees')
    expect(filled.flags).toEqual(ZERO_FLAGS)
    expect(filled.rows.items[0].flags).toEqual([])
    expect(filled.rows.items[0].reason).toBe('')
    expect(filled.rows.items[0].watermark).toBeNull()
  })

  it('fills a flag count a partial answer left out, keeping the ones it sent', () => {
    const old = { ...full(), flags: { X1: 2 } } as unknown as WireStoreDay
    expect(normaliseStoreDay(old).flags).toEqual({ ...ZERO_FLAGS, X1: 2 })
  })

  it('fills a missing label count with 0 and missing states with none', () => {
    const old = { ...full(), labels: { stuck: 1 }, states: undefined } as unknown as WireStoreDay
    const filled = normaliseStoreDay(old)
    expect(filled.labels).toEqual({ exported: 0, byDesign: 0, waiting: 0, heldForInventory: 0, behind: 0, stuck: 1 })
    expect(filled.states).toEqual({})
  })
})

describe('normaliseFleetSummary', () => {
  it('passes a full summary through and reads a tile an older door does not count as 0', () => {
    const tiles = { storesBehind: 4, storesStuck: 2, storesHeldForInventory: 1, doubleSent: 7, doubleSendPending: 3, accountingBreaks: 5, legacyStalled: 1 }
    const full = { windowDays: 30, computedAt: '2026-10-11T08:00:00', stores: 212, tiles }
    expect(normaliseFleetSummary(full)).toEqual(full)
    const { doubleSent: _a, doubleSendPending: _b, accountingBreaks: _c, ...older } = tiles
    expect(normaliseFleetSummary({ ...full, tiles: older }).tiles).toEqual({ ...tiles, doubleSent: 0, doubleSendPending: 0, accountingBreaks: 0 })
  })
})

describe('normaliseFleet', () => {
  const row: WireFleetStoreRow = {
    code: 'P014',
    description: 'Riyadh Olaya',
    total: 840,
    labels: { stuck: 3, behind: 116 },
    railMix: { legacy: 40, new: 800 },
    oldestBehindHours: 31.5,
    computedAt: '2026-10-11T08:00:00',
  }

  it('fills what a door that shipped before 2583 leaves out', () => {
    const [filled] = normaliseFleet({ items: [row], total: 1, page: 1, pageSize: 50 }).items
    expect(filled.labels).toEqual({ exported: 0, byDesign: 0, waiting: 0, heldForInventory: 0, behind: 116, stuck: 3 })
    expect(filled.states).toEqual({})
    expect(filled.flags).toEqual({ X1: 0, X1p: 0, X2: 0, X3: 0, X4: 0, legacyResend: 0, failClosedNoDetail: 0 })
    expect(filled).toMatchObject({ breakDays: 0, legacyStalled: false, legacyInventoryGated: false, railMix: { legacy: 40, new: 800 } })
  })

  it('passes what the door sent as it is, and keeps the paging', () => {
    const sent = normaliseFleet({ items: [{ ...row, states: { N1: 2 }, breakDays: 3, legacyStalled: true }], total: 61, page: 2, pageSize: 50 })
    expect(sent).toMatchObject({ total: 61, page: 2, pageSize: 50 })
    expect(sent.items[0]).toMatchObject({ states: { N1: 2 }, breakDays: 3, legacyStalled: true })
  })
})

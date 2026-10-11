import { describe, expect, it } from 'vitest'
import type { StoreDaySummary, StoreDetail } from '@/core/models/sap-export'
import { recomputeErrorKey, storeFacts, stripCells } from './store-helpers'
import { storeDayHref } from './storeday-helpers'

const ZERO_LABELS = { exported: 0, byDesign: 0, waiting: 0, heldForInventory: 0, behind: 0, stuck: 0 }
const ZERO_FLAGS = { X1: 0, X1p: 0, X2: 0, X3: 0, X4: 0, legacyResend: 0, failClosedNoDetail: 0 }

const day = (d: string, over: Partial<StoreDaySummary> = {}): StoreDaySummary => ({
  day: d,
  noData: false,
  total: 10,
  worst: 'exported',
  labels: { ...ZERO_LABELS, exported: 10 },
  states: { N5: 10 },
  flags: ZERO_FLAGS,
  accounting: 'agrees',
  oldestBehindHours: null,
  computedAt: '2026-10-11T08:00:00',
  ...over,
})

const noData = (d: string): StoreDaySummary =>
  day(d, { noData: true, total: 0, worst: null, labels: ZERO_LABELS, states: {}, accounting: null, computedAt: null })

describe('stripCells', () => {
  it('keeps the days oldest first, whatever order they arrive in', () => {
    const cells = stripCells([day('2026-10-10'), day('2026-09-12'), day('2026-10-01')])
    expect(cells.map((c) => c.day)).toEqual(['2026-09-12', '2026-10-01', '2026-10-10'])
  })

  it("colours a day by its worst label through the label tokens (held for inventory is info, never danger)", () => {
    const cells = stripCells([
      day('2026-10-01', { worst: 'stuck' }),
      day('2026-10-02', { worst: 'behind' }),
      day('2026-10-03', { worst: 'heldForInventory' }),
      day('2026-10-04', { worst: 'waiting' }),
      day('2026-10-05', { worst: 'exported' }),
      day('2026-10-06', { worst: 'byDesign' }),
    ])
    expect(cells.map((c) => c.token)).toEqual(['danger', 'warningStrong', 'info', 'neutral', 'success', 'muted'])
  })

  it('mutes a day the rollup never computed, and marks it noData', () => {
    const [cell] = stripCells([noData('2026-10-01')])
    expect(cell).toMatchObject({ noData: true, token: 'muted', worst: null, breaks: false, counts: [], unknown: [] })
  })

  it('mutes a computed day with no transactions, but does not call it noData', () => {
    const [cell] = stripCells([day('2026-10-01', { total: 0, worst: null, labels: ZERO_LABELS, states: {} })])
    expect(cell).toMatchObject({ noData: false, token: 'muted', worst: null })
  })

  it('draws a label a newer door sends on the neutral token, keeping its raw value', () => {
    const [cell] = stripCells([day('2026-10-01', { worst: 'parked' as never })])
    expect(cell).toMatchObject({ token: 'neutral', worst: 'parked' })
  })

  it("keeps a newer door's unknown label counts for the hover, so they still add up to the total", () => {
    const [cell] = stripCells([day('2026-10-01', { total: 22, labels: { ...ZERO_LABELS, exported: 10, parked: 12 } as never })])
    expect(cell.counts).toEqual([{ label: 'exported', count: 10 }])
    expect(cell.unknown).toEqual([{ label: 'parked', count: 12 }])
  })

  it('carries a breaks marker only on a day whose accounting breaks', () => {
    const cells = stripCells([day('2026-10-01', { accounting: 'breaks' }), day('2026-10-02'), noData('2026-10-03')])
    expect(cells.map((c) => c.breaks)).toEqual([true, false, false])
  })

  it("lists the day's non-zero label counts, worst first, for the hover", () => {
    const [cell] = stripCells([
      day('2026-10-01', { total: 15, worst: 'stuck', labels: { ...ZERO_LABELS, exported: 10, stuck: 2, waiting: 3 } }),
    ])
    expect(cell.counts).toEqual([
      { label: 'stuck', count: 2 },
      { label: 'waiting', count: 3 },
      { label: 'exported', count: 10 },
    ])
    expect(cell.total).toBe(15)
    expect(cell.accounting).toBe('agrees')
  })

  it('returns nothing for no days', () => {
    expect(stripCells([])).toEqual([])
  })
})

const store = (facts: Partial<StoreDetail['facts']> = {}): StoreDetail => ({
  code: 'P014',
  description: 'Riyadh Olaya',
  total: 840,
  labels: { ...ZERO_LABELS, exported: 840 },
  states: { N5: 840 },
  flags: ZERO_FLAGS,
  railMix: { legacy: 40, new: 800 },
  oldestBehindHours: null,
  breakDays: 0,
  legacyStalled: false,
  legacyInventoryGated: false,
  computedAt: '2026-10-11T08:00:00',
  facts: {
    underSap: true,
    sapLocations: 1,
    hasCounterRow: true,
    watermark: 4567,
    openDate: '2019-03-01',
    closed: false,
    inventoryDate: '2026-09-30',
    ...facts,
  },
})

const byKey = (s: StoreDetail) => Object.fromEntries(storeFacts(s).map((f) => [f.key, f]))

describe('storeFacts', () => {
  it('lists every fact in order, none in danger for a healthy store', () => {
    const facts = storeFacts(store())
    expect(facts.map((f) => f.key)).toEqual(['underSap', 'counterRow', 'watermark', 'openDate', 'closed', 'inventoryDate'])
    expect(facts.every((f) => !f.danger && f.causeKey === null)).toBe(true)
  })

  it('reads under SAP with how many SAP locations', () => {
    expect(byKey(store({ sapLocations: 2 })).underSap).toMatchObject({ valueKey: 'store.facts.values.sapLocations', count: 2 })
  })

  it('reads a store not under SAP as danger, with the L6 cause', () => {
    expect(byKey(store({ underSap: false, sapLocations: 0 })).underSap).toMatchObject({
      danger: true,
      valueKey: 'store.facts.values.notUnderSap',
      causeKey: 'store.facts.causes.L6',
    })
  })

  it('reads under SAP with zero SAP locations as danger too', () => {
    expect(byKey(store({ underSap: true, sapLocations: 0 })).underSap).toMatchObject({ danger: true, causeKey: 'store.facts.causes.L6' })
  })

  it('reads a missing counter row as danger, with the L7 cause', () => {
    expect(byKey(store({ hasCounterRow: false })).counterRow).toMatchObject({
      danger: true,
      valueKey: 'store.facts.values.counterMissing',
      causeKey: 'store.facts.causes.L7',
    })
    expect(byKey(store()).counterRow).toMatchObject({ danger: false, valueKey: 'store.facts.values.counterPresent' })
  })

  it('shows the watermark and the dates as drawn', () => {
    const f = byKey(store({ watermark: 1234567 }))
    expect(f.watermark.value).toBe('1,234,567')
    expect(f.openDate.value).toBe('2019-03-01')
    expect(f.inventoryDate.value).toBe('2026-09-30')
  })

  it('shows a null watermark and null dates as blank, never as a sentinel', () => {
    const f = byKey(store({ watermark: null, openDate: null, inventoryDate: null }))
    expect([f.watermark.value, f.openDate.value, f.inventoryDate.value]).toEqual(['', '', ''])
    expect([f.watermark.valueKey, f.openDate.valueKey, f.inventoryDate.valueKey]).toEqual([null, null, null])
  })

  it('reads closed as yes / no', () => {
    expect(byKey(store({ closed: true })).closed.valueKey).toBe('store.facts.values.yes')
    expect(byKey(store()).closed.valueKey).toBe('store.facts.values.no')
  })
})

describe('recomputeErrorKey', () => {
  it("names the recompute door's refusals", () => {
    for (const code of ['BAD_REQUEST', 'NO_STORE', 'BAD_DAY', 'DAY_OUT_OF_WINDOW'])
      expect(recomputeErrorKey(code)).toBe(`recompute.errors.${code}`)
  })

  it('leaves any other code to the envelope message', () => {
    expect(recomputeErrorKey('BAD_FILTER')).toBeNull()
    expect(recomputeErrorKey(null)).toBeNull()
  })
})

describe('storeDayHref', () => {
  it('opens the store-day page, encoding both parts', () => {
    expect(storeDayHref('P 14', '2026-10-01')).toBe('/reports/sap-export/store/P%2014/day/2026-10-01')
  })
})

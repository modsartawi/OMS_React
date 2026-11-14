import { describe, expect, it } from 'vitest'
import type { ExpiredApprovalPickPharmacist, ExpiredApprovalPickRow } from '@/core/models/expired-approval-pick'
import {
  DEFAULT_FILTERS,
  canStepForward,
  drillInto,
  picksShown,
  weekTotals,
  filtersFromParams,
  filtersToParams,
  normalizeStores,
  reportQuery,
  stepWeek,
  weekStartOf,
} from './filters'

describe('weekStartOf', () => {
  it('is the Sunday of the GCC working week the day falls in, as the door reads it', () => {
    // 2026-11-14 is a Saturday: its week began Sunday 2026-11-08.
    expect(weekStartOf('2026-11-14')).toBe('2026-11-08')
    expect(weekStartOf('2026-11-08')).toBe('2026-11-08')
    expect(weekStartOf('2026-11-09')).toBe('2026-11-08')
    // Across a month and a year end.
    expect(weekStartOf('2026-01-02')).toBe('2025-12-28')
  })

  it('reads a blank or impossible day as no week', () => {
    expect(weekStartOf('')).toBe('')
    expect(weekStartOf('2026-02-30')).toBe('')
    expect(weekStartOf('nope')).toBe('')
  })
})

describe('stepping a week', () => {
  it('moves a whole week back or forward from its Sunday, across a month end', () => {
    expect(stepWeek('2026-11-08', -1)).toBe('2026-11-01')
    expect(stepWeek('2026-11-01', -1)).toBe('2026-10-25')
    expect(stepWeek('2026-10-25', 1)).toBe('2026-11-01')
  })

  it('goes forward only up to the week today falls in: no fill has been written past it', () => {
    const SATURDAY = new Date(2026, 10, 14, 23, 59)
    expect(canStepForward('2026-11-01', SATURDAY)).toBe(true)
    expect(canStepForward('2026-11-08', SATURDAY)).toBe(false)
    expect(canStepForward('', SATURDAY)).toBe(false)
  })
})

describe('the URL', () => {
  it('writes nothing for the defaults: the newest week filled, every store, both groups', () => {
    expect(filtersToParams(DEFAULT_FILTERS).toString()).toBe('')
    expect(filtersFromParams(new URLSearchParams())).toEqual(DEFAULT_FILTERS)
  })

  it('round-trips the week, the stores, the group, the tab and the pharmacist drill', () => {
    const filters = {
      tab: 'picks' as const,
      week: '2026-11-01',
      stores: 'P001,P002',
      outcome: 'NEVER_SOLD' as const,
      drill: { store: 'P001', pharmacist: 'PH7' },
    }
    expect(filtersFromParams(filtersToParams(filters))).toEqual(filters)
  })

  it('keeps a drill into the pharmacist nobody could be named as, a blank pharmacist', () => {
    const filters = { ...DEFAULT_FILTERS, tab: 'picks' as const, drill: { store: 'P001', pharmacist: '' } }
    expect(filtersFromParams(filtersToParams(filters))).toEqual(filters)
  })

  it('reads a week day as its Sunday, and anything unknown as its default', () => {
    const read = filtersFromParams(new URLSearchParams('week=2026-11-04&tab=nope&outcome=maybe&stores= p001 ,p001'))
    expect(read.week).toBe('2026-11-01')
    expect(read.tab).toBe('pharmacists')
    expect(read.outcome).toBe('')
    expect(read.stores).toBe('P001')
    expect(read.drill).toBeNull()
    expect(filtersFromParams(new URLSearchParams('week=2026-02-30')).week).toBe('')
  })
})

describe('the read', () => {
  it('asks for the week by its Sunday and the stores, and leaves the week out for the newest filled', () => {
    expect(reportQuery({ ...DEFAULT_FILTERS, week: '2026-11-01', stores: 'P001' })).toEqual({ week: '2026-11-01', stores: 'P001' })
    expect(reportQuery(DEFAULT_FILTERS)).toEqual({})
  })
})

describe('normalizeStores', () => {
  it('splits on commas or spaces, upper-cases and de-duplicates, as the door does', () => {
    expect(normalizeStores(' p001, P002  p001;p003 ')).toBe('P001,P002,P003')
    expect(normalizeStores('   ')).toBe('')
  })
})

const pick = (documentNo: string, storeCode: string, pharmacist: string, outcome: string): ExpiredApprovalPickRow => ({
  documentNo,
  sourceType: 'NPHS',
  sourceKey: 'K',
  storeCode,
  pharmacist,
  outcome,
  deliveryNo: '',
  units: 1,
  pickedAt: '2026-11-02T10:00:00',
  expiredAt: '2026-11-05T10:00:00',
})

const ROWS = [
  pick('D1', 'P001', 'PH7', 'NEVER_SOLD'),
  pick('D2', 'P001', 'PH7', 'SOLD_NOT_BILLED'),
  pick('D3', 'P001', '', 'NEVER_SOLD'),
  pick('D4', 'P002', 'PH7', 'NEVER_SOLD'),
]

describe('the drill', () => {
  it('opening a pharmacist shows the Picks tab narrowed to that store and pharmacist, keeping the week and stores', () => {
    const scoped = { ...DEFAULT_FILTERS, week: '2026-11-01', stores: 'P001,P002' }
    const next = drillInto(scoped, { storeCode: 'P001', pharmacist: 'PH7' })
    expect(next).toEqual({ ...scoped, tab: 'picks', drill: { store: 'P001', pharmacist: 'PH7' } })
  })

  it('narrows to the store AND the pharmacist: the same person at another store is another row', () => {
    const drilled = drillInto(DEFAULT_FILTERS, { storeCode: 'P001', pharmacist: 'PH7' })
    expect(picksShown(ROWS, drilled).map((r) => r.documentNo)).toEqual(['D1', 'D2'])
  })

  it('the unnamed pharmacist keeps only the picks with no name, never every pick', () => {
    const drilled = drillInto(DEFAULT_FILTERS, { storeCode: 'P001', pharmacist: '' })
    expect(picksShown(ROWS, drilled).map((r) => r.documentNo)).toEqual(['D3'])
  })

  it('the group filter keeps one group, on top of the drill or without it', () => {
    expect(picksShown(ROWS, { ...DEFAULT_FILTERS, outcome: 'NEVER_SOLD' }).map((r) => r.documentNo)).toEqual(['D1', 'D3', 'D4'])
    const drilled = { ...drillInto(DEFAULT_FILTERS, { storeCode: 'P001', pharmacist: 'PH7' }), outcome: 'SOLD_NOT_BILLED' as const }
    expect(picksShown(ROWS, drilled).map((r) => r.documentNo)).toEqual(['D2'])
  })
})

describe('the week totals', () => {
  it('adds the door’s per-pharmacist counts, and counts the stores and pharmacists named', () => {
    const pharmacists: ExpiredApprovalPickPharmacist[] = [
      { storeCode: 'P001', pharmacist: 'PH7', soldNotBilled: 1, neverSold: 1, units: 5 },
      { storeCode: 'P001', pharmacist: '', soldNotBilled: 0, neverSold: 1, units: 2 },
      { storeCode: 'P002', pharmacist: 'PH7', soldNotBilled: 0, neverSold: 1, units: 3 },
    ]
    expect(weekTotals(pharmacists)).toEqual({ picks: 4, soldNotBilled: 1, neverSold: 3, units: 10, stores: 2, pharmacists: 3 })
    expect(weekTotals([])).toEqual({ picks: 0, soldNotBilled: 0, neverSold: 0, units: 0, stores: 0, pharmacists: 0 })
  })
})

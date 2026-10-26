import { describe, expect, it } from 'vitest'
import {
  DEFAULT_FILTERS,
  drillInto,
  filtersFromParams,
  filtersToParams,
  isDrilled,
  normalizeStores,
  resolveRange,
  rowsQuery,
} from './filters'

const NOW = new Date(2026, 9, 25, 23, 59)

describe('resolveRange', () => {
  it('defaults to the last 30 days ending today, both inclusive', () => {
    expect(resolveRange({ from: '', to: '' }, NOW)).toEqual({ ok: true, from: '2026-09-26', to: '2026-10-25' })
  })

  it('takes a picked range of up to 92 days', () => {
    expect(resolveRange({ from: '2026-07-26', to: '2026-10-25' }, NOW)).toEqual({ ok: true, from: '2026-07-26', to: '2026-10-25' })
  })

  it('refuses a half-typed, impossible, reversed or too-long range before any call', () => {
    expect(resolveRange({ from: '2026-10-01', to: '' }, NOW)).toEqual({ ok: false, problem: 'incomplete' })
    expect(resolveRange({ from: '2026-02-30', to: '2026-03-01' }, NOW)).toEqual({ ok: false, problem: 'incomplete' })
    expect(resolveRange({ from: '2026-10-02', to: '2026-10-01' }, NOW)).toEqual({ ok: false, problem: 'reversed' })
    expect(resolveRange({ from: '2026-07-25', to: '2026-10-25' }, NOW)).toEqual({ ok: false, problem: 'tooLong' })
  })
})

describe('the URL', () => {
  it('writes nothing for the defaults', () => {
    expect(filtersToParams(DEFAULT_FILTERS).toString()).toBe('')
    expect(filtersFromParams(new URLSearchParams())).toEqual(DEFAULT_FILTERS)
  })

  it('round-trips every filter and the drill', () => {
    const filters = {
      ...DEFAULT_FILTERS,
      tab: 'refusals' as const,
      from: '2026-10-01',
      to: '2026-10-20',
      stores: 'P001,P002',
      status: 'SOLD' as const,
      drill: { staff: 'STF1', noStaff: false, gtin: '06281234567890', serial: 'ABC', item: '', heldStore: '' },
    }
    expect(filtersFromParams(filtersToParams(filters))).toEqual(filters)
  })

  it('reads anything unknown as its default, and noStaff wins over a staff id', () => {
    const read = filtersFromParams(new URLSearchParams('tab=nope&status=maybe&noStaff=1&staff=STF1&stores= p001 ,p001'))
    expect(read.tab).toBe('staff')
    expect(read.status).toBe('')
    expect(read.drill.noStaff).toBe(true)
    expect(read.drill.staff).toBe('')
    expect(read.stores).toBe('P001')
  })
})

describe('the drill', () => {
  it('opening a row replaces the drill and shows the Refusals tab, keeping the scope', () => {
    const scoped = { ...DEFAULT_FILTERS, stores: 'P001', drill: { ...DEFAULT_FILTERS.drill, serial: 'OLD' } }
    const next = drillInto(scoped, { staff: 'STF9' })
    expect(next.tab).toBe('refusals')
    expect(next.stores).toBe('P001')
    expect(next.drill).toEqual({ ...DEFAULT_FILTERS.drill, staff: 'STF9' })
    expect(isDrilled(next.drill)).toBe(true)
    expect(isDrilled(DEFAULT_FILTERS.drill)).toBe(false)
  })

  it('the unknown staff row asks for noStaff, never a blank staff id', () => {
    const q = rowsQuery(drillInto(DEFAULT_FILTERS, { noStaff: true }), { from: '2026-10-01', to: '2026-10-02' })
    expect(q).toMatchObject({ noStaff: true, staff: '', from: '2026-10-01', to: '2026-10-02' })
  })
})

describe('normalizeStores', () => {
  it('splits on commas or spaces, upper-cases and de-duplicates', () => {
    expect(normalizeStores(' p001, P002  p001;p003 ')).toBe('P001,P002,P003')
    expect(normalizeStores('   ')).toBe('')
  })
})

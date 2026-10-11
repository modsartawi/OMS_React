import { describe, expect, it } from 'vitest'
import {
  DEFAULT_STORE_DAY_FILTER,
  STORE_DAY_PAGE_SIZE,
  formatHours,
  inspectorHref,
  storeHref,
  storeDayErrorKey,
  storeDayParams,
  toggleLabel,
  toggleState,
  type StoreDayFilter,
} from './storeday-helpers'
import en from '@/locales/en/sap-export-console.json'

const filter = (over: Partial<StoreDayFilter> = {}): StoreDayFilter => ({ ...DEFAULT_STORE_DAY_FILTER, ...over })

describe('storeDayParams', () => {
  it('asks for page 1 of 50 with no label or state by default', () => {
    expect(STORE_DAY_PAGE_SIZE).toBe(50)
    expect(storeDayParams('P001', '2026-10-10', filter())).toEqual({ code: 'P001', day: '2026-10-10', label: [], state: [], page: 1, pageSize: 50 })
  })

  it('sends the chosen labels and states as arrays (repeated keys), and never a page below 1', () => {
    expect(storeDayParams('P001', '2026-10-10', filter({ labels: ['stuck', 'behind'], states: ['N1'], page: 0 }))).toEqual({
      code: 'P001',
      day: '2026-10-10',
      label: ['stuck', 'behind'],
      state: ['N1'],
      page: 1,
      pageSize: 50,
    })
  })
})

describe('toggleLabel / toggleState', () => {
  it('toggles a label in and out, worst first whatever the click order, back on page 1', () => {
    const a = toggleLabel(filter({ page: 3 }), 'behind')
    expect(a).toEqual(filter({ labels: ['behind'] }))
    const b = toggleLabel(a, 'stuck')
    expect(b.labels).toEqual(['stuck', 'behind'])
    expect(toggleLabel(b, 'behind').labels).toEqual(['stuck'])
  })

  it('toggles a state in the contract order, back on page 1, leaving the labels', () => {
    const a = toggleState(filter({ labels: ['stuck'], page: 2 }), 'N1')
    const b = toggleState(a, 'L9')
    expect(b).toEqual(filter({ labels: ['stuck'], states: ['L9', 'N1'] }))
    expect(toggleState(b, 'L9').states).toEqual(['N1'])
  })

  it('ignores an unknown value rather than provoking BAD_FILTER', () => {
    expect(toggleLabel(filter(), 'quarantined').labels).toEqual([])
    expect(toggleState(filter(), 'Z9').states).toEqual([])
  })
})

describe('storeHref', () => {
  it('is the store page, its code encoded', () => {
    expect(storeHref('P014')).toBe('/reports/sap-export/store/P014')
    expect(storeHref('P 1/2')).toBe('/reports/sap-export/store/P%201%2F2')
  })
})

describe('inspectorHref', () => {
  it('links to the IDoc inspector with store and trx', () => {
    expect(inspectorHref('P001', '000123')).toBe('/reports/idoc-inspector?store=P001&trx=000123')
  })

  it('encodes what it carries', () => {
    expect(inspectorHref('P 1', 'a&b')).toBe('/reports/idoc-inspector?store=P+1&trx=a%26b')
  })
})

describe('formatHours', () => {
  it('draws hours grouped with one decimal at most, and null blank', () => {
    expect(formatHours(null)).toBe('')
    expect(formatHours(5)).toBe('5')
    expect(formatHours(30.25)).toBe('30.3')
    expect(formatHours(1234)).toBe('1,234')
  })
})

describe('storeDayErrorKey', () => {
  it('names the store-day refusals, each with a sentence in the bundle', () => {
    for (const code of ['NO_STORE', 'BAD_DAY', 'DAY_OUT_OF_WINDOW', 'BAD_FILTER', 'BAD_PAGING']) {
      const key = storeDayErrorKey(code)
      expect(key).toBe(`storeDay.errors.${code}`)
      expect((en.storeDay.errors as Record<string, string>)[code]).toBeTruthy()
    }
  })

  it('leaves any other code to the envelope message', () => {
    expect(storeDayErrorKey('BOOM')).toBeNull()
    expect(storeDayErrorKey(undefined)).toBeNull()
    expect(storeDayErrorKey('toString')).toBeNull()
  })
})

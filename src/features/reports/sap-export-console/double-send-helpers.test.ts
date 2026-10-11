import { describe, expect, it } from 'vitest'
import type { DoubleSendRow } from '@/core/models/sap-export'
import {
  DEFAULT_DOUBLE_SEND_QUERY,
  doubleSendDoorParams,
  doubleSendErrorKey,
  doubleSendQueryFromParams,
  doubleSendQueryToParams,
  doubleSendRows,
  isFilteredDoubleSends,
  withDoubleSendFilter,
} from './double-send-helpers'
import { doubleSendsHref } from './fleet-helpers'
import en from '@/locales/en/sap-export-console.json'

const row = (over: Partial<DoubleSendRow> = {}): DoubleSendRow => ({
  flag: 'X1',
  code: 'P014',
  trxNumber: '000123',
  day: '2026-10-05',
  version: 'L',
  state: 'N5',
  legacyFile: 'P014_20261005_1.txt',
  legacyUploadedAt: '2026-10-05T23:10:00',
  documents: 2,
  documentsExported: 2,
  ...over,
})

const params = (qs: string) => new URLSearchParams(qs)

describe('doubleSendRows', () => {
  it('sorts X1p first, keeping the door order within each flag', () => {
    const rows = doubleSendRows([
      row({ trxNumber: 'a' }),
      row({ trxNumber: 'b', flag: 'X1p' }),
      row({ trxNumber: 'c' }),
      row({ trxNumber: 'd', flag: 'X1p' }),
    ])
    expect(rows.map((r) => `${r.flag}:${r.trxNumber}`)).toEqual(['X1p:b', 'X1p:d', 'X1:a', 'X1:c'])
  })

  it('reads X1p as stoppable, and X1 as not', () => {
    const [pending, sent] = doubleSendRows([row({ flag: 'X1p', documentsExported: 0 }), row()])
    expect(pending.stoppable).toBe(true)
    expect(sent.stoppable).toBe(false)
  })

  it('counts the exported documents of the documents made as one n / m', () => {
    expect(doubleSendRows([row({ flag: 'X1p', documents: 1200, documentsExported: 3 })])[0].exportedOf).toBe('3 / 1,200')
  })

  it('keeps every row as sent', () => {
    const r = row({ legacyFile: null, legacyUploadedAt: null, version: null })
    expect(doubleSendRows([r])[0]).toMatchObject(r)
  })
})

describe('the double-send query in the URL', () => {
  it('reads a bare URL as both flags, the whole fleet, page 1', () => {
    expect(doubleSendQueryFromParams(params(''))).toEqual(DEFAULT_DOUBLE_SEND_QUERY)
  })

  it("reads the fleet tiles' links", () => {
    expect(doubleSendQueryFromParams(new URL(doubleSendsHref('X1p'), 'http://x').searchParams).flag).toBe('X1p')
    expect(doubleSendQueryFromParams(new URL(doubleSendsHref('X1'), 'http://x').searchParams).flag).toBe('X1')
  })

  it('reads both flags, or a flag the door would refuse, as both', () => {
    expect(doubleSendQueryFromParams(params('flag=X1&flag=X1p')).flag).toBeNull()
    expect(doubleSendQueryFromParams(params('flag=X2')).flag).toBeNull()
  })

  it('reads the store and the page, and drops a malformed page', () => {
    expect(doubleSendQueryFromParams(params('code=%20P014%20&page=3'))).toEqual({ flag: null, code: 'P014', page: 3 })
    expect(doubleSendQueryFromParams(params('page=x')).page).toBe(1)
    expect(doubleSendQueryFromParams(params('page=0')).page).toBe(1)
  })

  it('writes the defaults off the address, and round-trips', () => {
    expect(doubleSendQueryToParams(DEFAULT_DOUBLE_SEND_QUERY).toString()).toBe('')
    const q = { flag: 'X1p' as const, code: 'P014', page: 2 }
    expect(doubleSendQueryToParams(q).toString()).toBe('code=P014&flag=X1p&page=2')
    expect(doubleSendQueryFromParams(doubleSendQueryToParams(q))).toEqual(q)
  })
})

describe('doubleSendDoorParams', () => {
  it('asks for page 1 of 50, with no flag and no store by default', () => {
    expect(doubleSendDoorParams(DEFAULT_DOUBLE_SEND_QUERY)).toEqual({ code: '', flag: null, page: 1, pageSize: 50 })
  })

  it('sends the flag and the store as the contract names them', () => {
    expect(doubleSendDoorParams({ flag: 'X1', code: ' P001 ', page: 4 })).toEqual({ code: 'P001', flag: 'X1', page: 4, pageSize: 50 })
  })
})

describe('withDoubleSendFilter', () => {
  it('goes back to page 1 on a change', () => {
    const q = { flag: null, code: '', page: 3 }
    expect(withDoubleSendFilter(q, { flag: 'X1p' })).toEqual({ flag: 'X1p', code: '', page: 1 })
    expect(withDoubleSendFilter(q, { code: ' P014 ' })).toEqual({ flag: null, code: 'P014', page: 1 })
  })

  it('returns the same query when nothing changes', () => {
    const q = { flag: 'X1' as const, code: 'P014', page: 3 }
    expect(withDoubleSendFilter(q, { flag: 'X1', code: 'P014 ' })).toBe(q)
  })

  it('says whether a filter narrows the list', () => {
    expect(isFilteredDoubleSends(DEFAULT_DOUBLE_SEND_QUERY)).toBe(false)
    expect(isFilteredDoubleSends({ ...DEFAULT_DOUBLE_SEND_QUERY, flag: 'X1' })).toBe(true)
    expect(isFilteredDoubleSends({ ...DEFAULT_DOUBLE_SEND_QUERY, code: 'P014' })).toBe(true)
  })
})

describe('doubleSendErrorKey', () => {
  it('has its own sentence for the contract refusals', () => {
    for (const code of ['NO_STORE', 'BAD_FILTER', 'BAD_PAGING']) {
      expect(doubleSendErrorKey(code)).toBe(`doubleSends.errors.${code}`)
      expect((en.doubleSends as unknown as { errors: Record<string, string> }).errors[code]).toBeTruthy()
    }
  })

  it('leaves any other code to the envelope message', () => {
    expect(doubleSendErrorKey('BOOM')).toBeNull()
    expect(doubleSendErrorKey(null)).toBeNull()
  })
})

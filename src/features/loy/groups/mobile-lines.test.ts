/**
 * Ticket 633 — a list of mobiles loaded into a group, from pasted text, a CSV or the first sheet of an
 * `.xlsx` (door BackOffice 3175 `POST LoyGroupWeb/Groups/Members/Bulk`).
 *
 * The browser decides the SHAPE only: split, trim, drop blanks, skip a first line that is not a mobile
 * as a header, and refuse more than 50,000 lines before anything is sent. It never judges a mobile —
 * a bad line or a repeat goes up as it was typed, and the server answers it.
 */
import { describe, expect, it } from 'vitest'
import { LOY_GROUP_BULK_MAX, mobileLines } from './mobile-lines'

describe('mobile lines split, trim, drop blanks and skip a non-mobile header', () => {
  it('splits a paste on line breaks and commas, trims, and drops blanks', () => {
    const read = mobileLines({ kind: 'paste', text: ' 0501234567 \r\n\n+966 55 123 4567, 966561234567 ,,\n\r\n 0571234567' })
    expect(read.lines).toEqual(['0501234567', '+966 55 123 4567', '966561234567', '0571234567'])
    expect(read.header).toBeNull()
  })

  it('keeps repeats and lines that are not mobiles — the server answers them', () => {
    expect(mobileLines({ kind: 'paste', text: '0501234567\n0501234567\nabc\n123' }).lines).toEqual(['0501234567', '0501234567', 'abc', '123'])
  })

  it('reads a CSV by its first column only, unquoted, BOM dropped', () => {
    const read = mobileLines({ kind: 'csv', text: '﻿Mobile,Name\r\n0501234567,Ahmed\r\n"+966 55 123 4567","Sara, Ali"\r\n,orphan\r\n966561234567\r\n' })
    expect(read.lines).toEqual(['0501234567', '+966 55 123 4567', '966561234567'])
    expect(read.header).toBe('Mobile')
  })

  it("reads a sheet's first column, cells trimmed, blanks dropped", () => {
    const read = mobileLines({ kind: 'sheet', rows: [['الجوال', 'الاسم'], [' 0501234567 ', 'x'], [''], [], ['966561234567']] })
    expect(read.lines).toEqual(['0501234567', '966561234567'])
    expect(read.header).toBe('الجوال')
  })

  it('skips a "Mobile" or "الجوال" first line as a header, and says which', () => {
    expect(mobileLines({ kind: 'paste', text: 'Mobile\n0501234567' })).toMatchObject({ lines: ['0501234567'], header: 'Mobile' })
    expect(mobileLines({ kind: 'paste', text: '\n  الجوال \n0501234567' })).toMatchObject({ lines: ['0501234567'], header: 'الجوال' })
  })

  it('keeps a mobile-looking first line, Arabic-Indic digits included, and never skips a later line', () => {
    expect(mobileLines({ kind: 'paste', text: '0501234567\nMobile' })).toMatchObject({ lines: ['0501234567', 'Mobile'], header: null })
    expect(mobileLines({ kind: 'paste', text: '٠٥٠١٢٣٤٥٦٧\n0501234567' })).toMatchObject({ lines: ['٠٥٠١٢٣٤٥٦٧', '0501234567'], header: null })
    expect(mobileLines({ kind: 'sheet', rows: [['+966 50 123 4567']] })).toMatchObject({ lines: ['+966 50 123 4567'], header: null })
  })

  it('reads nothing from an empty source', () => {
    expect(mobileLines({ kind: 'paste', text: ' \n\n , ' })).toMatchObject({ lines: [], header: null, overBy: 0 })
    expect(mobileLines({ kind: 'sheet', rows: [] })).toMatchObject({ lines: [], header: null, overBy: 0 })
  })
})

describe('over 50,000 lines is refused before sending with the cap', () => {
  const many = (n: number) => Array.from({ length: n }, (_, i) => `05${String(i).padStart(8, '0')}`)

  it('the cap is 50,000', () => {
    expect(LOY_GROUP_BULK_MAX).toBe(50000)
  })

  it('50,000 lines can be sent', () => {
    const read = mobileLines({ kind: 'paste', text: many(50000).join('\n') })
    expect(read.lines).toHaveLength(50000)
    expect(read.overBy).toBe(0)
  })

  it('50,001 lines are over by one, and none is dropped to fit', () => {
    const read = mobileLines({ kind: 'paste', text: `Mobile\n${many(50001).join('\n')}` })
    expect(read.lines).toHaveLength(50001)
    expect(read.overBy).toBe(1)
  })

  it('counts a sheet the same way, its header not counted', () => {
    const read = mobileLines({ kind: 'sheet', rows: [['Mobile'], ...many(50002).map((m) => [m])] })
    expect(read.overBy).toBe(2)
  })
})

// Review fix 5: a paste of two Excel columns (tab) or a `;` CSV line keeps its first field, as a CSV does.
describe('a paste takes the first field across ; and tab', () => {
  it('reads the first column of a two-column Excel paste', () => {
    expect(mobileLines({ kind: 'paste', text: 'Mobile\tName\n0501234567\tAhmed\n966561234567\tSara Ali' })).toMatchObject({
      lines: ['0501234567', '966561234567'],
      header: 'Mobile',
    })
  })
  it('cuts at ; and still splits a line on commas', () => {
    expect(mobileLines({ kind: 'paste', text: '0501234567;Ahmed\n0551234567, 0561234567' }).lines).toEqual(['0501234567', '0551234567', '0561234567'])
  })
})

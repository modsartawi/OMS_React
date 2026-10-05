/**
 * Ticket 420 — the code-list normaliser (BackOffice spec 2396 stories 35–37). It must read a
 * list exactly as the server's `BbyMaintainValidator.List` stores it after BackOffice 2400:
 * split on `, ; |` space `\r \n \t`, trim, drop empties, join with `,`, never de-duplicate.
 */
import { describe, expect, it } from 'vitest'
import { codeListCount, codeListMeter, normaliseCodeList } from './code-list'

describe('normaliseCodeList', () => {
  it('a pasted column with CRLF, LF or tabs normalises to a comma list', () => {
    expect(normaliseCodeList('1186\r\n1188\r\n1190\r\n')).toBe('1186,1188,1190')
    expect(normaliseCodeList('1186\n1188\n1190')).toBe('1186,1188,1190')
    expect(normaliseCodeList('1186\t1188\t1190')).toBe('1186,1188,1190')
    // An Excel block: a row of tabs, rows of CRLF, and a trailing blank line.
    expect(normaliseCodeList('1186\t1188\r\n1190\t1192\r\n\r\n')).toBe('1186,1188,1190,1192')
  })

  it('keeps the server’s older separators and mixes them freely', () => {
    expect(normaliseCodeList(' 1186, 1188;1190|1192 1194 ')).toBe('1186,1188,1190,1192,1194')
    expect(normaliseCodeList(',,;\n|\t ,')).toBe('')
    expect(normaliseCodeList('')).toBe('')
    expect(normaliseCodeList(null)).toBe('')
  })

  it('never de-duplicates and never changes case unless asked', () => {
    expect(normaliseCodeList('c000\nC000\nc000')).toBe('c000,C000,c000')
    expect(normaliseCodeList('gold\nsilver', { upper: true })).toBe('GOLD,SILVER')
  })

  it('leaves any other character inside a code', () => {
    expect(normaliseCodeList('A-1\nB_2\nC.3')).toBe('A-1,B_2,C.3')
  })
})

describe('the code count', () => {
  it('the code count matches the normalised list', () => {
    const column = Array.from({ length: 500 }, (_, i) => String(1000 + i)).join('\r\n') + '\r\n'
    const normalised = normaliseCodeList(column)
    expect(codeListCount(normalised)).toBe(500)
    expect(codeListCount(normalised)).toBe(normalised.split(',').length)
    // A repeated code is counted each time it is stored.
    expect(codeListCount(normaliseCodeList('1186\n1186'))).toBe(2)
    expect(codeListCount('')).toBe(0)
  })
})

describe('codeListMeter', () => {
  it('measures the normalised length against the cap, not the raw paste', () => {
    // 10 five-character codes = 59 characters stored; the CRLF paste is longer.
    const paste = Array.from({ length: 10 }, (_, i) => `C00${i}0`).join('\r\n') + '\r\n'
    const m = codeListMeter(paste, 59)
    expect(paste.length).toBeGreaterThan(59)
    expect(m).toEqual({ normalised: m.normalised, count: 10, length: 59, max: 59, over: false })
    expect(codeListMeter(paste, 58).over).toBe(true)
  })

  it('upper-cases when asked, as the server does for loyalty groups and tiers', () => {
    expect(codeListMeter('gold\tsilver', 10, { upper: true }).normalised).toBe('GOLD,SILVER')
  })
})

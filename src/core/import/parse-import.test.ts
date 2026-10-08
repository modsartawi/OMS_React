import { describe, expect, it } from 'vitest'
import { decodeImportFile, importTally, parseImport, sendableLines } from './parse-import'

const CITY = ['cityCode', 'cityNameEn', 'cityNameAr'] as const
const DISTRICT = [
  'districtCode',
  'cityCode',
  'districtNameEn',
  'districtNameAr',
  'magentoCityEn',
  'magentoCityAr',
  'storeCode',
  'insuranceStoreCode',
  'tempStoreCode',
] as const

describe('parseImport', () => {
  it('reads a city line as an upsert of its fields, English before Arabic', () => {
    expect(parseImport('RUH\tRiyadh\tالرياض', CITY)).toEqual([
      {
        line: 1,
        cells: ['RUH', 'Riyadh', 'الرياض'],
        action: 'upsert',
        fields: { cityCode: 'RUH', cityNameEn: 'Riyadh', cityNameAr: 'الرياض' },
      },
    ])
  })

  it('reads a district line by the district spec', () => {
    const [line] = parseImport('RUH-01\tRUH\tAl Olaya\tالعليا\tRiyadh\tالرياض\tP001\tP050\t', DISTRICT)
    expect(line).toMatchObject({
      action: 'upsert',
      fields: {
        districtCode: 'RUH-01',
        cityCode: 'RUH',
        districtNameEn: 'Al Olaya',
        districtNameAr: 'العليا',
        magentoCityEn: 'Riyadh',
        magentoCityAr: 'الرياض',
        storeCode: 'P001',
        insuranceStoreCode: 'P050',
        tempStoreCode: '',
      },
    })
  })

  it('reads a trailing X, either case, as a delete with the same fields', () => {
    const lines = parseImport('RUH\tRiyadh\tالرياض\tX\nJED\tJeddah\tجدة\tx', CITY)
    expect(lines.map((l) => (l.error ? 'error' : l.action))).toEqual(['delete', 'delete'])
    expect(lines[1]).toMatchObject({ fields: { cityCode: 'JED', cityNameEn: 'Jeddah', cityNameAr: 'جدة' } })
  })

  it('flags a line with too few or too many columns, or an extra column that is not X', () => {
    const lines = parseImport('RUH\tRiyadh\nJED\tJeddah\tجدة\tY\nDMM\tDammam\tالدمام\tX\textra\nAHS\tAl Ahsa\tالأحساء\t', CITY)
    expect(lines).toEqual([
      { line: 1, cells: ['RUH', 'Riyadh'], error: { code: 'COLUMN_COUNT', found: 2, expected: 3 } },
      { line: 2, cells: ['JED', 'Jeddah', 'جدة', 'Y'], error: { code: 'COLUMN_COUNT', found: 4, expected: 3 } },
      { line: 3, cells: ['DMM', 'Dammam', 'الدمام', 'X', 'extra'], error: { code: 'COLUMN_COUNT', found: 5, expected: 3 } },
      { line: 4, cells: ['AHS', 'Al Ahsa', 'الأحساء', ''], error: { code: 'COLUMN_COUNT', found: 4, expected: 3 } },
    ])
  })

  it('splits CRLF and LF alike, and drops empty lines from the numbering', () => {
    const lines = parseImport('\r\nRUH\tRiyadh\tالرياض\r\n\r\nJED\tJeddah\tجدة\n\nDMM\tDammam\tالدمام\r\n', CITY)
    expect(lines.map((l) => [l.line, l.cells[0]])).toEqual([
      [1, 'RUH'],
      [2, 'JED'],
      [3, 'DMM'],
    ])
    // No carriage return is left on a last cell.
    expect(lines.every((l) => !l.error && !l.fields.cityNameAr.includes('\r'))).toBe(true)
  })

  it('keeps a header as an ordinary line, never skipped', () => {
    const lines = parseImport('CityCode\tCityNameEn\tCityNameAr\nRUH\tRiyadh\tالرياض', CITY)
    expect(lines).toHaveLength(2)
    expect(lines[0]).toMatchObject({ line: 1, action: 'upsert', fields: { cityCode: 'CityCode' } })
  })

  it('sends values as written: no trim, no upper-casing (the server does that)', () => {
    const [line] = parseImport('ruh \tRiyadh\tالرياض', CITY)
    expect(line).toMatchObject({ fields: { cityCode: 'ruh ' } })
  })

  it('reads nothing from blank text', () => {
    expect(parseImport('', CITY)).toEqual([])
    expect(parseImport('\r\n\n', CITY)).toEqual([])
  })
})

describe('sendableLines', () => {
  it('is every line in file order when none is in error', () => {
    const lines = parseImport('RUH\tRiyadh\tالرياض\nJED\tJeddah\tجدة\tX', CITY)
    expect(sendableLines(lines)?.map((l) => [l.line, l.action])).toEqual([
      [1, 'upsert'],
      [2, 'delete'],
    ])
  })

  it('is nothing while any line is in error, never the lines that read', () => {
    expect(sendableLines(parseImport('RUH\tRiyadh\tالرياض\nJED\tJeddah', CITY))).toBeNull()
  })

  it('is nothing for no line', () => {
    expect(sendableLines(parseImport('', CITY))).toBeNull()
  })
})

describe('importTally', () => {
  it('counts the lines, the upserts, the deletes and the errors', () => {
    expect(importTally(parseImport('RUH\tRiyadh\tالرياض\nJED\tJeddah\tجدة\tX\nDMM', CITY))).toEqual({
      lines: 3,
      upserts: 1,
      deletes: 1,
      errors: 1,
    })
  })
})

describe('decodeImportFile', () => {
  const utf8 = (s: string) => new TextEncoder().encode(s)
  const utf16 = (s: string, bigEndian: boolean) => {
    const bytes = bigEndian ? [0xfe, 0xff] : [0xff, 0xfe]
    for (const ch of s) {
      const c = ch.charCodeAt(0)
      bytes.push(...(bigEndian ? [c >> 8, c & 0xff] : [c & 0xff, c >> 8]))
    }
    return new Uint8Array(bytes)
  }

  it('reads UTF-8, with or without its BOM', () => {
    expect(decodeImportFile(utf8('RUH\tالرياض'))).toBe('RUH\tالرياض')
    expect(decodeImportFile(new Uint8Array([0xef, 0xbb, 0xbf, ...utf8('RUH')]))).toBe('RUH')
  })

  it('reads the Unicode text Excel saves (UTF-16 LE, by its BOM)', () => {
    expect(decodeImportFile(utf16('RUH\tالرياض', false))).toBe('RUH\tالرياض')
  })

  it('refuses bytes that are not UTF-8 (an ANSI save) rather than reading replacement characters', () => {
    // "RUH	" then الرياض in Windows-1256.
    const ansi = new Uint8Array([0x52, 0x55, 0x48, 0x09, 0xc7, 0xe1, 0xd1, 0xed, 0xc7, 0xd6])
    expect(() => decodeImportFile(ansi)).toThrow()
  })

  it('reads UTF-16 BE by its BOM', () => {
    expect(decodeImportFile(utf16('جدة', true))).toBe('جدة')
  })
})

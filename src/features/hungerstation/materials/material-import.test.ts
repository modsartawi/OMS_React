/**
 * Ticket 555 — the HungerStation material import's rows, from pasted text or a sheet (contract §
 * Materials `POST HungerStationWeb/Materials/Import`).
 *
 * The WPF import read a tab-separated sheet: a material number, then an `X` in the disabled column,
 * then an `X` in the deleted column. What these pin is what the category manager SEES before
 * sending: the rows the body will carry (X/blank and true/false as booleans), the repeats collapsed
 * with the LAST row winning (the server's own rule), every row that is not a material number
 * flagged, and the 5000 cap refused here.
 */
import { describe, expect, it } from 'vitest'
import { MATERIAL_IMPORT_MAX, parseMaterialImport } from './material-import'

describe('parseMaterialImport — the marks', () => {
  it('X marks a flag; a blank or missing cell is false — the WPF sheet as it was', () => {
    const list = parseMaterialImport('101234\tX\t\n101235\t\tX\n101236\n101237\tX\tX')
    expect(list.rows).toEqual([
      { materialNumber: '101234', disabled: true, deleted: false },
      { materialNumber: '101235', disabled: false, deleted: true },
      { materialNumber: '101236', disabled: false, deleted: false },
      { materialNumber: '101237', disabled: true, deleted: true },
    ])
    expect(list.problems).toEqual([])
  })

  it('accepts a lower-case x and true / false in any case', () => {
    const list = parseMaterialImport('101234\tx\tFALSE\n101235\ttrue\tTrue\n101236\tfalse\t')
    expect(list.rows).toEqual([
      { materialNumber: '101234', disabled: true, deleted: false },
      { materialNumber: '101235', disabled: true, deleted: true },
      { materialNumber: '101236', disabled: false, deleted: false },
    ])
  })

  it('reads commas and semicolons as the column break too, and trims every cell', () => {
    expect(parseMaterialImport(' 101234 , X ,  \n101235;;x').rows).toEqual([
      { materialNumber: '101234', disabled: true, deleted: false },
      { materialNumber: '101235', disabled: false, deleted: true },
    ])
  })

  it('🚩 a mark it cannot read is flagged with its line, never guessed', () => {
    const list = parseMaterialImport('101234\tY\n101235\t\t1')
    expect(list.problems).toEqual([
      { line: 1, value: 'Y', kind: 'mark' },
      { line: 2, value: '1', kind: 'mark' },
    ])
    expect(list.rows.map((r) => r.materialNumber)).toEqual([])
  })
})

describe('parseMaterialImport — material numbers', () => {
  it('keeps a material number as stored — leading zeros and all, never a number', () => {
    expect(parseMaterialImport('000000000000101234\n00101234').rows.map((r) => r.materialNumber)).toEqual([
      '000000000000101234',
      '00101234',
    ])
  })

  it('flags a row that is not a material number, with its line, and does not send it', () => {
    const list = parseMaterialImport('101234\nABC-12\tX\n1012 34\n1234567890123456789')
    expect(list.rows.map((r) => r.materialNumber)).toEqual(['101234'])
    expect(list.problems).toEqual([
      { line: 2, value: 'ABC-12', kind: 'material' },
      { line: 3, value: '1012 34', kind: 'material' },
      { line: 4, value: '1234567890123456789', kind: 'material' },
    ])
  })

  it('skips a first line with no digit in it as a header, and says which', () => {
    const list = parseMaterialImport('Material\tDisabled\tDeleted\n101234\tX')
    expect(list.header).toBe('Material\tDisabled\tDeleted')
    expect(list.rows).toEqual([{ materialNumber: '101234', disabled: true, deleted: false }])
    expect(list.problems).toEqual([])
  })

  it('drops blank lines; an empty paste is an empty list, not an error', () => {
    expect(parseMaterialImport('  \n\t\n')).toEqual({ rows: [], entries: 0, repeats: 0, header: null, problems: [], overBy: 0 })
    expect(parseMaterialImport('\n101234\n\n').rows).toHaveLength(1)
  })
})

describe('parseMaterialImport — repeats', () => {
  it('a repeated number counts once and its LAST row wins, kept in its first place', () => {
    const list = parseMaterialImport('101234\tX\n101235\n101234\t\tX')
    expect(list.rows).toEqual([
      { materialNumber: '101234', disabled: false, deleted: true },
      { materialNumber: '101235', disabled: false, deleted: false },
    ])
    expect(list.repeats).toBe(1)
    expect(list.entries).toBe(3)
  })
})

describe('parseMaterialImport — the 5000 cap', () => {
  const numbers = (n: number) => Array.from({ length: n }, (_, i) => String(100000 + i))

  it('is the contract’s 5000', () => {
    expect(MATERIAL_IMPORT_MAX).toBe(5000)
  })

  it('5000 rows can be sent', () => {
    const list = parseMaterialImport(numbers(5000).join('\n'))
    expect(list.rows).toHaveLength(5000)
    expect(list.overBy).toBe(0)
  })

  it('5001 are refused — reported, never truncated', () => {
    const list = parseMaterialImport(numbers(5001).join('\n'))
    expect(list.overBy).toBe(1)
    expect(list.rows).toHaveLength(5001)
  })

  it('counts the rows the body would carry — repeats collapsed', () => {
    expect(parseMaterialImport([...numbers(5000), ...numbers(10)].join('\n')).overBy).toBe(0)
  })
})

describe('parseMaterialImport — a sheet', () => {
  it('reads the first three columns of each row, a header row skipped, blank rows dropped', () => {
    const list = parseMaterialImport([['Material', 'Disabled', 'Deleted'], [' 101234 ', 'X', ''], [], ['', ''], ['101235', '', 'x', 'a note']])
    expect(list.header).toBe('Material')
    expect(list.rows).toEqual([
      { materialNumber: '101234', disabled: true, deleted: false },
      { materialNumber: '101235', disabled: false, deleted: true },
    ])
  })

  it('numbers a problem by its sheet row', () => {
    expect(parseMaterialImport([['Material'], ['101234'], ['Panadol']]).problems).toEqual([{ line: 3, value: 'Panadol', kind: 'material' }])
  })
})

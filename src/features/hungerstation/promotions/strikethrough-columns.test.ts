/**
 * Ticket 666 — a strikethrough's items, pasted from Excel or read from a `.tsv` / `.txt`, by the
 * spec 3201 column spec `Material, Subtype, Value, MaxQty`.
 */
import { describe, expect, it } from 'vitest'
import { readStrikethrough, STRIKETHROUGH_COLUMNS } from './strikethrough-columns'

const tsv = (...rows: string[][]) => rows.map((r) => r.join('\t')).join('\r\n')

describe('readStrikethrough', () => {
  it('reads the spec columns in order', () => {
    expect(STRIKETHROUGH_COLUMNS).toEqual(['material', 'subtype', 'value', 'maxQuantity'])
  })

  it('reads a row into the body item: our material number, subtype, value, max quantity', () => {
    const read = readStrikethrough(tsv(['101001', 'PERCENTAGE', '25', '3']))
    expect(read.items).toEqual([
      { materialNumber: '101001', subtype: 'PERCENTAGE', value: 25, maxQuantity: 3, buyQuantity: null, getQuantity: null },
    ])
    expect(read.header).toBeNull()
  })

  it('skips a header row (a first line with no digit) and says which', () => {
    const read = readStrikethrough(tsv(['Material', 'Subtype', 'Value', 'MaxQty'], ['101001', 'ABSOLUTE', '5.5', '']))
    expect(read.header).toBe('Material\tSubtype\tValue\tMaxQty')
    expect(read.items.map((i) => i.materialNumber)).toEqual(['101001'])
    // The preview keeps the file's own line numbers: the data row is line 2.
    expect(read.lines.map((l) => l.line)).toEqual([2])
  })

  it('a blank subtype or value is null — it takes the header default', () => {
    const read = readStrikethrough(tsv(['101001', '', '', ''], ['101002'], ['101003', 'final price', '', '2']))
    expect(read.items).toEqual([
      { materialNumber: '101001', subtype: null, value: null, maxQuantity: null, buyQuantity: null, getQuantity: null },
      { materialNumber: '101002', subtype: null, value: null, maxQuantity: null, buyQuantity: null, getQuantity: null },
      { materialNumber: '101003', subtype: 'FINAL_PRICE', value: null, maxQuantity: 2, buyQuantity: null, getQuantity: null },
    ])
  })

  it('a repeated material keeps its LAST row, in its first place, and the repeats are counted', () => {
    const read = readStrikethrough(tsv(['101001', 'PERCENTAGE', '10', ''], ['101002', '', '', ''], ['101001', 'PERCENTAGE', '30', '1']))
    expect(read.items.map((i) => [i.materialNumber, i.value])).toEqual([
      ['101001', 30],
      ['101002', null],
    ])
    expect(read.repeats).toBe(1)
    expect(read.entries).toBe(3)
    expect(read.lines.map((l) => l.line)).toEqual([3, 2])
  })

  it('20,000 materials may be used; 20,001 are refused, none dropped', () => {
    const rows = (n: number) => Array.from({ length: n }, (_, i) => String(100000 + i)).join('\n')
    expect(readStrikethrough(rows(20000)).overBy).toBe(0)
    const over = readStrikethrough(rows(20001))
    expect(over.overBy).toBe(1)
    expect(over.items).toHaveLength(20001)
  })

  it('a non-numeric material is kept as typed, for the server to answer', () => {
    const read = readStrikethrough(tsv(['101001', '', '', ''], ['ABC-12', 'PERCENTAGE', '10', '']))
    expect(read.items.map((i) => i.materialNumber)).toEqual(['101001', 'ABC-12'])
    expect(read.lines.every((l) => !l.error)).toBe(true)
  })

  it('a cell it cannot read is flagged on its line, never guessed', () => {
    const read = readStrikethrough(tsv(['101001', 'HALF', '10', ''], ['101002', '', 'ten', ''], ['101003', '', '', '1.5'], ['101004', '', '', '', '', 'x']))
    expect(read.lines.map((l) => l.error)).toEqual([
      { code: 'CELL', column: 'subtype' },
      { code: 'CELL', column: 'value' },
      { code: 'CELL', column: 'maxQuantity' },
      { code: 'COLUMN_COUNT', found: 6, expected: 4 },
    ])
    expect(read.items).toEqual([])
  })

  it('values are sent as typed: no rounding, no range check (the server checks)', () => {
    const read = readStrikethrough(tsv(['101001', 'percentage', '150', ''], ['101002', 'Absolute', '-2.1234', '']))
    expect(read.items.map((i) => [i.subtype, i.value])).toEqual([
      ['PERCENTAGE', 150],
      ['ABSOLUTE', -2.1234],
    ])
  })

  it('blank lines are dropped, cells trimmed', () => {
    const read = readStrikethrough('\n 101001 \t PERCENTAGE \t 10 \t\n\n')
    expect(read.items).toEqual([{ materialNumber: '101001', subtype: 'PERCENTAGE', value: 10, maxQuantity: null, buyQuantity: null, getQuantity: null }])
  })
})

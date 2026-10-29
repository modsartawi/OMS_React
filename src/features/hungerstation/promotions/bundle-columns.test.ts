/**
 * Ticket 668 — a same-item bundle's items, pasted from Excel or read from a `.tsv` / `.txt`, by the
 * spec 3201 column spec `Material, Buy, Get, Subtype, Value, MaxQty`. A blank cell takes the
 * header default; buy and get are whole numbers of at least 1.
 */
import { describe, expect, it } from 'vitest'
import { BUNDLE_COLUMNS, readBundle, rowCombination } from './bundle-columns'

const tsv = (...rows: string[][]) => rows.map((r) => r.join('\t')).join('\r\n')

describe('readBundle', () => {
  it('reads the spec columns in order', () => {
    expect(BUNDLE_COLUMNS).toEqual(['material', 'buyQuantity', 'getQuantity', 'subtype', 'value', 'maxQuantity'])
  })

  it('reads a row into the body item: material, buy, get, subtype, value, max quantity', () => {
    const read = readBundle(tsv(['201001', '2', '1', 'PERCENTAGE', '50', '6']))
    expect(read.items).toEqual([{ materialNumber: '201001', buyQuantity: 2, getQuantity: 1, subtype: 'PERCENTAGE', value: 50, maxQuantity: 6 }])
  })

  it('blank cells are null in the body — each takes its header default when saved', () => {
    const read = readBundle(tsv(['201001', '', '', '', '', ''], ['201002'], ['201003', '3', '', 'final price', '', '']))
    expect(read.items).toEqual([
      { materialNumber: '201001', buyQuantity: null, getQuantity: null, subtype: null, value: null, maxQuantity: null },
      { materialNumber: '201002', buyQuantity: null, getQuantity: null, subtype: null, value: null, maxQuantity: null },
      { materialNumber: '201003', buyQuantity: 3, getQuantity: null, subtype: 'FINAL_PRICE', value: null, maxQuantity: null },
    ])
  })

  it('a blank cell reads as the header default on screen', () => {
    const read = readBundle(tsv(['201001', '', '', '', '', ''], ['201003', '3', '', 'ABSOLUTE', '', '']))
    const defaults = { buyQuantity: 2, getQuantity: 1, subtype: 'PERCENTAGE' as const, value: 50 }
    expect(read.items.map((i) => rowCombination(i, defaults))).toEqual([
      { buyQuantity: 2, getQuantity: 1, subtype: 'PERCENTAGE', value: 50 },
      { buyQuantity: 3, getQuantity: 1, subtype: 'ABSOLUTE', value: 50 },
    ])
    // No default either: still blank.
    expect(rowCombination(read.items[0], { buyQuantity: null, getQuantity: null, subtype: 'PERCENTAGE', value: null })).toEqual({
      buyQuantity: null,
      getQuantity: null,
      subtype: 'PERCENTAGE',
      value: null,
    })
  })

  it('buy-one-get-one-free reads as 1, 1, PERCENTAGE, 100', () => {
    const read = readBundle(tsv(['Material', 'Buy', 'Get', 'Subtype', 'Value', 'MaxQty'], ['201009', '1', '1', 'PERCENTAGE', '100', '']))
    expect(read.header).toBe('Material\tBuy\tGet\tSubtype\tValue\tMaxQty')
    expect(read.items).toEqual([{ materialNumber: '201009', buyQuantity: 1, getQuantity: 1, subtype: 'PERCENTAGE', value: 100, maxQuantity: null }])
  })

  it('a buy or get under 1, or not a whole number, is flagged on its line — never guessed', () => {
    const read = readBundle(tsv(['201001', '0', '1', '', '', ''], ['201002', '2', '0', '', '', ''], ['201003', '1.5', '1', '', '', ''], ['201004', '2', '-1', '', '', ''], ['201005', '2', '1', '', '', '']))
    expect(read.items.map((i) => i.materialNumber)).toEqual(['201005'])
    expect(read.lines.filter((l) => 'error' in l).map((l) => [l.line, 'error' in l ? l.error : null])).toEqual([
      [1, { code: 'CELL', column: 'buyQuantity' }],
      [2, { code: 'CELL', column: 'getQuantity' }],
      [3, { code: 'CELL', column: 'buyQuantity' }],
      [4, { code: 'CELL', column: 'getQuantity' }],
    ])
  })

  it('an unreadable subtype or value is flagged too, and a line past six columns', () => {
    const read = readBundle(tsv(['201001', '2', '1', 'HALF', '', ''], ['201002', '2', '1', '', 'x', ''], ['201003', '2', '1', '', '', '', 'extra']))
    expect(read.items).toEqual([])
    expect(read.lines.map((l) => ('error' in l ? l.error : null))).toEqual([
      { code: 'CELL', column: 'subtype' },
      { code: 'CELL', column: 'value' },
      { code: 'COLUMN_COUNT', found: 7, expected: 6 },
    ])
  })

  it('a repeated material keeps its LAST row, counted; past the cap is reported, never truncated', () => {
    const read = readBundle(tsv(['201001', '2', '1', '', '', ''], ['201002', '1', '1', '', '', ''], ['201001', '3', '1', '', '', '']), 1)
    expect(read.items.map((i) => [i.materialNumber, i.buyQuantity])).toEqual([
      ['201001', 3],
      ['201002', 1],
    ])
    expect([read.repeats, read.overBy]).toEqual([1, 1])
  })
})

import { describe, expect, it } from 'vitest'
import {
  MAX_BASKET_LINES,
  MAX_QTY,
  addToBasket,
  overflowsQty,
  checkBasketRow,
  csvVerdict,
  parseBasketCsv,
  parseQty,
  removeLine,
  setQty,
  takeRows,
  type BasketLine,
} from './basket'

describe('parseBasketCsv', () => {
  it('basketCsv_parsesSkuQty_andFlagsBadRows', () => {
    const rows = parseBasketCsv('sku,qty\nsun-50,2\n SER-VC , \n,3\nAMOX-500,0\nDIA-4,1.5\nWIP-80,abc\n\nPAN-24,4')
    expect(rows).toEqual([
      { line: 2, sku: 'SUN-50', qty: 2, problem: null },
      { line: 3, sku: 'SER-VC', qty: 1, problem: null },
      { line: 4, sku: '', qty: 3, problem: 'noSku' },
      { line: 5, sku: 'AMOX-500', qty: null, problem: 'badQty' },
      { line: 6, sku: 'DIA-4', qty: null, problem: 'badQty' },
      { line: 7, sku: 'WIP-80', qty: null, problem: 'badQty' },
      { line: 9, sku: 'PAN-24', qty: 4, problem: null },
    ])
  })

  it('reads a file with no header as sku, qty', () => {
    expect(parseBasketCsv('SUN-50,2\r\nSER-VC')).toEqual([
      { line: 1, sku: 'SUN-50', qty: 2, problem: null },
      { line: 2, sku: 'SER-VC', qty: 1, problem: null },
    ])
  })

  it('finds the columns by a header alias, in any order, and ignores the others', () => {
    expect(parseBasketCsv('Name,Quantity,Material\nSunblock,3,SUN-50')).toEqual([{ line: 2, sku: 'SUN-50', qty: 3, problem: null }])
    expect(parseBasketCsv('item;units\nSER-VC;2')).toEqual([{ line: 2, sku: 'SER-VC', qty: 2, problem: null }])
    expect(parseBasketCsv('ITEM\nSER-VC')).toEqual([{ line: 2, sku: 'SER-VC', qty: 1, problem: null }])
  })

  it('takes a semicolon or a tab file, quotes and a byte-order mark', () => {
    expect(parseBasketCsv('﻿SUN-50;2')).toEqual([{ line: 1, sku: 'SUN-50', qty: 2, problem: null }])
    expect(parseBasketCsv('SUN-50\t2')).toEqual([{ line: 1, sku: 'SUN-50', qty: 2, problem: null }])
    expect(parseBasketCsv('"SUN-50","2"\n"A,""B",1')).toEqual([
      { line: 1, sku: 'SUN-50', qty: 2, problem: null },
      { line: 2, sku: 'A,"B', qty: 1, problem: null },
    ])
  })

  it('skips blank lines and lines of only separators, keeping the file line numbers', () => {
    expect(parseBasketCsv('\n , \nSUN-50,1\n')).toEqual([{ line: 3, sku: 'SUN-50', qty: 1, problem: null }])
    expect(parseBasketCsv('')).toEqual([])
  })

  it('flags a quantity above the cap and every row past the line cap', () => {
    expect(parseBasketCsv(`SUN-50,${MAX_QTY + 1}`)[0].problem).toBe('badQty')
    const many = Array.from({ length: MAX_BASKET_LINES + 2 }, (_, i) => `S${i},1`).join('\n')
    const rows = parseBasketCsv(many)
    expect(rows.filter((r) => r.problem === 'tooMany').map((r) => r.line)).toEqual([MAX_BASKET_LINES + 1, MAX_BASKET_LINES + 2])
    // A repeated SKU merges into its line, so it never counts toward the cap.
    const repeats = parseBasketCsv(Array.from({ length: MAX_BASKET_LINES * 2 }, (_, i) => `S${i % 5},1`).join('\n'))
    expect(repeats.some((r) => r.problem)).toBe(false)
  })
})

describe('checkBasketRow and csvVerdict', () => {
  const ok = { line: 1, sku: 'SUN-50', qty: 2, problem: null }

  it('a well-formed row is good only once HQ found its SKU', () => {
    expect(checkBasketRow(ok, { state: 'found', code: 'sun-50', name: 'Sunblock' })).toEqual({ status: 'ok', code: 'sun-50', name: 'Sunblock' })
    expect(checkBasketRow(ok, { state: 'missing' })).toEqual({ status: 'bad', problem: 'unknownSku' })
    expect(checkBasketRow(ok, { state: 'checking' })).toEqual({ status: 'checking' })
    expect(checkBasketRow(ok, undefined)).toEqual({ status: 'checking' })
    expect(checkBasketRow(ok, { state: 'failed' })).toEqual({ status: 'failed' })
  })

  it('a malformed row is bad whatever the lookup says', () => {
    expect(checkBasketRow({ line: 1, sku: 'X', qty: null, problem: 'badQty' }, { state: 'found', code: 'X', name: 'X' })).toEqual({ status: 'bad', problem: 'badQty' })
  })

  it('the rows may be used only when every one is good', () => {
    expect(csvVerdict([{ status: 'ok', code: 'A', name: 'a' }, { status: 'ok', code: 'B', name: 'b' }])).toEqual({ ok: 2, bad: 0, waiting: 0, usable: true })
    expect(csvVerdict([{ status: 'ok', code: 'A', name: 'a' }, { status: 'bad', problem: 'noSku' }]).usable).toBe(false)
    expect(csvVerdict([{ status: 'ok', code: 'A', name: 'a' }, { status: 'checking' }])).toEqual({ ok: 1, bad: 0, waiting: 1, usable: false })
    expect(csvVerdict([{ status: 'failed' }]).usable).toBe(false)
    expect(csvVerdict([]).usable).toBe(false)
  })
})

describe('the typed basket', () => {
  const basket: BasketLine[] = [
    { sku: 'SUN-50', name: 'Sunblock', qty: 2 },
    { sku: 'SER-VC', name: 'Serum', qty: 1 },
  ]

  it('adding a SKU already in the basket adds to its quantity, a new one goes last', () => {
    expect(addToBasket(basket, { sku: 'SUN-50', name: 'Sunblock', qty: 1 })[0].qty).toBe(3)
    expect(addToBasket(basket, { sku: 'DIA-4', name: 'Diapers', qty: 1 }).map((l) => l.sku)).toEqual(['SUN-50', 'SER-VC', 'DIA-4'])
    expect(addToBasket([{ sku: 'A', name: 'a', qty: MAX_QTY }], { sku: 'A', name: 'a', qty: 5 })[0].qty).toBe(MAX_QTY)
  })

  it('a quantity is set, kept to 1…cap, and a line removed', () => {
    expect(setQty(basket, 'SER-VC', 4)[1].qty).toBe(4)
    expect(setQty(basket, 'SER-VC', 0)[1].qty).toBe(1)
    expect(setQty(basket, 'SER-VC', MAX_QTY + 9)[1].qty).toBe(MAX_QTY)
    expect(removeLine(basket, 'SUN-50').map((l) => l.sku)).toEqual(['SER-VC'])
  })

  it('a typed quantity is a whole number from 1', () => {
    expect(parseQty('3')).toBe(3)
    expect(parseQty(' 12 ')).toBe(12)
    expect(parseQty('')).toBeNull()
    expect(parseQty('0')).toBeNull()
    expect(parseQty('2.5')).toBeNull()
    expect(parseQty('-1')).toBeNull()
  })

  it('rows that would sum a SKU past the cap are refused, not clamped', () => {
    const big = [{ sku: 'SUN-50', name: 'Sunblock', qty: MAX_QTY - 1 }]
    expect(overflowsQty(basket, big, 'add')).toBe(true)
    expect(overflowsQty(basket, big, 'replace')).toBe(false)
    expect(overflowsQty([], [...big, ...big], 'replace')).toBe(true)
  })

  it('CSV rows replace the basket or add to it, merging repeats', () => {
    const rows = [
      { sku: 'SER-VC', name: 'Serum', qty: 2 },
      { sku: 'DIA-4', name: 'Diapers', qty: 1 },
      { sku: 'DIA-4', name: 'Diapers', qty: 1 },
    ]
    expect(takeRows(basket, rows, 'replace')).toEqual([
      { sku: 'SER-VC', name: 'Serum', qty: 2 },
      { sku: 'DIA-4', name: 'Diapers', qty: 2 },
    ])
    expect(takeRows(basket, rows, 'add')).toEqual([
      { sku: 'SUN-50', name: 'Sunblock', qty: 2 },
      { sku: 'SER-VC', name: 'Serum', qty: 3 },
      { sku: 'DIA-4', name: 'Diapers', qty: 2 },
    ])
  })
})

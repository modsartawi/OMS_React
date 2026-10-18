import { describe, expect, it } from 'vitest'
import {
  MAX_QTY,
  addToBasket,
  cartLines,
  categoryOf,
  fileUsable,
  invariantNumber,
  parsePrice,
  parseQty,
  priceFits,
  readBasketFile,
  removeLine,
  roundTo,
  setPrice,
  setQty,
  type BasketLine,
} from './basket'

describe('readBasketFile (HQ\'s BasketCsv rules)', () => {
  it('basketCsv_readsHqColumns_andFlagsBadLinesByFileLine', () => {
    const file = readBasketFile('line,article,quantity,net,category,vatRate\n1,BEA-1,1,45.99,A002,15\n\n2,,2,61.03\n3,RX-1,0,20\n4,X,abc,1\n5,Y,1,\n6,Z,1,2,A002,high\n1.5,W,1,1')
    expect(file.problem).toBeNull()
    expect(file.rows.map((r) => [r.line, r.article, r.problems])).toEqual([
      [2, 'BEA-1', []],
      [4, '', ['noArticle']],
      [5, 'RX-1', ['quantityNotPositive']],
      [6, 'X', ['badQuantity']],
      [7, 'Y', ['badNet']],
      [8, 'Z', ['badVatRate']],
      [9, 'W', ['badLine']],
    ])
    expect(file.rows[0]).toEqual({ line: 2, article: 'BEA-1', quantity: 1, net: 45.99, category: 'A002', problems: [] })
    expect(fileUsable(file)).toBe(false)
  })

  it('finds the columns by HQ\'s names in any order and case, the optional ones blank', () => {
    const file = readBasketFile('﻿Net,SKU,Qty,Fee,Gross\r\n12.50,SUN-50,2,TRUE,\r\n9.75,PAN-24,1,,')
    expect(file.rows.map((r) => [r.article, r.quantity, r.net, r.problems])).toEqual([
      ['SUN-50', 2, 12.5, []],
      ['PAN-24', 1, 9.75, []],
    ])
    expect(fileUsable(file)).toBe(true)
    expect(readBasketFile('material,quantity,net\nA,1,1').rows[0].problems).toEqual([])
    expect(readBasketFile('article,qty,net,fee\nA,1,1,maybe').rows[0].problems).toEqual(['badFee'])
  })

  it('a header without article, quantity and net, or no cart line, is refused whole', () => {
    expect(readBasketFile('sku,qty\nSUN-50,2').problem).toBe('header')
    expect(readBasketFile('SUN-50,2,10\nSER-VC,1,5').problem).toBe('header')
    expect(readBasketFile('article,quantity,net\n\n').problem).toBe('empty')
    expect(readBasketFile('').problem).toBe('empty')
    expect(fileUsable(readBasketFile(''))).toBe(false)
  })

  it('reads a figure as .NET\'s NumberStyles.Number does: a sign before or after, never both', () => {
    expect([invariantNumber('12.50'), invariantNumber('-3'), invariantNumber('5-'), invariantNumber('+.5'), invariantNumber('-5-'), invariantNumber('1e3'), invariantNumber('')]).toEqual([
      12.5, -3, -5, 0.5, null, null, null,
    ])
    expect(readBasketFile('article,quantity,net\nA,1,5-').rows[0]).toMatchObject({ net: -5, problems: [] })
  })

  it('splits on commas only, as HQ does (a semicolon file has no columns)', () => {
    expect(readBasketFile('article;quantity;net\nA;1;1').problem).toBe('header')
  })
})

describe('the typed basket', () => {
  const basket: BasketLine[] = [
    { sku: 'SUN-50', name: 'Sunblock', category: 'A002', qty: 2, price: 55 },
    { sku: 'SER-VC', name: 'Serum', category: 'A002', qty: 1, price: null },
  ]

  it('adding a SKU already in the basket adds to its quantity and keeps its price; a new one goes last', () => {
    const more = addToBasket(basket, { sku: 'SUN-50', name: 'Sunblock', category: 'A002', qty: 1, price: null })
    expect([more[0].qty, more[0].price]).toEqual([3, 55])
    expect(addToBasket(basket, { sku: 'DIA-4', name: 'Diapers', category: 'A003', qty: 1, price: null }).map((l) => l.sku)).toEqual(['SUN-50', 'SER-VC', 'DIA-4'])
    expect(addToBasket([{ ...basket[0], qty: MAX_QTY }], { ...basket[0], qty: 5 })[0].qty).toBe(MAX_QTY)
  })

  it('a quantity is set, kept to 1…cap, a price set, and a line removed', () => {
    expect(setQty(basket, 'SER-VC', 4)[1].qty).toBe(4)
    expect(setQty(basket, 'SER-VC', 0)[1].qty).toBe(1)
    expect(setQty(basket, 'SER-VC', MAX_QTY + 9)[1].qty).toBe(MAX_QTY)
    expect(setPrice(basket, 'SER-VC', 89)[1].price).toBe(89)
    expect(removeLine(basket, 'SUN-50').map((l) => l.sku)).toEqual(['SER-VC'])
  })

  it('a typed quantity is a whole number from 1; a price a plain figure at the currency\'s decimals', () => {
    expect([parseQty('3'), parseQty(' 12 '), parseQty(''), parseQty('0'), parseQty('2.5'), parseQty('-1')]).toEqual([3, 12, null, null, null, null])
    expect([parsePrice('55', 2), parsePrice('0', 2), parsePrice('9.75', 2), parsePrice('9.755', 2), parsePrice('9.755', 3), parsePrice('-1', 2), parsePrice('', 2), parsePrice('1e3', 2)]).toEqual([
      55, 0, 9.75, null, 9.755, null, null, null,
    ])
  })

  it('the category is the first word of HQ\'s materials detail', () => {
    expect([categoryOf('A002 Beauty'), categoryOf('A006'), categoryOf(null), categoryOf('  ')]).toEqual(['A002', 'A006', '', ''])
  })

  it('cart lines are numbered in basket order, net = price × quantity at the decimals; none while a price is missing', () => {
    expect(cartLines(basket, 2)).toBeNull()
    const lines = cartLines(setPrice(basket, 'SER-VC', 89.995), 3)!
    expect(lines.map((l) => [l.lineNumber, l.article, l.quantity, l.netBeforePromotion, l.gross, l.category])).toEqual([
      [1, 'SUN-50', 2, 110, 110, 'A002'],
      [2, 'SER-VC', 1, 89.995, 89.995, 'A002'],
    ])
    expect(cartLines([], 2)).toEqual([])
  })

  it('a price typed at three places holds the run back once the sale is at two — never rounded silently', () => {
    const bh = [{ sku: 'A', name: 'a', category: 'A002', qty: 1, price: 1.255 }]
    expect(cartLines(bh, 3)?.[0].netBeforePromotion).toBe(1.255)
    expect(cartLines(bh, 2)).toBeNull()
    expect([priceFits(1.255, 2), priceFits(1.25, 2), priceFits(null, 2), priceFits(0, 2)]).toEqual([false, true, false, true])
  })

  it('rounds half away from zero', () => {
    expect([roundTo(1.005, 2), roundTo(2.675, 2), roundTo(-1.005, 2), roundTo(0.1 + 0.2, 2)]).toEqual([1.01, 2.68, -1.01, 0.3])
  })
})

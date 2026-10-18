// The simulator's basket (tickets 514, 525): typed line by line, or a CSV file HQ reads itself
// (`Rules/Authoring/Simulate`'s `csv`). Pure: text in, rows out; no `t`, no DOM, no api.
//
// A typed line is a material HQ's lookup found, its category (the lookup's `detail`), a whole
// quantity and the price the author gives it: HQ prices nothing in a dry run, the cart line carries
// its own net. The file is read here only as a pre-check, by HQ's own rules (BackOffice
// `RuleBuilderService.BasketCsv`), so a bad line is shown before the run; HQ still reads it, and its
// `RULES_BAD_BASKET` wins.

import type { RuleCartLine } from '@/core/models/rule-session'

/** A basket line as the page holds it. `price` is one unit's price before promotions, in the sale's
 *  currency; null until the author types one. */
export interface BasketLine {
  sku: string
  name: string
  /** The material's category code (A002…): what a campaign's filters match. */
  category: string
  qty: number
  price: number | null
}

/** The most lines a typed basket takes, and the most units on one line. */
export const MAX_BASKET_LINES = 100
export const MAX_QTY = 9999

/** A typed or written quantity: a whole number from 1 to MAX_QTY, or null. */
export function parseQty(text: string): number | null {
  const s = text.trim()
  if (!/^\d+$/.test(s)) return null
  const n = Number(s)
  return n >= 1 && n <= MAX_QTY ? n : null
}

/** A typed price: a plain figure from 0 with at most `decimals` places, or null. */
export function parsePrice(text: string, decimals: number): number | null {
  const s = text.trim()
  const m = /^(\d+)(?:\.(\d+))?$/.exec(s)
  if (!m || (m[2]?.length ?? 0) > decimals) return null
  return Number(s)
}

/** Whether a price kept from before still reads at `decimals` places (the country, and so the
 *  currency, may have changed since it was typed). */
export const priceFits = (price: number | null, decimals: number): boolean => price !== null && parsePrice(String(price), decimals) !== null

/** The category code of HQ's materials lookup `detail` ("A002 Beauty"): its first word. */
export function categoryOf(detail: string | null): string {
  return (detail ?? '').trim().split(/\s+/)[0] ?? ''
}

const capQty = (n: number) => Math.min(MAX_QTY, Math.max(1, Math.trunc(n)))

/** A line added: to the quantity of the same SKU, or last as a new line. */
export function addToBasket(basket: readonly BasketLine[], line: BasketLine): BasketLine[] {
  const at = basket.findIndex((l) => l.sku === line.sku)
  if (at < 0) return [...basket, { ...line, qty: capQty(line.qty) }]
  return basket.map((l, i) => (i === at ? { ...l, qty: capQty(l.qty + line.qty) } : l))
}

export function setQty(basket: readonly BasketLine[], sku: string, qty: number): BasketLine[] {
  return basket.map((l) => (l.sku === sku ? { ...l, qty: capQty(qty) } : l))
}

export function setPrice(basket: readonly BasketLine[], sku: string, price: number | null): BasketLine[] {
  return basket.map((l) => (l.sku === sku ? { ...l, price } : l))
}

export function removeLine(basket: readonly BasketLine[], sku: string): BasketLine[] {
  return basket.filter((l) => l.sku !== sku)
}

/** A figure at `decimals` places, half away from zero. */
export function roundTo(n: number, decimals: number): number {
  const f = 10 ** decimals
  return Math.round((Math.abs(n) + Number.EPSILON) * f) / f * Math.sign(n)
}

/**
 * The typed basket as the `evaluate` request's cart lines, numbered from 1 in basket order; null
 * while a line has no price, or one with more places than the currency has (never rounded silently). A line's net is its price × quantity at the currency's decimals; gross
 * is the net and the VAT rate 0, as HQ's CSV reads a file that does not say (a dry run's VAT changes
 * no effect).
 */
export function cartLines(basket: readonly BasketLine[], decimals: number): RuleCartLine[] | null {
  if (basket.some((l) => !priceFits(l.price, decimals))) return null
  return basket.map((l, i) => {
    const net = roundTo((l.price ?? 0) * l.qty, decimals)
    return {
      lineNumber: i + 1,
      article: l.sku,
      quantity: l.qty,
      unit: 'EA',
      baseUnitQuantity: l.qty,
      gross: net,
      netBeforePromotion: net,
      vatRate: 0,
      category: l.category,
      fee: false,
      attributes: {},
    }
  })
}

// ── The CSV file, by HQ's rules ──────────────────────────────────────────────────────────────

/** Why a file cannot be read at all: no cart line under its header, or a header that does not name
 *  article, quantity and net. */
export type BasketFileProblem = 'empty' | 'header'

/** Why one line of the file is refused (HQ refuses each, by its file line). */
export type BasketRowProblem = 'noArticle' | 'badQuantity' | 'quantityNotPositive' | 'badNet' | 'badGross' | 'badVatRate' | 'badLine' | 'badFee'

export interface BasketFileRow {
  /** 1-based line of the file, blank lines counted, as HQ names it. */
  line: number
  article: string
  quantity: number | null
  net: number | null
  category: string
  problems: BasketRowProblem[]
}

export interface BasketFile {
  problem: BasketFileProblem | null
  rows: BasketFileRow[]
}

/** An invariant figure as .NET's `NumberStyles.Number` reads one once split on commas: a sign before
 *  or after (not both), digits, a decimal point. Null when it is not one. */
export function invariantNumber(cell: string): number | null {
  const m = /^([+-]?)(\d+(?:\.\d*)?|\.\d+)([+-]?)$/.exec(cell)
  if (!m || (m[1] && m[3])) return null
  return Number(`${m[1] || m[3]}${m[2]}`)
}

/**
 * A basket file read the way HQ reads it: comma-separated, a header line first naming the columns in
 * any order and case — `article` (or `material`, `sku`), `quantity` (or `qty`) and `net` required;
 * `line` (or `linenumber`), `unit`, `gross`, `vatRate` (or `vat`), `category`, `fee` optional — then
 * one cart line per line. Invariant numbers (`12.50`); blank lines skipped, but counted.
 */
export function readBasketFile(text: string): BasketFile {
  const rows = text
    .replace(/^﻿/, '')
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((t, i) => ({ text: t.trim(), line: i + 1 }))
    .filter((r) => r.text.length > 0)
  if (rows.length < 2) return { problem: 'empty', rows: [] }

  const header = rows[0].text.split(',').map((h) => h.trim().toLowerCase())
  const col = (...names: string[]) => header.findIndex((h) => names.includes(h))
  const article = col('article', 'material', 'sku')
  const quantity = col('quantity', 'qty')
  const net = col('net')
  const lineNo = col('line', 'linenumber')
  const gross = col('gross')
  const vat = col('vatrate', 'vat')
  const category = col('category')
  const fee = col('fee')
  if (article < 0 || quantity < 0 || net < 0) return { problem: 'header', rows: [] }

  return {
    problem: null,
    rows: rows.slice(1).map(({ text: t, line }) => {
      const cells = t.split(',').map((c) => c.trim())
      const cell = (i: number) => (i >= 0 && i < cells.length ? cells[i] : '')
      const num = (i: number) => invariantNumber(cell(i))
      const optional = (i: number) => cell(i) === '' || invariantNumber(cell(i)) !== null
      const problems: BasketRowProblem[] = []
      if (cell(article) === '') problems.push('noArticle')
      const qty = num(quantity)
      if (qty === null) problems.push('badQuantity')
      else if (qty <= 0) problems.push('quantityNotPositive')
      const lineNet = num(net)
      if (lineNet === null) problems.push('badNet')
      if (!optional(gross)) problems.push('badGross')
      if (!optional(vat)) problems.push('badVatRate')
      if (cell(lineNo) !== '') {
        const n = num(lineNo)
        if (n === null || !Number.isInteger(n) || n < 1 || n > 2147483647) problems.push('badLine')
      }
      if (!['', 'true', 'false', '1', '0'].includes(cell(fee).toLowerCase())) problems.push('badFee')
      return { line, article: cell(article), quantity: qty, net: lineNet, category: cell(category), problems }
    }),
  }
}

/** Whether the file may be the basket: it reads, and every line of it is good — never a silent
 *  subset. */
export function fileUsable(file: BasketFile): boolean {
  return file.problem === null && file.rows.length > 0 && file.rows.every((r) => r.problems.length === 0)
}

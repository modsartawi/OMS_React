// The simulator's basket (ticket 514): typed line by line, or read from a CSV that is checked row by
// row before it is used. Pure: text in, rows out; no `t`, no DOM, no api. Whether a SKU exists is
// HQ's answer (the materials lookup), handed in as a `SkuCheck`.

/** A basket line as the page holds it: the SKU, the name HQ's lookup gave it, a whole quantity. */
export interface BasketLine {
  sku: string
  name: string
  qty: number
}

/** The most lines a basket takes, and the most units on one line. */
export const MAX_BASKET_LINES = 100
export const MAX_QTY = 9999

/** Why a CSV row cannot be used as it is written. */
export type BasketRowProblem = 'noSku' | 'badQty' | 'tooMany'

export interface BasketCsvRow {
  /** 1-based line of the file (blank lines and the header count), so the reader can find it. */
  line: number
  /** Trimmed and upper-cased, as SKUs are kept. */
  sku: string
  /** A blank quantity reads 1; null when it is not a whole number in 1…MAX_QTY. */
  qty: number | null
  problem: BasketRowProblem | null
}

const SKU_HEADERS = ['sku', 'item', 'material', 'code']
const QTY_HEADERS = ['qty', 'quantity', 'units']

/** The separator of a file, read from its first line: a tab, a semicolon (with no comma) or a comma. */
function separatorOf(first: string): string {
  if (first.includes('\t')) return '\t'
  if (first.includes(';') && !first.includes(',')) return ';'
  return ','
}

/** One line's cells; a quoted cell may hold the separator and `""` for a quote. */
function cellsOf(line: string, sep: string): string[] {
  const cells: string[] = []
  let cell = ''
  let quoted = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        cell += '"'
        i++
      } else if (ch === '"') quoted = false
      else cell += ch
    } else if (ch === '"' && cell.trim() === '') {
      cell = ''
      quoted = true
    } else if (ch === sep) {
      cells.push(cell.trim())
      cell = ''
    } else cell += ch
  }
  cells.push(cell.trim())
  return cells
}

/** A typed or written quantity: a whole number from 1 to MAX_QTY, or null. */
export function parseQty(text: string): number | null {
  const s = text.trim()
  if (!/^\d+$/.test(s)) return null
  const n = Number(s)
  return n >= 1 && n <= MAX_QTY ? n : null
}

/**
 * A pasted or uploaded basket's rows. A header is optional: a first line naming a SKU column
 * (`sku`, `item`, `material`, `code`) places the columns by name (`qty`, `quantity`, `units` for the
 * quantity), and any other column is ignored; with no header the columns are SKU, then quantity.
 * Blank lines are skipped. A row bringing a new SKU past MAX_BASKET_LINES distinct SKUs is flagged
 * rather than dropped (a repeated SKU merges into its line, so it never counts twice).
 */
export function parseBasketCsv(text: string): BasketCsvRow[] {
  const lines = text.replace(/^﻿/, '').split(/\r?\n/)
  const firstAt = lines.findIndex((l) => l.trim() !== '')
  if (firstAt < 0) return []
  const sep = separatorOf(lines[firstAt])

  let skuAt = 0
  let qtyAt = 1
  let from = 0
  const head = cellsOf(lines[firstAt], sep).map((c) => c.toLowerCase())
  const named = head.findIndex((c) => SKU_HEADERS.includes(c))
  if (named >= 0) {
    skuAt = named
    qtyAt = head.findIndex((c) => QTY_HEADERS.includes(c))
    from = firstAt + 1
  }

  const rows: BasketCsvRow[] = []
  const distinct = new Set<string>()
  for (let i = from; i < lines.length; i++) {
    const cells = cellsOf(lines[i], sep)
    if (cells.every((c) => c === '')) continue
    const sku = (cells[skuAt] ?? '').toUpperCase()
    const rawQty = qtyAt >= 0 ? (cells[qtyAt] ?? '') : ''
    const qty = rawQty === '' ? 1 : parseQty(rawQty)
    const tooMany = !!sku && !distinct.has(sku) && distinct.size >= MAX_BASKET_LINES
    if (sku && !tooMany) distinct.add(sku)
    const problem: BasketRowProblem | null = tooMany ? 'tooMany' : !sku ? 'noSku' : qty === null ? 'badQty' : null
    rows.push({ line: i + 1, sku, qty, problem })
  }
  return rows
}

/** HQ's answer on one SKU: still asking, found (with its name), not found, or the lookup failed. */
export type SkuCheck = { state: 'checking' } | { state: 'found'; code: string; name: string } | { state: 'missing' } | { state: 'failed' }

export type BasketRowCheck =
  /** `code` is the SKU as HQ keeps it, which the basket takes. */
  | { status: 'ok'; code: string; name: string }
  | { status: 'bad'; problem: BasketRowProblem | 'unknownSku' }
  | { status: 'checking' }
  | { status: 'failed' }

/** A row's verdict: its own problem first, then whether HQ knows its SKU. */
export function checkBasketRow(row: BasketCsvRow, sku: SkuCheck | undefined): BasketRowCheck {
  if (row.problem) return { status: 'bad', problem: row.problem }
  if (!sku || sku.state === 'checking') return { status: 'checking' }
  if (sku.state === 'failed') return { status: 'failed' }
  if (sku.state === 'missing') return { status: 'bad', problem: 'unknownSku' }
  return { status: 'ok', code: sku.code, name: sku.name }
}

/** The preview's tally. The rows are used only when there is one at least and every one is good —
 *  never a silent subset. */
export function csvVerdict(checks: readonly BasketRowCheck[]) {
  let ok = 0
  let bad = 0
  let waiting = 0
  for (const c of checks) {
    if (c.status === 'ok') ok++
    else if (c.status === 'bad') bad++
    else waiting++
  }
  return { ok, bad, waiting, usable: ok > 0 && ok === checks.length }
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

export function removeLine(basket: readonly BasketLine[], sku: string): BasketLine[] {
  return basket.filter((l) => l.sku !== sku)
}

/** Whether taking the rows would sum a SKU past MAX_QTY — refused, never clamped silently. */
export function overflowsQty(basket: readonly BasketLine[], rows: readonly BasketLine[], mode: 'replace' | 'add'): boolean {
  const sums = new Map<string, number>()
  for (const l of [...(mode === 'add' ? basket : []), ...rows]) sums.set(l.sku, (sums.get(l.sku) ?? 0) + l.qty)
  return [...sums.values()].some((n) => n > MAX_QTY)
}

/** Checked CSV rows into the basket: replacing it, or added to it; a repeated SKU adds up. */
export function takeRows(basket: readonly BasketLine[], rows: readonly BasketLine[], mode: 'replace' | 'add'): BasketLine[] {
  return rows.reduce<BasketLine[]>((b, r) => addToBasket(b, r), mode === 'replace' ? [] : [...basket])
}

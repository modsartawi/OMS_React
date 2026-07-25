import { describe, expect, it } from 'vitest'
import { isDiscountFlagged, lineTotals, totalsFooterRow } from './items'
import { DOCUMENT_NUMBERS, PAYLOADS, type CapturedDocumentNo } from './__fixtures__/payloads'
import documentEn from '@/locales/en/document.json'

/**
 * The real `document` namespace, resolved the way `t('items.totals', …)` does —
 * same helper as `rail.test.ts`, and for the same reason: a key deleted from the
 * shipped JSON fails here instead of rendering raw to an operator.
 */
const t = (key: string, options?: Record<string, unknown>): string => {
  // The plural suffix i18next would pick, so the shipped `_one` / `_other` pair
  // is what these assertions read — the footer label is the one string on this
  // screen whose grammar changes with the data.
  const resolved =
    typeof options?.count === 'number' ? `${key}_${options.count === 1 ? 'one' : 'other'}` : key
  const value = resolved
    .split('.')
    .reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], documentEn)
  if (typeof value !== 'string') throw new Error(`missing document namespace key: ${resolved}`)
  return value.replace(/{{(\w+)}}/g, (_, name: string) => String(options?.[name] ?? ''))
}

describe('totalsReducer', () => {
  // Computed from the five captures in `.issues/assets/078-document-payloads/`.
  // Every corpus document carries exactly one line — including `2000000551`,
  // whose single line holds the only non-zero discount in the corpus (-1.5).
  const EXPECTED: Record<CapturedDocumentNo, [number, number, number, number, number]> = {
    '2000000551': [1, 1, 5.7, 0, 5.7],
    '8000000121': [1, 2, 79.22, 23.76, 102.98],
    '8000000174': [1, 2, 79.22, 11.88, 91.1],
    '8000000253': [1, 1, 242, 0, 242],
    '9000000003': [1, 1, 75, 11.25, 86.25],
  }

  it.each(DOCUMENT_NUMBERS)('%s sums its lines into the pinned footer row', (documentNo) => {
    const totals = lineTotals(PAYLOADS[documentNo].lines)
    const [lineCount, quantity, grossAmount, vatAmount, netAmount] = EXPECTED[documentNo]
    expect(totals).toEqual({ lineCount, quantity, grossAmount, vatAmount, netAmount })
  })

  it('keeps the negative discount out of the sums and in its own line', () => {
    // The footer sums four columns; `discount` is deliberately not one of them,
    // so the promotion on 2000000551 shows on its line and nowhere else.
    const [footer] = totalsFooterRow(PAYLOADS['2000000551'].lines, t)
    expect(footer.discount).toBeUndefined()
    expect(PAYLOADS['2000000551'].lines[0].discount).toBe(-1.5)
  })

  it('sums lines the model types as numbers but live data leaves null', () => {
    const lines = [
      { quantity: 2, grossAmount: 10, vatAmount: null, netAmount: 10 },
      { quantity: null, grossAmount: 5, vatAmount: 0.75, netAmount: 5.75 },
    ] as unknown as Parameters<typeof lineTotals>[0]
    expect(lineTotals(lines)).toEqual({
      lineCount: 2,
      quantity: 2,
      grossAmount: 15,
      vatAmount: 0.75,
      netAmount: 15.75,
    })
  })

  it('rounds off binary-float dust rather than printing it in the footer', () => {
    // `0.1 + 0.2` is the canonical case; `quantity` renders through
    // `formatNumber`, which would print every one of its digits.
    const lines = [
      { quantity: 0.1, grossAmount: 0.1, vatAmount: 0, netAmount: 0.1 },
      { quantity: 0.2, grossAmount: 0.2, vatAmount: 0, netAmount: 0.2 },
    ] as unknown as Parameters<typeof lineTotals>[0]
    const totals = lineTotals(lines)
    expect(totals.quantity).toBe(0.3)
    expect(totals.grossAmount).toBe(0.3)
    expect(totals.netAmount).toBe(0.3)
  })

  it('counts and sums a deleted line like any other', () => {
    const lines = [
      { quantity: 1, grossAmount: 10, vatAmount: 1.5, netAmount: 11.5, deleted: true },
    ] as unknown as Parameters<typeof lineTotals>[0]
    expect(lineTotals(lines).lineCount).toBe(1)
    expect(lineTotals(lines).netAmount).toBe(11.5)
  })

  it('gives a document with no lines no footer row at all', () => {
    expect(lineTotals(null)).toEqual({
      lineCount: 0,
      quantity: 0,
      grossAmount: 0,
      vatAmount: 0,
      netAmount: 0,
    })
    expect(totalsFooterRow([], t)).toEqual([])
    expect(totalsFooterRow(null, t)).toEqual([])
  })

  it('labels the footer row on the first column, lines then units', () => {
    const lines = [
      { quantity: 3, grossAmount: 1, vatAmount: 0, netAmount: 1 },
      { quantity: 4, grossAmount: 1, vatAmount: 0, netAmount: 1 },
    ] as unknown as Parameters<typeof lineTotals>[0]
    const [footer] = totalsFooterRow(lines, t)
    expect(footer.itemDescription).toBe('2 lines · 7 units')
    expect(footer.quantity).toBe(7)
  })

  it('reads the singular on a one-line, one-unit document — every corpus capture', () => {
    const [footer] = totalsFooterRow(PAYLOADS['2000000551'].lines, t)
    expect(footer.itemDescription).toBe('1 line · 1 unit')
  })
})

describe('discountFlag', () => {
  it('fires on the corpus promotion, which is negative', () => {
    expect(isDiscountFlagged(PAYLOADS['2000000551'].lines[0].discount)).toBe(true)
    expect(isDiscountFlagged(-1.5)).toBe(true)
  })

  it('fires on a positive discount too — the rule is non-zero, not > 0', () => {
    expect(isDiscountFlagged(2.25)).toBe(true)
  })

  it('does not fire on zero, which is what every other corpus line carries', () => {
    for (const documentNo of DOCUMENT_NUMBERS) {
      if (documentNo === '2000000551') continue
      for (const line of PAYLOADS[documentNo].lines) {
        expect(isDiscountFlagged(line.discount)).toBe(false)
      }
    }
    expect(isDiscountFlagged(0)).toBe(false)
    expect(isDiscountFlagged(-0)).toBe(false)
  })

  it('does not fire on the pinned footer row, which carries no discount', () => {
    expect(isDiscountFlagged(undefined)).toBe(false)
    expect(isDiscountFlagged(null)).toBe(false)
    expect(isDiscountFlagged(Number.NaN)).toBe(false)
  })
})

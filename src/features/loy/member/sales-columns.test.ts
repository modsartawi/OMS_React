import { describe, expect, it } from 'vitest'

import type { LoySalesRow } from '@/core/models/loy'
import { buildSalesColumns, formatQty, salesCurrencies } from './sales-columns'

/**
 * Ticket 237's second pure Proof bullet: **the Currency column appears iff the
 * rows hold more than one distinct currency, and a return row renders signed qty
 * and amount against an UNSIGNED unit price.**
 *
 * The columns are asserted through their own `valueFormatter`s rather than
 * through a rendered grid — the formatter is where every decision in this ticket
 * actually lives, and AG Grid's job (draw what the formatter returned) is not
 * this repo's to regress. That is the same posture `activity-columns` and the
 * Nphies column suites take.
 */

/** `t` as the columns see it: identity, so an assertion reads the key and never
 *  a copy string that a wording change would break for no behavioural reason. */
const t = ((key: string) => key) as unknown as Parameters<typeof buildSalesColumns>[0]

const row = (over: Partial<LoySalesRow> = {}): LoySalesRow => ({
  storeCode: '1001',
  trxNumber: 'R-88412',
  trxDate: '2026-07-30T00:00:00',
  itemNumber: '300221',
  itemDescription: 'Panadol Extra 24 tab',
  unitPrice: 12,
  qty: 1,
  amount: 12,
  currency: 'SAR',
  ...over,
})

/** Pull a built column by the field or colId it draws, then run its formatter
 *  over one row — the two steps every assertion below shares. */
const drawn = (rows: LoySalesRow[], id: string, one: LoySalesRow): string => {
  const columns = buildSalesColumns(t, rows)
  const col = columns.find((c) => c.colId === id || c.field === id)
  if (!col) throw new Error(`no column ${id}`)
  const value = col.field ? one[col.field as keyof LoySalesRow] : undefined
  return String(
    col.valueFormatter
      ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (col.valueFormatter as any)({ value, data: one })
      : value,
  )
}

describe('salesCurrencies', () => {
  it('sees one currency in a member who only ever shopped in riyals', () => {
    expect(salesCurrencies([row(), row(), row()])).toEqual(['SAR'])
  })

  it('sees two in a member who shopped in Bahrain as well', () => {
    expect(salesCurrencies([row(), row({ currency: 'BHD' })]).sort()).toEqual(['BHD', 'SAR'])
  })

  it('🚩 does not count an empty currency as a second one — a nullable column is unknown, not another currency', () => {
    expect(salesCurrencies([row(), row({ currency: null }), row({ currency: '  ' })])).toEqual([
      'SAR',
    ])
  })

  it('reads one currency written two ways as one currency', () => {
    expect(salesCurrencies([row({ currency: 'sar' }), row({ currency: 'SAR' })])).toEqual(['SAR'])
  })

  it('sees nothing in an empty window', () => {
    expect(salesCurrencies([])).toEqual([])
  })
})

describe('the conditional Currency column', () => {
  const colIds = (rows: LoySalesRow[]) => buildSalesColumns(t, rows).map((c) => c.colId ?? c.field)

  it('🚩 is absent for the SAR-only member — the common case spends no width on a constant', () => {
    expect(colIds([row(), row()])).not.toContain('currency')
  })

  it('🚩 is present for the mixed-currency member — BHD is stated rather than implied', () => {
    expect(colIds([row(), row({ currency: 'BHD' })])).toContain('currency')
  })

  it('is absent when every row’s currency is empty — there is no second currency to distinguish', () => {
    expect(colIds([row({ currency: null }), row({ currency: null })])).not.toContain('currency')
  })

  it('is absent on an empty window', () => {
    expect(colIds([])).not.toContain('currency')
  })

  it('leaves the other eight columns exactly as they were either way', () => {
    const single = colIds([row()])
    const mixed = colIds([row(), row({ currency: 'BHD' })])
    expect(single).toEqual(['trxDate', 'trxNumber', 'storeCode', 'itemNumber', 'item', 'qty', 'unitPrice', 'amount'])
    expect(mixed).toEqual([...single, 'currency'])
  })
})

describe('a row reads like the receipt', () => {
  it('🚩 renders a return as signed qty and amount against an UNSIGNED unit price', () => {
    const rtn = row({ qty: -1, unitPrice: 12, amount: -12 })
    expect(drawn([rtn], 'qty', rtn)).toBe('-1.00')
    expect(drawn([rtn], 'unitPrice', rtn)).toBe('12.00')
    expect(drawn([rtn], 'amount', rtn)).toBe('-12.00')
  })

  it('🚩 never volunteers a plus on a sale — only the return carries a sign', () => {
    const sale = row({ qty: 2, unitPrice: 12, amount: 24 })
    expect(drawn([sale], 'qty', sale)).toBe('2.00')
    expect(drawn([sale], 'amount', sale)).toBe('24.00')
  })

  it('🚩 formats money per THAT ROW’S currency — a BHD line draws three decimals', () => {
    const rows = [row(), row({ currency: 'BHD', unitPrice: 4.275, qty: 2, amount: 8.55 })]
    expect(drawn(rows, 'unitPrice', rows[1])).toBe('4.275')
    expect(drawn(rows, 'amount', rows[1])).toBe('8.550')
    expect(drawn(rows, 'amount', rows[0])).toBe('12.00')
  })

  it('🚩 draws the date DATE-ONLY — TrxTime is not selected, so any clock would be fabricated', () => {
    expect(drawn([row()], 'trxDate', row())).toBe('30 Jul 2026')
    expect(drawn([row()], 'trxDate', row())).not.toMatch(/\d\d:\d\d/)
  })

  it('leads with the item description — “what did they buy” is one column', () => {
    const columns = buildSalesColumns(t, [row()])
    const item = columns.find((c) => c.colId === 'item')
    expect(item?.field).toBe('itemDescription')
    expect(item?.flex).toBeGreaterThan(0)
  })

  it('🚩 sorts and filters — the whole 500-line window is already in the browser', () => {
    for (const col of buildSalesColumns(t, [row()])) {
      expect(col.sortable).not.toBe(false)
    }
  })

  it('🚩 draws no total row — the report selects no exchange rate, so nothing here may be summed', () => {
    for (const col of buildSalesColumns(t, [row(), row({ currency: 'BHD' })])) {
      expect(col.aggFunc).toBeUndefined()
    }
  })

  it('drops the channel columns 226 struck — neither TrxType nor DocType is a closed union', () => {
    const ids = buildSalesColumns(t, [row()]).map((c) => c.colId ?? c.field)
    expect(ids).not.toContain('trxType')
    expect(ids).not.toContain('docType')
    expect(ids).not.toContain('trxTypeNumber')
    expect(ids).not.toContain('documentTypeNumber')
  })
})

describe('formatQty', () => {
  it('always draws two decimals so a fractional quantity lines up', () => {
    expect(formatQty(1)).toBe('1.00')
    expect(formatQty(0.5)).toBe('0.50')
    expect(formatQty(-1)).toBe('-1.00')
  })

  it('renders a missing quantity as blank', () => {
    expect(formatQty(null)).toBe('')
    expect(formatQty(undefined)).toBe('')
  })
})

import { describe, expect, it } from 'vitest'
import type { ColDef, ValueFormatterParams, ValueGetterParams } from 'ag-grid-community'
import type { TFunction } from 'i18next'

import type { InvoiceCandidate } from '@/core/models/retail-invoice'
import { formatMoneyIn } from '@/core/money'
import reports from '@/locales/en/reports.json'
import {
  COLUMN_FIELDS,
  ENUM_FIELDS,
  JOINED_FIELDS,
  NON_COLUMN_FIELDS,
  buildInvoiceColumns,
  buildInvoiceDefaultColDef,
  enumLabel,
} from './invoice-columns'

// Ticket 264's columns Proof: the enum prettifier over a known code and 🔑 over an
// UNKNOWN code arriving as a number (it must render as that number, never blank),
// money through `@/core/money`, and a count NOT going through it.

/**
 * ⚠️ The row is enumerated as a VALUE typed against the pasted contract §2
 * interface, which is the fixture-drift guard the ticket asks for: a field added,
 * renamed or retyped in `InvoiceCandidate` fails `typecheck` on this object
 * before it can fail silently against the real door.
 *
 * The values are contract §1's own response body.
 */
const ROW: InvoiceCandidate = {
  storeCode: 'P001',
  storeName: 'Olaya Branch',
  machineCode: '01',
  trxNumber: '00114600051234',
  receiptNumber: 'R-8842',
  trxDate: '2026-08-04',
  trxTime: '14:22:13',
  trxType: 'Sales',
  trxTypeCode: 100,
  documentType: 'Cash',
  documentTypeCode: 0,
  trxStatus: 'Closed',
  trxStatusCode: 1,
  amount: 83.41,
  itemLinesCount: 3,
  customerId: 'C0042',
  customerName: 'Ahmed Ali',
}

const WIRE_FIELDS = Object.keys(ROW) as (keyof InvoiceCandidate)[]

/**
 * A translator over the REAL `reports` bundle, honouring i18next's
 * `defaultValue` on a miss.
 *
 * 🚩 Deliberately not a key-echoing stub: the prettifier's whole behaviour is
 * "the bundle knows this name, or it does not", so a stub that answered every key
 * would prove nothing about the unknown-code arm — and reading the shipped bundle
 * also pins that the keys the columns ask for actually exist in it.
 */
const t = ((key: string, options?: { defaultValue?: string }) => {
  const hit = key
    .split('.')
    .reduce<unknown>(
      (node, part) =>
        node && typeof node === 'object' ? (node as Record<string, unknown>)[part] : undefined,
      reports,
    )
  return typeof hit === 'string' ? hit : (options?.defaultValue ?? key)
}) as never as TFunction

const columnById = (colId: string): ColDef<InvoiceCandidate> => {
  const found = buildInvoiceColumns(t).find((c) => c.colId === colId)
  if (!found) throw new Error(`no column ${colId}`)
  return found
}

/** Run a column's own display logic over ROW, whichever hook it uses. */
const render = (colId: string, row: InvoiceCandidate = ROW): unknown => {
  const column = columnById(colId)
  const value = column.valueGetter
    ? (column.valueGetter as (p: ValueGetterParams<InvoiceCandidate>) => unknown)({
        data: row,
      } as ValueGetterParams<InvoiceCandidate>)
    : row[colId as keyof InvoiceCandidate]
  return column.valueFormatter
    ? (column.valueFormatter as (p: ValueFormatterParams<InvoiceCandidate, unknown>) => unknown)({
        value,
        data: row,
      } as ValueFormatterParams<InvoiceCandidate, unknown>)
    : value
}

describe('the columns account for the whole wire row', () => {
  it('every field is rendered, folded into another cell, or argued away — exactly once', () => {
    const covered = [...COLUMN_FIELDS, ...JOINED_FIELDS, ...NON_COLUMN_FIELDS]
    expect([...covered].sort()).toEqual([...WIRE_FIELDS].sort())
    expect(new Set(covered).size).toBe(covered.length)
  })

  it('🚩 leads with storeCode — the store’s identity — and storeName follows it', () => {
    expect(COLUMN_FIELDS[0]).toBe('storeCode')
    expect(COLUMN_FIELDS[1]).toBe('storeName')
  })

  it('withholds only the three stored enum ints, whose names are the columns', () => {
    expect([...NON_COLUMN_FIELDS]).toEqual(['trxTypeCode', 'documentTypeCode', 'trxStatusCode'])
  })

  it('🚩 trxType and trxStatus ARE visible columns — 265’s confirm depends on it', () => {
    const ids = buildInvoiceColumns(t).map((c) => c.colId)
    expect(ids).toContain('trxType')
    expect(ids).toContain('trxStatus')
    for (const id of ['trxType', 'trxStatus']) expect(columnById(id).hide).toBeFalsy()
  })

  it('every column carries a t() header — no literal reaches the grid', () => {
    for (const column of buildInvoiceColumns(t)) {
      expect(String(column.headerName)).not.toBe('')
      // A key that resolved is a key that exists in the bundle: the stub returns
      // the key path itself on a miss, and no header may be one.
      expect(String(column.headerName)).not.toMatch(/^invoice\.columns\./)
    }
  })

  it('🚩 has NO floating filter row — nothing to filter within one row', () => {
    expect(buildInvoiceDefaultColDef().floatingFilter).toBeUndefined()
    expect(buildInvoiceDefaultColDef().filter).toBe(false)
  })
})

describe('the enum prettifier', () => {
  it('prettifies a name the bundle knows', () => {
    expect(enumLabel(t, 'trxType', 'CashClearance')).toBe('Cash clearance')
    expect(enumLabel(t, 'trxStatus', 'Suspended')).toBe('Suspended')
    expect(enumLabel(t, 'documentType', 'ECommerce')).toBe('E-commerce')
  })

  it('🔑 renders an UNKNOWN code arriving as a NUMBER as that number — never blank', () => {
    // RetailDocumentType has 18+ members and grows; when no member carries a
    // stored code the server sends the number as the name (contract §2). Blank
    // would hide exactly the case the field exists for.
    expect(enumLabel(t, 'documentType', '37')).toBe('37')
    expect(enumLabel(t, 'trxType', '742')).toBe('742')
  })

  it('renders an unknown NAME as itself too — the list is not closed either way', () => {
    expect(enumLabel(t, 'trxStatus', 'SomeFutureStatus')).toBe('SomeFutureStatus')
  })

  it('is blank only when the server sent nothing at all', () => {
    expect(enumLabel(t, 'trxType', '')).toBe('')
    expect(enumLabel(t, 'trxType', '   ')).toBe('')
  })

  it('the three enum columns all go through it', () => {
    expect([...ENUM_FIELDS]).toEqual(['trxType', 'trxStatus', 'documentType'])
    expect(render('trxType')).toBe('Sales')
    expect(render('trxStatus')).toBe('Closed')
    expect(render('documentType')).toBe('Cash')
  })

  it('an unknown code reaches the CELL as itself, not just the helper', () => {
    expect(render('documentType', { ...ROW, documentType: '37' })).toBe('37')
  })
})

describe('money and counts', () => {
  it('the amount goes through @/core/money', () => {
    expect(render('amount')).toBe(formatMoneyIn(83.41, null))
    expect(render('amount')).toBe('83.41')
  })

  it('a negative amount keeps its own sign — a return is a return', () => {
    expect(render('amount', { ...ROW, amount: -12.5 })).toBe('-12.50')
  })

  it('🚩 the formatter is the CURRENCY-AWARE one, which already knows BHD is 3 dp', () => {
    // The wire row carries no currency (contract §2), so an invoice draws the
    // footprint's default 2 dp — but the figure goes through `formatMoneyIn`
    // rather than `number-format`'s fixed-2dp `formatMoney`, so the day the
    // contract grows a currency the 3 dp case is one constant away.
    expect(formatMoneyIn(1.5, 'BHD')).toBe('1.500')
    expect(formatMoneyIn(1.5, null)).toBe('1.50')
  })

  it('🚩 itemLinesCount is a COUNT — it does NOT go through the money formatter', () => {
    expect(columnById('itemLinesCount').valueFormatter).toBeUndefined()
    expect(render('itemLinesCount')).toBe(3)
  })
})

describe('the date and the time', () => {
  it('🚩 joins the two raw fields into one cell', () => {
    expect(render('trxDate')).toBe('2026-08-04 14:22:13')
  })

  it('does not draw the time twice — trxTime has no column of its own', () => {
    expect(buildInvoiceColumns(t).map((c) => c.colId)).not.toContain('trxTime')
  })

  it('⚠️ joins as STRINGS — a receipt with no time still shows its date', () => {
    // No Date is constructed anywhere on this path: the two strings sort
    // lexically and reconstructing an instant is the drift the estate convention
    // exists to prevent.
    expect(render('trxDate', { ...ROW, trxTime: '' })).toBe('2026-08-04')
  })

  it('the joined cell still sorts chronologically', () => {
    const earlier = render('trxDate', { ...ROW, trxTime: '09:05:00' }) as string
    const later = render('trxDate') as string
    const nextDay = render('trxDate', { ...ROW, trxDate: '2026-08-05', trxTime: '00:01:00' }) as string
    expect([later, nextDay, earlier].sort()).toEqual([earlier, later, nextDay])
  })
})

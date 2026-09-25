import { describe, expect, it } from 'vitest'
import type { CollectionAttemptRow } from '@/core/models/collection'
import {
  DEFAULT_FIELDS,
  MORE_FIELDS,
  NON_COLUMN_FIELDS,
  buildAttemptsColumns,
  buildAttemptsDefaultColDef,
} from './attempts-columns'

// Ticket 255's Collection Attempts columns Proof — **the same union assertion as
// 254**: the forensic tail hides nothing.

const ROW: CollectionAttemptRow = {
  attemptId: '01J0ATTEMPT00000000000000001',
  collectorStaffId: '4472',
  collectorName: 'Faisal Al Otaibi',
  storeCode: '1001',
  storeName: 'Al Dawaa — Olaya',
  // BackOffice 1990's pair: the raw profit center, and the server's one spelling of it.
  profitCenter: 'PH-1001',
  storeText: 'PH-1001 (1001)',
  shiftId: '01J0SHIFT0000000000000000001',
  businessDay: '2026-08-08T00:00:00',
  attemptTime: '2026-08-08T09:12:00',
  reasonCode: 'STORE_CLOSED',
  reasonText: 'Branch shut for maintenance',
}

const WIRE_FIELDS = Object.keys(ROW) as (keyof CollectionAttemptRow)[]

const t = ((key: string, vars?: Record<string, unknown>) =>
  vars ? `${key}|${JSON.stringify(vars)}` : key) as never

describe('the two groups account for the whole wire row', () => {
  it('their union plus the argued non-columns IS the row', () => {
    const covered = [...DEFAULT_FIELDS, ...MORE_FIELDS, ...NON_COLUMN_FIELDS]
    expect([...covered].sort()).toEqual([...WIRE_FIELDS].sort())
  })

  it('no field is in two places — exactly one, not at least one', () => {
    const covered = [...DEFAULT_FIELDS, ...MORE_FIELDS, ...NON_COLUMN_FIELDS]
    expect(new Set(covered).size).toBe(covered.length)
  })

  it('draws the WPF’s NINE columns and 314’s profit center pair, split seven and four', () => {
    // Five and four until ticket 316 moved the business day onto the default grid;
    // ticket 314 put storeText on the landing grid and profitCenter in the tail.
    expect(DEFAULT_FIELDS.length).toBe(7)
    expect(MORE_FIELDS.length).toBe(4)
  })

  it('withholds only the attempt’s ULID — which opens nothing, deliberately', () => {
    // ⚠️ There is no document and no row action here. The WPF withholds one on
    // purpose: an attempt is immutable evidence, not a voucher.
    expect([...NON_COLUMN_FIELDS]).toEqual(['attemptId'])
  })

  it('leads with both dates — the day they came for, then when they came — then where, who and why', () => {
    // Ticket 316 (BackOffice 1993): Business date = businessDay, Collection date =
    // attemptTime, both default columns, the business day first (315's order).
    expect([...DEFAULT_FIELDS]).toEqual([
      'businessDay',
      'attemptTime',
      'storeCode',
      // Ticket 314: the profit center beside the store code.
      'storeText',
      'storeName',
      'collectorName',
      'reasonCode',
    ])
  })
})

// Ticket 314 (BackOffice 1990): the server's `storeText` as sent, the raw
// `profitCenter` in the tail.
describe('the profit center column', () => {
  it('is on the DEFAULT grid, right after the store code, reading storeText as sent', () => {
    const columns = buildAttemptsColumns(t, false)
    const ids = columns.map((c) => c.colId)
    expect(ids.indexOf('storeText')).toBe(ids.indexOf('storeCode') + 1)
    const column = columns.find((c) => c.colId === 'storeText')
    expect(column?.field).toBe('storeText')
    expect(column?.headerName).toBe('attempts.columns.storeText')
    expect(column?.valueFormatter).toBeUndefined()
    expect(column?.valueGetter).toBeUndefined()
  })

  it('folds the raw profit center into the tail', () => {
    expect(buildAttemptsColumns(t, false).map((c) => c.colId)).not.toContain('profitCenter')
    const raw = buildAttemptsColumns(t, true).find((c) => c.colId === 'profitCenter')
    expect(raw?.field).toBe('profitCenter')
    expect(raw?.headerName).toBe('attempts.columns.profitCenter')
  })
})

describe('buildAttemptsColumns', () => {
  it('shows the default seven with the toggle off', () => {
    expect(buildAttemptsColumns(t, false).map((c) => c.colId)).toEqual([...DEFAULT_FIELDS])
  })

  it('reveals the tail with the toggle on, and folds NOTHING away doing it', () => {
    expect(buildAttemptsColumns(t, true).map((c) => c.colId)).toEqual([
      ...DEFAULT_FIELDS,
      ...MORE_FIELDS,
    ])
  })

  it('every column carries a t() header — no literal reaches the grid', () => {
    for (const column of buildAttemptsColumns(t, true)) {
      expect(String(column.headerName)).toContain('attempts.columns.')
    }
  })

  it('has NO money column at all, and that is the screen rather than an omission', () => {
    // An attempt collected nothing by definition — that is what makes it an
    // attempt. So nothing here formats through @/core/money.ts.
    for (const column of buildAttemptsColumns(t, true)) {
      expect(column.cellClass ?? '').not.toContain('tabular-nums')
    }
  })
})

describe('the two dates', () => {
  it('renders the visit moment to the minute and the business day as a day', () => {
    const columns = buildAttemptsColumns(t, true)
    const attemptTime = columns.find((c) => c.colId === 'attemptTime')?.valueFormatter as (
      p: unknown,
    ) => string
    const businessDay = columns.find((c) => c.colId === 'businessDay')?.valueFormatter as (
      p: unknown,
    ) => string
    expect(attemptTime({ value: '2026-08-08T09:12:00', data: ROW })).toBe('2026-08-08 09:12')
    expect(businessDay({ value: '2026-08-08T00:00:00', data: ROW })).toBe('2026-08-08')
  })

  it('puts both on the default grid, with t() headers', () => {
    const columns = buildAttemptsColumns(t, false)
    expect(columns.find((c) => c.colId === 'businessDay')?.headerName).toBe(
      'attempts.columns.businessDay',
    )
    expect(columns.find((c) => c.colId === 'attemptTime')?.headerName).toBe(
      'attempts.columns.attemptTime',
    )
  })

  it('blanks an unset sentinel rather than printing 0001-01-01', () => {
    const businessDay = buildAttemptsColumns(t, true).find((c) => c.colId === 'businessDay')
      ?.valueFormatter as (p: unknown) => string
    expect(businessDay({ value: '0001-01-01T00:00:00', data: ROW })).toBe('')
  })

  it('filters on what is ON SCREEN, not on the raw ISO value', () => {
    const columns = buildAttemptsColumns(t, true)
    for (const [colId, expected] of [
      ['attemptTime', '2026-08-08 09:12'],
      ['businessDay', '2026-08-08'],
    ] as const) {
      const get = columns.find((c) => c.colId === colId)?.filterValueGetter as (p: unknown) => string
      expect(get({ data: ROW })).toBe(expected)
    }
  })
})

describe('the floating filter row', () => {
  it('is ON by default — the deliberate inversion of BBY Inquiry', () => {
    expect(buildAttemptsDefaultColDef(true).floatingFilter).toBe(true)
  })

  it('is off when the supervisor reclaims the height', () => {
    expect(buildAttemptsDefaultColDef(false).floatingFilter).toBe(false)
  })
})

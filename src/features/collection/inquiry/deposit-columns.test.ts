import { describe, expect, it } from 'vitest'
import type { DepositInquiryRow } from '@/core/models/collection'
import {
  DEFAULT_FIELDS,
  MONEY_FIELDS,
  MORE_FIELDS,
  NON_COLUMN_FIELDS,
  buildDepositsColumns,
  buildDepositsDefaultColDef,
} from './deposit-columns'

// Ticket 256's Deposits columns Proof — **the same union assertion as 254 and
// 255**: the forensic tail hides nothing. Every field on the wire row appears in
// exactly one of the two groups (or is named, with its reason, in
// NON_COLUMN_FIELDS), and their union is the whole row. The row is enumerated
// here as a VALUE so that a field added to the contract fails typecheck on this
// object, and then fails the union.

const ROW: DepositInquiryRow = {
  depositId: '01J0DEPOSIT000000000000001',
  depositNumber: 5501,
  collectorOperatorId: '4472',
  collectorName: 'Faisal Al Otaibi',
  bankCode: 'ANB',
  bankName: 'Arab National Bank',
  status: 'POSTED',
  depositedAt: '2026-08-08T11:20:00',
  createdAt: '2026-08-08T11:22:00',
  calculatedAmount: 143_910.75,
  realAmount: 143_910.75,
  diffAmount: 0,
  reasonCode: '',
  noteText: '',
  voidedBy: '',
  voidedAt: '0001-01-01T00:00:00',
  voidReason: '',
  lines: [],
  attachments: [],
}

const WIRE_FIELDS = Object.keys(ROW) as (keyof DepositInquiryRow)[]

// A translator that echoes its key, so a header assertion reads as "which key",
// never as "which English word".
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

  it('withholds the ULID and the two LISTS, and nothing else', () => {
    // `lines`/`attachments` are what make this the one screen in the suite that
    // is not a flat list: a cell cannot hold a list, so they render in the
    // stacked detail region instead of being folded into a column group.
    expect([...NON_COLUMN_FIELDS].sort()).toEqual(['attachments', 'depositId', 'lines'])
  })

  it('the default nine lead with identity, then the state, then the money', () => {
    expect([...DEFAULT_FIELDS]).toEqual([
      'depositNumber',
      'depositedAt',
      'collectorName',
      'bankName',
      'status',
      'calculatedAmount',
      'realAmount',
      'diffAmount',
      'reasonCode',
    ])
  })

  it('folds the whole void trail into the tail rather than dropping it', () => {
    for (const field of ['voidedBy', 'voidedAt', 'voidReason'] as const) {
      expect([...MORE_FIELDS]).toContain(field)
    }
  })

  it('every money field is one of the row’s own fields', () => {
    for (const field of MONEY_FIELDS) expect(WIRE_FIELDS).toContain(field)
  })
})

describe('buildDepositsColumns', () => {
  it('shows the default nine with the toggle off', () => {
    expect(buildDepositsColumns(t, false).map((c) => c.colId)).toEqual([...DEFAULT_FIELDS])
  })

  it('reveals the tail with the toggle on, and folds NOTHING away doing it', () => {
    expect(buildDepositsColumns(t, true).map((c) => c.colId)).toEqual([
      ...DEFAULT_FIELDS,
      ...MORE_FIELDS,
    ])
  })

  it('every column carries a t() header — no literal reaches the grid', () => {
    for (const column of buildDepositsColumns(t, true)) {
      expect(String(column.headerName)).toContain('deposits.columns.')
    }
  })
})

describe('money on a row that carries no currency', () => {
  // Same position as the ACR grid: DepositInquiryRowModel has no CurrencyKey, so
  // the header states no code and the figures draw at the default two decimals.
  // Blank-not-0.00 and the grouping still hold — those are formatMoneyIn's rules
  // and they need no currency.
  const money = (colId: string) =>
    buildDepositsColumns(t, true).find((c) => c.colId === colId)?.valueFormatter as (
      p: unknown,
    ) => string

  it('states NO currency in the header — a bare label beats an invented one', () => {
    const calculated = buildDepositsColumns(t, false).find((c) => c.colId === 'calculatedAmount')
    expect(calculated?.headerName).toBe('deposits.columns.calculatedAmount')
    expect(String(calculated?.headerName)).not.toContain('moneyHeader')
  })

  it('groups the figure to two decimals', () => {
    expect(money('calculatedAmount')({ value: 143910.75, data: ROW })).toBe('143,910.75')
  })

  it('leaves a missing figure BLANK rather than 0.00 — and a real zero is still 0.00', () => {
    const format = money('diffAmount')
    expect(format({ value: null, data: ROW })).toBe('')
    expect(format({ value: undefined, data: ROW })).toBe('')
    // A deposit that banked exactly what it calculated really does differ by
    // zero. That is a figure, and the most reassuring one on the screen.
    expect(format({ value: 0, data: ROW })).toBe('0.00')
  })

  it('keeps the sign the row’s own — a shortfall reads as negative', () => {
    expect(money('diffAmount')({ value: -412.5, data: ROW })).toBe('-412.50')
  })

  it('right-aligns every money column', () => {
    const columns = buildDepositsColumns(t, true)
    for (const field of MONEY_FIELDS) {
      expect(columns.find((c) => c.colId === field)?.cellClass).toContain('text-end')
    }
  })
})

describe('the sentinels the server sends', () => {
  it('blanks Voided on a deposit that was never voided, rather than printing 0001-01-01', () => {
    // VoidedAt is a non-nullable DateTime server-side, so a live deposit arrives
    // as the .NET default rather than as null.
    const format = buildDepositsColumns(t, true).find((c) => c.colId === 'voidedAt')
      ?.valueFormatter as (p: unknown) => string
    expect(format({ value: '0001-01-01T00:00:00', data: ROW })).toBe('')
    expect(format({ value: '2026-08-09T09:05:00', data: ROW })).toBe('2026-08-09 09:05')
  })

  it('filters dates on what is ON SCREEN, not on the raw ISO value', () => {
    const columns = buildDepositsColumns(t, true)
    for (const [colId, expected] of [
      ['depositedAt', '2026-08-08 11:20'],
      ['createdAt', '2026-08-08 11:22'],
      ['voidedAt', ''],
    ] as const) {
      const get = columns.find((c) => c.colId === colId)?.filterValueGetter as (p: unknown) => string
      expect(get({ data: ROW })).toBe(expected)
    }
  })
})

describe('the floating filter row', () => {
  it('is ON by default — the deliberate inversion of BBY Inquiry', () => {
    expect(buildDepositsDefaultColDef(true).floatingFilter).toBe(true)
  })

  it('is off when the accountant reclaims the height', () => {
    expect(buildDepositsDefaultColDef(false).floatingFilter).toBe(false)
  })
})

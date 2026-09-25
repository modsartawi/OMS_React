import { describe, expect, it } from 'vitest'
import type { AcrInquiryRow } from '@/core/models/collection'
import {
  DEFAULT_FIELDS,
  MONEY_FIELDS,
  MORE_FIELDS,
  NON_COLUMN_FIELDS,
  COLLECTION_DATE_COLUMN,
  buildAcrsColumns,
  buildAcrsDefaultColDef,
  closedByText,
} from './acr-columns'

// Ticket 255's ACR columns Proof — **the same union assertion as 254**: the
// forensic tail hides nothing. Every field on the wire row appears in exactly one
// of the two groups (or is named, with its reason, in NON_COLUMN_FIELDS), and
// their union is the whole row. The row is enumerated here as a VALUE so that a
// field added to the contract fails typecheck on this object, and then fails the
// union.

const ROW: AcrInquiryRow = {
  acrId: '01J0ACR00000000000000000001',
  acrNumber: 41,
  label: 'Riyadh North — Thursday run',
  collectorOperatorId: '4472',
  collectorName: 'Faisal Al Otaibi',
  acrDate: '2026-08-08T00:00:00',
  status: 'CLOSED',
  createdAt: '2026-08-08T08:15:00',
  closedAt: '2026-08-08T19:32:00',
  closedBy: '4472',
  closedByName: 'Faisal Al Otaibi',
  linkedCollectionCount: 12,
  // Ticket 316: collected on the 5th and the 8th, for a business date of the 8th.
  firstCollectedAt: '2026-08-05T10:15:00',
  lastCollectedAt: '2026-08-08T15:40:00',
  netCollectedTotal: 143_910.75,
  cardTotalSum: 99_120.5,
  cardTransactionCountSum: 812,
  depositId: '01J0DEPOSIT000000000000001',
  depositNumber: 5501,
  depositStatus: 'POSTED',
}

const WIRE_FIELDS = Object.keys(ROW) as (keyof AcrInquiryRow)[]

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

  it('draws NINETEEN columns: the WPF’s fourteen, the deposit ULID, who closed it, and when it was collected', () => {
    // 15 until ticket 313 (BackOffice 1987) put the closer's name and id on the row,
    // 17 until ticket 316 (BackOffice 1993) put the collected-at span on it.
    expect(DEFAULT_FIELDS.length + MORE_FIELDS.length).toBe(19)
    // "Nothing is dropped" is about the ROW, not about the WPF's column picker —
    // 254's own ruling, which folded five unshown wire fields into its tail.
    expect([...MORE_FIELDS]).toContain('depositId')
  })

  it('only the document’s ULID is withheld from the grid', () => {
    // acrId is 257's key for /collection/acr/:acrId — opaque, and meaningless to
    // read. Named rather than silently skipped.
    expect([...NON_COLUMN_FIELDS]).toEqual(['acrId'])
  })

  it('the default nine lead with identity, then the date, then the state and who closed it, then the money', () => {
    expect([...DEFAULT_FIELDS]).toEqual([
      'acrNumber',
      'label',
      'collectorName',
      // Ticket 316's derived Collection date column follows this one (see below).
      'acrDate',
      'status',
      'closedByName',
      'linkedCollectionCount',
      'netCollectedTotal',
      'cardTotalSum',
    ])
  })

  it('every money field is one of the row’s own fields', () => {
    for (const field of MONEY_FIELDS) expect(WIRE_FIELDS).toContain(field)
  })
})

// Ticket 316 puts the derived Collection date column just after the business date.
const withSpan = (fields: readonly string[]) =>
  fields.flatMap((f) => (f === 'acrDate' ? [f, COLLECTION_DATE_COLUMN] : [f]))

describe('buildAcrsColumns', () => {
  it('shows the default nine plus the Collection date with the toggle off', () => {
    expect(buildAcrsColumns(t, false).map((c) => c.colId)).toEqual(withSpan(DEFAULT_FIELDS))
  })

  it('reveals the tail with the toggle on, and folds NOTHING away doing it', () => {
    expect(buildAcrsColumns(t, true).map((c) => c.colId)).toEqual([
      ...withSpan(DEFAULT_FIELDS),
      ...MORE_FIELDS,
    ])
  })

  it('every column carries a t() header — no literal reaches the grid', () => {
    for (const column of buildAcrsColumns(t, true)) {
      expect(String(column.headerName)).toContain('acrs.columns.')
    }
  })
})

describe('money on a row that carries no currency', () => {
  // The one place this screen cannot honour 244 §7. AcrInquiryModel has no
  // CurrencyKey, so the header states no code and the figures draw at the default
  // two decimals. Blank-not-0.00 and the grouping still hold, because those are
  // formatMoneyIn's rules and they need no currency.
  const money = (colId: string) =>
    buildAcrsColumns(t, true).find((c) => c.colId === colId)?.valueFormatter as (
      p: unknown,
    ) => string

  it('states NO currency in the header — a bare label beats an invented one', () => {
    const netCollected = buildAcrsColumns(t, false).find((c) => c.colId === 'netCollectedTotal')
    expect(netCollected?.headerName).toBe('acrs.columns.netCollectedTotal')
    // …and specifically, nothing that looks like the moneyHeader interpolation.
    expect(String(netCollected?.headerName)).not.toContain('moneyHeader')
  })

  it('groups the figure to two decimals', () => {
    expect(money('netCollectedTotal')({ value: 143910.75, data: ROW })).toBe('143,910.75')
  })

  it('leaves a missing figure BLANK rather than 0.00 — and a real zero is still 0.00', () => {
    const format = money('cardTotalSum')
    expect(format({ value: null, data: ROW })).toBe('')
    expect(format({ value: undefined, data: ROW })).toBe('')
    // An idle ACR really did collect nothing on the card. That is a figure.
    expect(format({ value: 0, data: ROW })).toBe('0.00')
  })

  it('right-aligns money, and does NOT treat the two COUNTS as money', () => {
    const columns = buildAcrsColumns(t, true)
    for (const field of MONEY_FIELDS) {
      expect(columns.find((c) => c.colId === field)?.cellClass).toContain('text-end')
    }
    for (const count of ['linkedCollectionCount', 'cardTransactionCountSum']) {
      const column = columns.find((c) => c.colId === count)
      expect(column?.valueFormatter).toBeUndefined()
      expect(column?.cellClass).toContain('text-end')
    }
  })
})

describe('the sentinels the server sends', () => {
  it('blanks Closed while the ACR is still OPEN, rather than printing 0001-01-01', () => {
    // ClosedAt is a non-nullable DateTime server-side, so an open ACR arrives as
    // the .NET default rather than as null.
    const format = buildAcrsColumns(t, true).find((c) => c.colId === 'closedAt')
      ?.valueFormatter as (p: unknown) => string
    expect(format({ value: '0001-01-01T00:00:00', data: ROW })).toBe('')
    expect(format({ value: '2026-08-08T19:32:00', data: ROW })).toBe('2026-08-08 19:32')
  })

  it('blanks Deposit No# on an unbanked ACR, rather than printing 0', () => {
    // "Empty/0 means not yet banked" is the server's own comment. A 0 under a
    // header reading Deposit No# reads as the deposit numbered zero.
    const format = buildAcrsColumns(t, true).find((c) => c.colId === 'depositNumber')
      ?.valueFormatter as (p: unknown) => string
    expect(format({ value: 0, data: { ...ROW, depositNumber: 0 } })).toBe('')
    expect(format({ value: 5501, data: ROW })).toBe('5501')
  })

  it('does NOT blank a zero collection count — an idle ACR really has none', () => {
    const column = buildAcrsColumns(t, false).find((c) => c.colId === 'linkedCollectionCount')
    expect(column?.valueFormatter).toBeUndefined()
  })

  it('filters dates on what is ON SCREEN, not on the raw ISO value', () => {
    const columns = buildAcrsColumns(t, true)
    for (const [colId, expected] of [
      ['acrDate', '2026-08-08'],
      ['createdAt', '2026-08-08 08:15'],
      ['closedAt', '2026-08-08 19:32'],
    ] as const) {
      const get = columns.find((c) => c.colId === colId)?.filterValueGetter as (p: unknown) => string
      expect(get({ data: ROW })).toBe(expected)
    }
    // …and the blanked Deposit No# filters as blank too, so filtering the column
    // finds the unbanked ACRs rather than a `0` nobody can see.
    const deposit = columns.find((c) => c.colId === 'depositNumber')?.filterValueGetter as (
      p: unknown,
    ) => string
    expect(deposit({ data: { ...ROW, depositNumber: 0 } })).toBe('')
  })
})

// Ticket 316 (BackOffice 1993): Business date = acrDate (the date part);
// Collection date = firstCollectedAt … lastCollectedAt, one date when they fall on
// the same day, blank when null (an idle ACR) — a DERIVED column, no wire field.
describe('the Business date and Collection date columns', () => {
  const column = (colId: string) => buildAcrsColumns(t, true).find((c) => c.colId === colId)
  const span = (data: AcrInquiryRow) =>
    (column(COLLECTION_DATE_COLUMN)?.valueGetter as (p: unknown) => string)({ data })
  const shown = (colId: string, data: AcrInquiryRow) =>
    (column(colId)?.valueFormatter as (p: unknown) => string)({
      value: data[colId as keyof AcrInquiryRow],
      data,
    })

  it('are both on the DEFAULT grid, side by side, the business date first', () => {
    const ids = buildAcrsColumns(t, false).map((c) => c.colId)
    expect(ids.indexOf(COLLECTION_DATE_COLUMN)).toBe(ids.indexOf('acrDate') + 1)
  })

  it('head the two through t() — the Business date is the ACR date’s key', () => {
    expect(column('acrDate')?.headerName).toBe('acrs.columns.acrDate')
    expect(column(COLLECTION_DATE_COLUMN)?.headerName).toBe('acrs.columns.collectionDate')
  })

  it('draws the Collection date as the span of days the collections were taken on', () => {
    expect(span(ROW)).toBe('grid.daySpan|{"from":"2026-08-05","to":"2026-08-08"}')
  })

  it('draws ONE date when the first and last collection fall on the same day', () => {
    const sameDay = { ...ROW, firstCollectedAt: '2026-09-12T08:00:00', lastCollectedAt: '2026-09-12T23:40:00' }
    expect(span(sameDay)).toBe('2026-09-12')
  })

  it('leaves an idle ACR’s Collection date BLANK — never unknown, never year 1', () => {
    const idle = { ...ROW, linkedCollectionCount: 0, firstCollectedAt: null, lastCollectedAt: null }
    expect(span(idle)).toBe('')
    const filter = column(COLLECTION_DATE_COLUMN)?.filterValueGetter as (p: unknown) => string
    expect(filter({ data: idle })).toBe('')
  })

  it('reads the span off the row it is given — no field of its own on the wire', () => {
    // A value getter over two fields, so sort and the floating filter both read what
    // the cell shows, `yyyy-MM-dd` text that sorts by its first day.
    expect(column(COLLECTION_DATE_COLUMN)?.field).toBeUndefined()
    const filter = column(COLLECTION_DATE_COLUMN)?.filterValueGetter as (p: unknown) => string
    expect(filter({ data: ROW })).toBe(span(ROW))
  })

  it('keeps both raw collected-at ends, to the minute, in the tail', () => {
    const folded = buildAcrsColumns(t, false).map((c) => c.colId)
    expect(folded).not.toContain('firstCollectedAt')
    expect(folded).not.toContain('lastCollectedAt')
    expect(shown('firstCollectedAt', ROW)).toBe('2026-08-05 10:15')
    expect(shown('lastCollectedAt', ROW)).toBe('2026-08-08 15:40')
    expect(shown('lastCollectedAt', { ...ROW, lastCollectedAt: null })).toBe('')
  })
})

describe('who closed it (ticket 313, BackOffice 1987)', () => {
  // The contract's three closers, on its own sample's shape.
  const SWEPT = { ...ROW, closedBy: 'SYSTEM', closedByName: 'SYSTEM' }
  const BY_HAND = { ...ROW, closedBy: 'COLL-9', closedByName: 'فهد القحطاني' }
  const OPEN = { ...ROW, status: 'OPEN', closedBy: '', closedByName: '' }

  it('reads the 23:59 sweep as a sentence, never as a person called SYSTEM', () => {
    expect(closedByText(t, SWEPT)).toBe('acrs.closedBy.system')
  })

  it('keys the sentence on the RAW closedBy, where the contract defines the literal', () => {
    // A collector whose Staff name happened to be "SYSTEM" is still a person.
    expect(closedByText(t, { closedBy: 'COLL-9', closedByName: 'SYSTEM' })).toBe('SYSTEM')
  })

  it('reads a collector’s close as the server’s name, verbatim — the client looks nothing up', () => {
    expect(closedByText(t, BY_HAND)).toBe('فهد القحطاني')
    // No name resolved: the server echoes the id, and the grid shows the echo.
    expect(closedByText(t, { closedBy: 'COLL-9', closedByName: 'COLL-9' })).toBe('COLL-9')
  })

  it('leaves an OPEN ACR, and one closed before anything was recorded, BLANK — not "unknown"', () => {
    expect(closedByText(t, OPEN)).toBe('')
    // Pre-090: CLOSED, with nothing recorded about who.
    expect(closedByText(t, { ...ROW, closedBy: '', closedByName: '' })).toBe('')
    expect(closedByText(t, undefined)).toBe('')
  })

  const column = (colId: string) => buildAcrsColumns(t, true).find((c) => c.colId === colId)

  it('the Closed By column sorts and filters on what it SHOWS', () => {
    const get = column('closedByName')?.valueGetter as (p: unknown) => string
    expect(get({ data: SWEPT })).toBe('acrs.closedBy.system')
    expect(get({ data: BY_HAND })).toBe('فهد القحطاني')
    expect(get({ data: OPEN })).toBe('')
  })

  it('its filter answers to what it shows AND to the contract’s SYSTEM marker', () => {
    const filter = column('closedByName')?.filterValueGetter as (p: unknown) => string
    expect(filter({ data: SWEPT })).toContain('acrs.closedBy.system')
    expect(filter({ data: SWEPT })).toContain('SYSTEM')
    // Only the sweep carries the marker — a collector's close filters on their name alone.
    expect(filter({ data: BY_HAND })).toBe('فهد القحطاني')
    expect(filter({ data: OPEN })).toBe('')
  })

  it('is a default column, headed through t()', () => {
    const header = buildAcrsColumns(t, false).find((c) => c.colId === 'closedByName')?.headerName
    expect(header).toBe('acrs.columns.closedByName')
  })

  it('keeps the raw id — SYSTEM verbatim — in the tail, where finance can filter on it', () => {
    expect(buildAcrsColumns(t, false).some((c) => c.colId === 'closedBy')).toBe(false)
    const raw = column('closedBy')
    expect(raw?.field).toBe('closedBy')
    expect(raw?.valueGetter).toBeUndefined()
    expect(raw?.valueFormatter).toBeUndefined()
  })
})

describe('the floating filter row', () => {
  it('is ON by default — the deliberate inversion of BBY Inquiry', () => {
    expect(buildAcrsDefaultColDef(true).floatingFilter).toBe(true)
  })

  it('is off when the supervisor reclaims the height', () => {
    expect(buildAcrsDefaultColDef(false).floatingFilter).toBe(false)
  })
})

import type { DeliverectTermsBody, DeliverectTermsRow, LocalDate } from '@/core/models/deliverect'
import { fromIsoDate, toIsoDate } from '@/core/util/date-format'
import { formatMoney3 } from '@/core/util/number-format'

// A delivery platform's effective-dated terms (ticket 482, BackOffice spec 2615 / ADR 0080; contract
// § Platforms and terms). Pure: no React, no `t`.
//
// Rows are never edited or deleted — a correction is a new row, and `POST Terms` closes the previous
// open row the day before the new row's `validFrom`. Dates are `yyyy-MM-dd` strings: they sort and
// compare as text, so no `Date` is built except to step back one calendar day (local parts, never
// `toISOString`).

export interface TermsEntry {
  row: DeliverectTermsRow
  /** The open row (`validTo` null) — the one a new row closes. */
  current: boolean
}

/** The contract's only currency in v1 (§ Common "Money") — used when a platform has no row yet. */
export const DEFAULT_CURRENCY = 'SAR'

/** Money with its currency, 3 decimals — one machine value, isolated once by the caller. */
export const money = (amount: number, currencyKey: string) => `${formatMoney3(amount)} ${currencyKey}`

/** The rows by `validFrom`, oldest first, the open row marked current. Never reorders its input. */
export function termsTimeline(rows: readonly DeliverectTermsRow[] | null | undefined): TermsEntry[] {
  return [...(rows ?? [])]
    .sort((a, b) => (a.validFrom < b.validFrom ? -1 : a.validFrom > b.validFrom ? 1 : 0))
    .map((row) => ({ row, current: row.validTo === null }))
}

/** A real calendar day as a local Date, or `null`. */
function day(value: string): Date | null {
  const date = fromIsoDate(value)
  // `fromIsoDate` rolls 2026-02-30 over into March; a day that does not round-trip is not a day.
  return date && toIsoDate(date) === value.trim() ? date : null
}

/** The day before `value` — the day the previous open row closes on — or `null` if it is no date. */
export function dayBefore(value: string): LocalDate | null {
  const date = day(value)
  if (date === null) return null
  date.setDate(date.getDate() - 1)
  return toIsoDate(date)
}

/** The open row — the one a new row closes — or `null`. */
export function currentRow(timeline: readonly TermsEntry[]) {
  return timeline.find((e) => e.current)?.row ?? null
}

/** The currency a new row carries: the open row's, else the latest row's, else the contract's v1 one. */
export function termsCurrency(timeline: readonly TermsEntry[]): string {
  return currentRow(timeline)?.currencyKey ?? timeline.at(-1)?.row.currencyKey ?? DEFAULT_CURRENCY
}

/**
 * Why a proposed `validFrom` would overlap an existing row:
 * - `inside` — it falls in that row, both ends included. For the open row that is only its own
 *   first day: closing it the day before would leave it with no day at all.
 * - `before` — a later row starts after it (it comes before every row, or falls in a gap), so the
 *   new open-ended row would run into that row.
 */
export interface TermsConflict {
  kind: 'inside' | 'before'
  row: DeliverectTermsRow
}

/**
 * The client's hint for DLV-00008, or `null`. A date after the open row starts is fine — that is
 * how a new row is added. 🚩 A hint only: the dialog still sends, and the server's DLV-00008 is the
 * authority, shown inline.
 */
export function termsConflict(timeline: readonly TermsEntry[], validFrom: string): TermsConflict | null {
  const date = day(validFrom)
  if (date === null || timeline.length === 0) return null
  const d = toIsoDate(date)
  for (const { row } of timeline) {
    if (row.validTo === null ? d === row.validFrom : row.validFrom <= d && d <= row.validTo) return { kind: 'inside', row }
  }
  const later = timeline.find((e) => e.row.validFrom > d)
  return later ? { kind: 'before', row: later.row } : null
}

// ── The add-terms fields ─────────────────────────────────────────────────────────────────────────

/** The add-terms fields as typed. */
export interface TermsDraft {
  validFrom: string
  customerDiscountPct: string
  commissionPct: string
  deliveryFee: string
  deliveryFeeThreshold: string
}

export type TermsField = keyof TermsDraft

/**
 * The add-terms fields a new row starts from: the open row's values (a correction is usually a
 * small change), the date empty. A value the fields could not send back as it stands (more than 3
 * decimals, an exponent) starts empty instead — never rounded behind the user's back.
 */
export function termsDraftFrom(timeline: readonly TermsEntry[]): TermsDraft {
  const open = currentRow(timeline)
  const keep = (value: number | undefined, money: boolean) => {
    if (value === undefined || !DECIMAL.test(String(value))) return ''
    return money ? value.toFixed(3) : String(value)
  }
  return {
    validFrom: '',
    customerDiscountPct: keep(open?.customerDiscountPct, false),
    commissionPct: keep(open?.commissionPct, false),
    deliveryFee: keep(open?.deliveryFee, true),
    deliveryFeeThreshold: keep(open?.deliveryFeeThreshold, true),
  }
}
export type TermsProblem = 'required' | 'date' | 'number' | 'percent'

/** The POST body without its reason. */
export type TermsValue = Omit<DeliverectTermsBody, 'platformKey' | 'reason'>

const PERCENTS = ['customerDiscountPct', 'commissionPct'] as const
const AMOUNTS = ['deliveryFee', 'deliveryFeeThreshold'] as const

/** The add-terms fields beyond the date, in the order the dialog shows them. */
export const TERMS_NUMBER_FIELDS = [...PERCENTS, ...AMOUNTS] as const

/** ASCII digits, an optional fraction of at most three digits (the contract's money scale). */
const DECIMAL = /^\d+(\.\d{1,3})?$/

/**
 * The fields read into the POST body's values, or the problem with each field. Every field is
 * required; numbers are non-negative with at most 3 decimals; a percentage is at most 100. The
 * contract names no ranges — these are the client's own floor (HITL-482); the server stays the
 * judge. `currencyKey` is carried, never typed (always `"SAR"` in v1).
 */
export function parseTermsDraft(
  draft: TermsDraft,
  currencyKey: string,
): { value: TermsValue | null; problems: Partial<Record<TermsField, TermsProblem>> } {
  const problems: Partial<Record<TermsField, TermsProblem>> = {}
  const validFrom = draft.validFrom.trim()
  if (validFrom === '') problems.validFrom = 'required'
  else if (day(validFrom) === null) problems.validFrom = 'date'

  const numbers: Partial<Record<TermsField, number>> = {}
  for (const field of TERMS_NUMBER_FIELDS) {
    const text = draft[field].trim()
    if (text === '') problems[field] = 'required'
    else if (!DECIMAL.test(text)) problems[field] = 'number'
    else if ((PERCENTS as readonly string[]).includes(field) && Number(text) > 100) problems[field] = 'percent'
    else numbers[field] = Number(text)
  }

  if (Object.keys(problems).length > 0) return { value: null, problems }
  return {
    value: {
      validFrom,
      customerDiscountPct: numbers.customerDiscountPct!,
      commissionPct: numbers.commissionPct!,
      deliveryFee: numbers.deliveryFee!,
      deliveryFeeThreshold: numbers.deliveryFeeThreshold!,
      currencyKey,
    },
    problems,
  }
}

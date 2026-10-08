/**
 * What the Document payments search asks the server for (ticket 433, spec 430 D4/D11). Pure.
 *
 * The filter bar edits a **draft** of these; only Search promotes it to the query.
 *
 * 🔑 The 1,000-number guard is the server's own rule, said before the call: the WPF screen and the
 * service both count `MultiValueFilter.Split(DocumentNo).Length + MultiValueFilter.Split(OrderNo).Length`
 * and refuse over `MaxValues` (1,000). `Split` uses the separators the core code-list splitter
 * uses, trims, drops empties and de-duplicates within one box (case-insensitively). So this counts
 * exactly that way: a pasted list that the server would take is never refused here, and one it
 * would refuse never makes the trip.
 */
import { normaliseCodeList } from '@/core/util/code-list'
import { fromIsoDate, toIsoDate } from '@/core/util/date-format'

/** The server's `MultiValueFilter.MaxValues`, counted across both number boxes together. */
export const MAX_NUMBERS = 1000

/** The WPF screen's default `Limit`. */
export const DEFAULT_LIMIT = 200

export interface PaymentsCriteria {
  /** Payments from this day, `yyyy-MM-dd`. */
  from: string
  /** Payments up to this day, `yyyy-MM-dd`. */
  to: string
  storeCode: string
  /** A `SdDocument/DocumentTypes` code; `''` is every type. */
  documentType: string
  customerPhone: string
  /** Document numbers as typed or pasted. */
  documentNos: string
  /** Order numbers as typed or pasted. */
  orderNos: string
  /** As typed; a positive whole number. */
  limit: string
}

export type CriteriaProblem =
  | { kind: 'badDate' }
  | { kind: 'reversed' }
  | { kind: 'badLimit' }
  | { kind: 'tooMany'; count: number }

/** The landing question: today's payments, the first 200. */
export function defaultCriteria(today: Date = new Date()): PaymentsCriteria {
  const day = toIsoDate(today)
  return {
    from: day,
    to: day,
    storeCode: '',
    documentType: '',
    customerPhone: '',
    documentNos: '',
    orderNos: '',
    limit: String(DEFAULT_LIMIT),
  }
}

/** The router-state key the applied search is kept under (see `criteriaFromState`). */
const STATE_KEY = 'paymentsCriteria'

const asRecord = (state: unknown): Record<string, unknown> =>
  typeof state === 'object' && state !== null && !Array.isArray(state) ? (state as Record<string, unknown>) : {}

/**
 * The history entry's state with the applied search in it, so Back from Document Details restores
 * it — `null` takes the search out. Whatever else the entry carried is kept.
 */
export function stateWithCriteria(state: unknown, c: PaymentsCriteria | null): Record<string, unknown> {
  const { [STATE_KEY]: _old, ...rest } = asRecord(state)
  return c ? { ...rest, [STATE_KEY]: { ...c } } : rest
}

/**
 * The applied search a history entry carries, read defensively: anything that is not a whole set
 * of string criteria is none. Router state, never a URL param: the numbers and the customer's phone
 * stay out of the address bar.
 */
export function criteriaFromState(state: unknown): PaymentsCriteria | null {
  const c = asRecord(state)[STATE_KEY]
  if (typeof c !== 'object' || c === null) return null
  const keys = Object.keys(defaultCriteria()) as (keyof PaymentsCriteria)[]
  const record = c as Record<string, unknown>
  if (!keys.every((k) => typeof record[k] === 'string')) return null
  return Object.fromEntries(keys.map((k) => [k, record[k]])) as unknown as PaymentsCriteria
}

/** How many numbers one box holds, as the server's `MultiValueFilter.Split` counts them. */
export function numberCount(text: string | null | undefined): number {
  const list = normaliseCodeList(text)
  if (list === '') return 0
  return new Set(list.split(',').map((n) => n.toUpperCase())).size
}

/** The numbers across both boxes — the figure the guard and its message use. */
export const totalNumbers = (c: PaymentsCriteria): number => numberCount(c.documentNos) + numberCount(c.orderNos)

/** The largest `Limit` the door's `int?` can bind. */
const MAX_LIMIT = 2_147_483_647

/** The limit as a number, or `null` when it is not a whole number from 1 to what the door can bind. */
function limitOf(text: string): number | null {
  const t = text.trim()
  if (!/^\d+$/.test(t)) return null
  const n = Number(t)
  return n > 0 && n <= MAX_LIMIT ? n : null
}

/**
 * Why the draft cannot be searched, or `null`. Both days are required (the door's `FromDate` and
 * `ToDate` are not optional); the number guard comes last so a date slip is said first.
 */
export function criteriaProblem(c: PaymentsCriteria): CriteriaProblem | null {
  if (!fromIsoDate(c.from) || !fromIsoDate(c.to)) return { kind: 'badDate' }
  // `yyyy-MM-dd` sorts as it reads.
  if (c.to < c.from) return { kind: 'reversed' }
  if (limitOf(c.limit) === null) return { kind: 'badLimit' }
  const count = totalNumbers(c)
  if (count > MAX_NUMBERS) return { kind: 'tooMany', count }
  return null
}

/**
 * The query parameters, named as the WPF screen sends them (D4: the WPF query unchanged).
 *
 * - The two number boxes go **as typed**: the server splits them again with the same rule.
 *   A box holding no number at all is left off.
 * - Store and phone are trimmed, because the server compares them exactly.
 * - Blank values are left for `buildQuery` to drop (`api-envelope`).
 */
export function criteriaToParams(c: PaymentsCriteria): Record<string, string> {
  const params: Record<string, string> = {
    FromDate: c.from.trim(),
    ToDate: c.to.trim(),
    Limit: String(limitOf(c.limit) ?? DEFAULT_LIMIT),
  }
  const put = (key: string, value: string) => {
    if (value.trim()) params[key] = value.trim()
  }
  put('StoreCode', c.storeCode)
  put('DocumentType', c.documentType)
  put('CustomerPhone', c.customerPhone)
  if (numberCount(c.documentNos) > 0) params.DocumentNo = c.documentNos
  if (numberCount(c.orderNos) > 0) params.OrderNo = c.orderNos
  return params
}

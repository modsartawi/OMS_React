/* PROTOTYPE 368 — throwaway (branch prototype/368-deliveries-list).
 *
 * Question: how does the whole Deliveries list arrange — views, filter tokens,
 * grid, inspector, J/K — on the Ops Console tokens? Three variants on the real
 * /oms/deliveries route, `?variant=A|B|C`, `?scenario=` seeds a state.
 *
 * This file is the pure part every variant shares: the settled CONTENT
 * (366 lenses + counts, 367 inspector fields, 369 timeline). The variants only
 * disagree about ARRANGEMENT.
 */
import type { DeliveryDocumentModel } from '@/core/models/delivery-document'
import { toIsoDate } from '@/core/util/date-format'
import { BLANK_CRITERIA, DEFAULT_LIMIT, type DeliveryFilterCriteria } from '../filter'

type Row = DeliveryDocumentModel

// ---------- lenses (366) ---------------------------------------------------------

export type LensKey = 'all' | 'attention' | 'cancelRequested' | 'dawaaNow' | 'rescheduled'

export const LENSES: { key: LensKey; test: (r: Row) => boolean }[] = [
  { key: 'all', test: () => true },
  { key: 'attention', test: (r) => (r.failedJobsCount ?? 0) > 0 },
  { key: 'cancelRequested', test: (r) => r.closeStatus === 'R' },
  { key: 'dawaaNow', test: (r) => r.isExpressDelivery === true },
  { key: 'rescheduled', test: (r) => r.rescheduled === true },
]

export const lensTest = (key: LensKey) => LENSES.find((l) => l.key === key)!.test

/** "—" before a search, "N+" on EVERY lens when the page hit its limit, else N. */
export function lensCount(rows: Row[] | null, key: LensKey, cut: boolean): string {
  if (rows === null) return '—'
  const n = rows.filter(lensTest(key)).length
  return cut ? `${n}+` : String(n)
}

// ---------- criteria with RELATIVE dates (366) --------------------------------------

export type RangePreset = 'today' | 'yesterday' | 'last3' | 'last7' | 'custom'
export interface DateRange {
  preset: RangePreset
  from?: string // yyyy-MM-dd, custom only
  to?: string
}

/** The draft/applied criteria: today's 14 filters, the date pair held as one relative range. */
export type ProtoCriteria = Omit<DeliveryFilterCriteria, 'fromDate' | 'toDate'> & { range: DateRange | null }

export const BLANK: ProtoCriteria = (() => {
  const { fromDate: _f, toDate: _t, ...rest } = BLANK_CRITERIA
  return { ...rest, range: null }
})()

function dayOffset(n: number) {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - n)
  return d
}

export function resolveRange(range: DateRange | null): { from: Date; to: Date } | null {
  if (!range) return null
  switch (range.preset) {
    case 'today':
      return { from: dayOffset(0), to: dayOffset(0) }
    case 'yesterday':
      return { from: dayOffset(1), to: dayOffset(1) }
    case 'last3':
      return { from: dayOffset(2), to: dayOffset(0) }
    case 'last7':
      return { from: dayOffset(6), to: dayOffset(0) }
    case 'custom':
      return range.from && range.to ? { from: new Date(range.from), to: new Date(range.to) } : null
  }
}

/** Into the unchanged search contract — `buildDeliveryQuery` stays the wire. */
export function toCriteria(c: ProtoCriteria): DeliveryFilterCriteria {
  const r = resolveRange(c.range)
  const { range: _r, ...rest } = c
  return { ...rest, fromDate: r?.from ?? null, toDate: r?.to ?? null }
}

/** The 14 filters as editable fields; the date pair is one field ("range"). */
export type FieldKey =
  | 'range'
  | 'storeCode'
  | 'deliveryNo'
  | 'customerPhone'
  | 'documentNo'
  | 'orderNo'
  | 'documentType'
  | 'documentSource'
  | 'deliveryDocumentType'
  | 'documentReason'
  | 'deliveryType'
  | 'isExpress'
  | 'limit'

export type FieldKind = 'range' | 'text' | 'select' | 'tri' | 'number'

export const FIELDS: { key: FieldKey; kind: FieldKind; group: 'when' | 'find' | 'narrow' | 'limit'; options?: string[] }[] = [
  { key: 'range', kind: 'range', group: 'when' },
  { key: 'deliveryNo', kind: 'text', group: 'find' },
  { key: 'documentNo', kind: 'text', group: 'find' },
  { key: 'orderNo', kind: 'text', group: 'find' },
  { key: 'customerPhone', kind: 'text', group: 'find' },
  { key: 'storeCode', kind: 'text', group: 'narrow' },
  // Lookup options are fixed here: the stub serves empty lookups.
  { key: 'documentType', kind: 'select', group: 'narrow', options: ['APPO', 'CLCN', 'WEBO'] },
  { key: 'documentSource', kind: 'select', group: 'narrow', options: ['App', 'Call center', 'Web'] },
  { key: 'deliveryDocumentType', kind: 'select', group: 'narrow', options: ['Forward', 'Return'] },
  { key: 'deliveryType', kind: 'select', group: 'narrow', options: ['Delivery', 'PickInStore'] },
  { key: 'isExpress', kind: 'tri', group: 'narrow' },
  { key: 'documentReason', kind: 'text', group: 'narrow' },
  { key: 'limit', kind: 'number', group: 'limit' },
]

export const fieldValue = (c: ProtoCriteria, k: FieldKey): unknown => (c as Record<string, unknown>)[k]

export function isSet(c: ProtoCriteria, k: FieldKey): boolean {
  const v = fieldValue(c, k)
  return v !== null && v !== undefined && v !== ''
}

const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null)

/** Fields whose draft differs from what last ran (the "not yet searched" flags). */
export function pendingFields(draft: ProtoCriteria, applied: ProtoCriteria | null): FieldKey[] {
  const base = applied ?? BLANK
  return FIELDS.map((f) => f.key).filter((k) => !same(fieldValue(draft, k), fieldValue(base, k)))
}

export const sameCriteria = (a: ProtoCriteria | null, b: ProtoCriteria | null) => same(a, b)

export function rangeLabel(r: DateRange, t: (k: string, o?: Record<string, unknown>) => string): string {
  if (r.preset !== 'custom') return t(`range.${r.preset}`)
  return `${r.from ?? '…'} → ${r.to ?? '…'}`
}

export const isoToday = () => toIsoDate(dayOffset(0))
export { DEFAULT_LIMIT }

// ---------- the 369 timeline, inspector variant (row fields only) -------------------

export type StepKey = 'created' | 'ready' | 'out' | 'delivered' | 'requested' | 'cancelled'
export type StepState = 'done' | 'current' | 'next' | 'todo' | 'requested' | 'cancelled'
export interface Step {
  key: StepKey
  state: StepState
  time?: string // a real milestone time from a row field
  expect?: string // the slot window, styled as an expectation, never a timestamp
  marker?: 'rescheduled'
  markerTime?: string
}

export const isPickup = (r: Row) => /^(P|PickInStore)$/i.test((r.deliveryType ?? '').trim())

export function timeline(r: Row): Step[] {
  const keys: StepKey[] = isPickup(r) ? ['created', 'ready', 'delivered'] : ['created', 'ready', 'out', 'delivered']
  const reached = (k: StepKey) =>
    k === 'created' ||
    (k === 'ready' && ['R', 'C'].includes(r.readyStatus) && true) ||
    (k === 'out' && r.deliveryStatus === 'O') ||
    (k === 'delivered' && r.deliveryStatus === 'D')
  let furthest = 0
  keys.forEach((k, i) => {
    if (reached(k)) furthest = i
  })
  if (r.deliveryStatus === 'D') furthest = keys.length - 1 // Delivered completes the timeline

  const times: Partial<Record<StepKey, string>> = {
    created: r.entryTime || undefined,
    out: r.outForDeliveryTime || undefined,
    delivered: r.actualDeliveryTime || undefined,
  }
  const close = (r.closeStatus ?? '').trim()
  const closed = close === 'R' ? 'requested' : ['C', 'N', 'X'].includes(close) ? 'cancelled' : null

  const steps: Step[] = keys.slice(0, furthest + 1).map((key, i) => ({
    key,
    state: i === furthest && !closed && key !== 'delivered' ? 'current' : 'done',
    time: times[key],
  }))
  if (r.rescheduled) {
    const cur = steps[steps.length - 1]
    cur.marker = 'rescheduled'
    cur.markerTime = r.rescheduledTime || undefined
  }

  if (closed) {
    // A cancellation REPLACES the next step; later steps are dropped, not greyed.
    if (close === 'X' || furthest === keys.length - 1) steps.pop()
    steps.push({ key: closed, state: closed })
    return steps
  }
  const next = keys[furthest + 1]
  if (next) {
    steps.push({
      key: next,
      state: 'next',
      expect:
        r.deliveryScheduleFromTime && r.deliveryScheduleToTime
          ? `${r.deliveryScheduleFromTime.slice(11, 16)}–${r.deliveryScheduleToTime.slice(11, 16)}`
          : undefined,
    })
    keys.slice(furthest + 2).forEach((key) => steps.push({ key, state: 'todo' }))
  }
  return steps
}

/** One status word for the row (grid Status column, inspector header). */
export type Tone = 'neutral' | 'info' | 'ok' | 'warn' | 'bad'
export function rowStatus(r: Row): { key: StepKey; tone: Tone } {
  const close = (r.closeStatus ?? '').trim()
  if (close === 'R') return { key: 'requested', tone: 'warn' }
  if (['C', 'N', 'X'].includes(close)) return { key: 'cancelled', tone: 'bad' }
  if (r.deliveryStatus === 'D') return { key: 'delivered', tone: 'ok' }
  if (r.deliveryStatus === 'O') return { key: 'out', tone: 'info' }
  if (['R', 'C'].includes(r.readyStatus)) return { key: 'ready', tone: 'neutral' }
  return { key: 'created', tone: 'neutral' }
}

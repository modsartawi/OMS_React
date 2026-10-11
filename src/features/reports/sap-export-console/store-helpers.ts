/**
 * The store page's pure logic (BackOffice spec 2579, ticket 464): the 30-day strip's cells and
 * the store's export facts. Pinned by `store-helpers.test.ts`.
 *
 * 🚩 The rollup judges; nothing here derives a day's worst label or its verdict. A cell only
 * names and colours what `Store/Days` sent, through the one label ruling (`./label-helpers`).
 */
import type { Accounting, Label, StoreDaySummary, StoreDetail } from '@/core/models/sap-export'
import { formatDay } from '@/core/util/date-format'
import { WORST_FIRST, labelToken, unknownLabelCounts, type LabelToken } from './label-helpers'
import { figure } from './storeday-helpers'
import { refusalKey } from './toggle-and-refusal'

export interface StripCell {
  day: string
  /** The rollup never computed this day: drawn hatched, with no counts. */
  noData: boolean
  /** The worst label's token; a day with nothing to judge (no data, no transactions) is muted. */
  token: LabelToken
  /** As sent — a label this bundle does not know is kept raw (and drawn neutral). */
  worst: string | null
  /** The day's export accounting breaks: the cell carries a marker. */
  breaks: boolean
  total: number
  /** The day's non-zero label counts, worst first (the hover). */
  counts: { label: Label; count: number }[]
  /** Non-zero counts of labels a newer door sends that this bundle does not know, drawn raw. */
  unknown: { label: string; count: number }[]
  accounting: Accounting | null
}

/** One cell per day, oldest first, coloured by the day's `worst` label. */
export function stripCells(days: readonly StoreDaySummary[]): StripCell[] {
  return [...days]
    .sort((a, b) => a.day.localeCompare(b.day))
    .map((d) => ({
      day: d.day,
      noData: d.noData,
      token: d.noData || d.worst == null ? 'muted' : labelToken(d.worst).token,
      worst: d.noData ? null : d.worst,
      breaks: !d.noData && d.accounting === 'breaks',
      total: d.total,
      counts: d.noData ? [] : WORST_FIRST.filter((l) => (d.labels[l] ?? 0) > 0).map((label) => ({ label, count: d.labels[label] })),
      unknown: d.noData ? [] : unknownLabelCounts(d.labels),
      accounting: d.accounting,
    }))
}

export type StoreFactKey = 'underSap' | 'counterRow' | 'watermark' | 'openDate' | 'closed' | 'inventoryDate'

export interface StoreFact {
  key: StoreFactKey
  /** A machine value as drawn (a figure, a day); `''` = blank. Used when `valueKey` is null. */
  value: string
  /** The value in words (`sap-export-console` key), or `null` to draw `value`. */
  valueKey: string | null
  /** Interpolated into `valueKey` (the SAP locations). */
  count?: number
  /** A master-data fact that leaves transactions stuck from the first moment. */
  danger: boolean
  /** The plain-English cause of a danger fact (the ladder's L6 / L7 meaning), or `null`. */
  causeKey: string | null
}

const V = 'store.facts.values'
const machine = (key: StoreFactKey, value: string): StoreFact => ({ key, value, valueKey: null, danger: false, causeKey: null })

/**
 * The store's export facts, in the header's order. A store with no SAP location (L6) or no counter
 * row (L7) reads as danger with its cause; a null watermark or date is blank.
 */
export function storeFacts(store: StoreDetail): StoreFact[] {
  const f = store.facts
  const noSap = !f.underSap || f.sapLocations === 0
  return [
    noSap
      ? { key: 'underSap', value: '', valueKey: `${V}.notUnderSap`, danger: true, causeKey: 'store.facts.causes.L6' }
      : { key: 'underSap', value: '', valueKey: `${V}.sapLocations`, count: f.sapLocations, danger: false, causeKey: null },
    f.hasCounterRow
      ? { key: 'counterRow', value: '', valueKey: `${V}.counterPresent`, danger: false, causeKey: null }
      : { key: 'counterRow', value: '', valueKey: `${V}.counterMissing`, danger: true, causeKey: 'store.facts.causes.L7' },
    machine('watermark', f.watermark == null ? '' : figure(f.watermark)),
    machine('openDate', formatDay(f.openDate)),
    { key: 'closed', value: '', valueKey: f.closed ? `${V}.yes` : `${V}.no`, danger: false, causeKey: null },
    machine('inventoryDate', formatDay(f.inventoryDate)),
  ]
}

const RECOMPUTE_REFUSALS = ['BAD_REQUEST', 'NO_STORE', 'BAD_DAY', 'DAY_OUT_OF_WINDOW'] as const

/** A recompute refusal's own sentence key, or `null` to show the envelope's message. */
export function recomputeErrorKey(code: string | null | undefined): string | null {
  return refusalKey('recompute', RECOMPUTE_REFUSALS, code)
}

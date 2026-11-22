/**
 * A store's Holds list, as drawn (oms 942, BackOffice spec 4157 stories 36–39) — pure. Each hold's age, its state in
 * the console's words, its picking document or till sale as one value, and the columns: the released filter adds when
 * and why a hold was released. Nothing is joined from OMS — only what the route answers is drawn.
 */
import type { StockConsoleHoldRow } from '@/core/models/stock-console'
import type { Severity } from '@/core/ui/severity'
import { formatPair } from '@/core/util/bidi'
import { ageView, localMs, type AgeView } from './age'

/**
 * How long a hold has stood: from its taking to the reader's `now` — or, once released, to its release (how long it
 * was held). Null when its time does not read.
 */
export function holdAge(row: StockConsoleHoldRow, now: number): AgeView | null {
  const taken = localMs(row.takenAt)
  if (taken === null) return null
  const end = row.releasedAt ? (localMs(row.releasedAt) ?? now) : now
  return ageView((end - taken) / 1000)
}

const STATE_SEV: Record<string, Severity> = { Held: 'go', Sold: 'warn', Released: 'mute' }

/** A hold's state: standing, sold not applied or released in words; an unknown one as it came, as a Watch. */
export type HoldStateCell = { key: string; sev: Severity } | { raw: string; sev: Severity }

export function holdStateCell(state: string): HoldStateCell {
  return Object.hasOwn(STATE_SEV, state) ? { key: `holds.state.${state}`, sev: STATE_SEV[state] } : { raw: state, sev: 'warn' }
}

/** A picking hold's document and line, or a till sale's store and transaction — each one value, isolated once. */
export function holdDocument(row: StockConsoleHoldRow): { key: string; text: string } | null {
  if (row.documentNo) return { key: 'holds.document.picking', text: formatPair(row.documentNo, row.lineNumber ?? '') }
  if (row.soldStore || row.soldTrx) return { key: 'holds.document.till', text: formatPair(row.soldStore ?? '', row.soldTrx ?? '') }
  return null
}

export const HOLD_COLUMNS = [
  'takeId',
  'item',
  'name',
  'batch',
  'quantity',
  'takenAt',
  'age',
  'state',
  'source',
  'document',
  'releasedAt',
  'releaseReason',
] as const
export type HoldColumn = (typeof HOLD_COLUMNS)[number]

/** The columns for a state filter, in order: when and why a hold was released only on the released list. */
export const holdColumns = (filter: string): readonly HoldColumn[] =>
  filter === 'released' ? HOLD_COLUMNS : HOLD_COLUMNS.filter((c) => c !== 'releasedAt' && c !== 'releaseReason')

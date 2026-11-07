import type { HybrisStockStoreRow } from '@/core/models/hybris-stock'
import type { Severity } from '@/core/ui/severity'

// A Hybris stock store's health as the list reads it (spec 3447 stories 10–11; ticket 847). Pure.
//
// 🔑 The server does the arithmetic — "delta behind by more than two intervals" and "full overdue"
// arrive as flags (story 11: "so that I do not have to do the arithmetic"). This module only decides
// how a row reads and whether it is highlighted, and it reads an explicit `true` only, so a stub or
// an older door that never sent a flag never paints a store red.

export type HealthReading =
  /** Not a Hybris stock store: no health block, nothing sent. */
  | 'unmarked'
  /** Marked, waiting for its first full (full requested, no full yet). */
  | 'awaitingFull'
  | 'ok'
  /** The last push failed, but the store is not yet behind. */
  | 'lastFailed'
  /** Unhealthy: the delta is behind, the full is overdue, or both. */
  | 'unhealthy'

export type UnhealthyCause = 'deltaBehind' | 'fullOverdue'

export interface StoreHealthView {
  reading: HealthReading
  /** Why an unhealthy store is unhealthy, in a fixed order; empty otherwise. */
  causes: UnhealthyCause[]
  /** The row highlight and the badge's tone: unhealthy red, a failed last push amber. */
  highlight: Severity | null
  sev: Severity
}

export function storeHealth(row: Pick<HybrisStockStoreRow, 'marked' | 'health'>): StoreHealthView {
  const h = row.marked ? row.health : null
  if (!row.marked) return { reading: 'unmarked', causes: [], highlight: null, sev: 'mute' }
  if (!h) return { reading: 'awaitingFull', causes: [], highlight: null, sev: 'mute' }
  const causes: UnhealthyCause[] = []
  if (h.deltaBehind === true) causes.push('deltaBehind')
  if (h.fullOverdue === true) causes.push('fullOverdue')
  if (causes.length > 0) return { reading: 'unhealthy', causes, highlight: 'bad', sev: 'bad' }
  if (h.lastError) return { reading: 'lastFailed', causes, highlight: 'warn', sev: 'warn' }
  if (h.fullRequested === true || !h.lastFullAt) return { reading: 'awaitingFull', causes, highlight: null, sev: 'mute' }
  return { reading: 'ok', causes, highlight: null, sev: 'ok' }
}

/** Every reading, for the i18n key check. */
export const HEALTH_READINGS: readonly HealthReading[] = ['unmarked', 'awaitingFull', 'ok', 'lastFailed', 'unhealthy']
export const UNHEALTHY_CAUSES: readonly UnhealthyCause[] = ['deltaBehind', 'fullOverdue']

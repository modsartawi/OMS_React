/**
 * A store's Feeds tab (oms 942, BackOffice spec 4157 stories 49 and 51) — pure. The nightly comparison with SAP runs
 * for counted stores only (Seeded or Blocking): a store not counted has none, and a counted one whose comparison has
 * not run yet says so — neither reads as "matches".
 */
import type { StockConsoleStoreFeeds } from '@/core/models/stock-console'

export type ComparisonView =
  | { kind: 'notCounted' }
  | { kind: 'notYet' }
  | { kind: 'differs'; batches: number; at: string | null }
  | { kind: 'matches'; at: string | null }

const COUNTED = ['Seeded', 'Blocking']

export function comparisonView(feeds: StockConsoleStoreFeeds): ComparisonView {
  if (typeof feeds.driftBatches !== 'number') return COUNTED.includes(feeds.stage) ? { kind: 'notYet' } : { kind: 'notCounted' }
  const at = feeds.driftRanAt ?? null
  return feeds.driftBatches > 0 ? { kind: 'differs', batches: feeds.driftBatches, at } : { kind: 'matches', at }
}

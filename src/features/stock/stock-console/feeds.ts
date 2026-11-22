/**
 * A store's Feeds tab (oms 942, BackOffice spec 4157 stories 49 and 51) — pure. The nightly comparison with SAP covers
 * counted stores only: SIS.Api says whether it covers this one (`counted`), and a store it does not cover has none —
 * never read as "matches".
 */
import type { StockConsoleStoreFeeds } from '@/core/models/stock-console'

export type ComparisonView =
  | { kind: 'notCounted' }
  | { kind: 'differs'; batches: number; at: string | null }
  | { kind: 'matches'; at: string | null }

export function comparisonView(feeds: StockConsoleStoreFeeds): ComparisonView {
  if (!feeds.counted || feeds.driftBatches === null) return { kind: 'notCounted' }
  const at = feeds.driftRanAt
  return feeds.driftBatches > 0 ? { kind: 'differs', batches: feeds.driftBatches, at } : { kind: 'matches', at }
}

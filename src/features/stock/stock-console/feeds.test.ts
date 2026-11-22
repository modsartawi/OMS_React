import { describe, expect, it } from 'vitest'
import type { StockConsoleStoreFeeds } from '@/core/models/stock-console'
import { comparisonView } from './feeds'

const feeds = (over: Partial<StockConsoleStoreFeeds> = {}): StockConsoleStoreFeeds => ({
  plant: 'P077',
  sapPlace: '2026-11-22T09:00:00',
  sapLastAttempt: '2026-11-22T09:05:00',
  tillPlace: '2026-11-22T09:50:00',
  tillLastAttempt: '2026-11-22T09:55:00',
  stage: 'Seeded',
  driftBatches: 0,
  driftRanAt: '2026-11-22T02:00:00',
  ...over,
})

describe('a store’s nightly comparison', () => {
  it('a store not counted yet has none, and says so', () => {
    expect(comparisonView(feeds({ stage: 'Shadow', driftBatches: null, driftRanAt: null }))).toEqual({ kind: 'notCounted' })
  })

  it('a counted store whose comparison has not run says "none yet" — not "matches"', () => {
    expect(comparisonView(feeds({ stage: 'Blocking', driftBatches: null, driftRanAt: null }))).toEqual({ kind: 'notYet' })
  })

  it('differing batches, and when it ran', () => {
    expect(comparisonView(feeds({ driftBatches: 7 }))).toEqual({ kind: 'differs', batches: 7, at: '2026-11-22T02:00:00' })
  })

  it('no differing batch: it matches, and when it ran', () => {
    expect(comparisonView(feeds())).toEqual({ kind: 'matches', at: '2026-11-22T02:00:00' })
  })
})

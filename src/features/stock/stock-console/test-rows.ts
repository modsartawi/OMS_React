/**
 * Test-only builders for the stock console's rows (only `*.test.ts` import this, so no bundle carries it).
 * The defaults are a quiet shadow store with reserved never computed — the console's first day.
 */
import type { StockConsoleFlag, StockConsoleStoreRow } from '@/core/models/stock-console'

export const flag = (code: string, level = 'Watch', value: number | null = 1, limit: number | null = 0): StockConsoleFlag => ({
  code,
  level,
  value,
  limit,
})

export const storeRow = (over: Partial<StockConsoleStoreRow> = {}): StockConsoleStoreRow => ({
  plant: 'P001',
  city: 'Riyadh',
  stage: 'Shadow',
  itemsWithStock: 10,
  sapStock: 100,
  tillStock: 90,
  gap: 10,
  heldStanding: 3,
  heldSold: 2,
  held: 5,
  reserved: null,
  reservedState: 'NeverComputed',
  reservedAt: null,
  free: 85,
  reservedIncluded: false,
  belowZero: 0,
  lastUpdate: '2026-11-22T10:00:00',
  oldestStandingAt: null,
  oldestSoldAt: null,
  sapPlace: null,
  sapLastAttempt: null,
  tillPlace: null,
  tillLastAttempt: null,
  driftBatches: null,
  driftRanAt: null,
  placeholderStock: null,
  flags: [],
  status: 'Ok',
  ...over,
})

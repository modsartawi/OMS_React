// A unit's history, asked ON DEMAND only (ticket 454, spec 2544 story 41). Pure: no React.
//
// No history call is made until a row is expanded, and after that one call per UNIT: the query is
// keyed on material + serial + lot, so the same unit scanned twice (a duplicate) and the same row
// opened again both read the one cached answer rather than asking again. The server's
// `historyCount` rides in the key too: a re-scan that says the trail has GROWN asks again, so the
// pane never contradicts the card.

import type { Gs1CheckAnswer } from '@/core/models/materials'
import { gs1CheckApi, type Gs1HistoryRequest } from './api'

/**
 * What a checked scan's history is asked by — or `null` when there is nothing to ask: no answer
 * yet, no material, or no serial (the ledger is keyed on material + serial).
 */
export function historyRequest(answer: Gs1CheckAnswer | null | undefined): Gs1HistoryRequest | null {
  const material = answer?.material?.materialNumber ?? null
  const serial = answer?.parse.serial ?? null
  if (!material || !serial) return null
  return { material, serial, lot: answer?.parse.lot || null }
}

/** The ONE cache key for a unit: material + serial + lot, and the history count the check gave. */
export const historyKey = (request: Gs1HistoryRequest | null, historyCount: number | null = null) =>
  ['materials', 'gs1History', request?.material ?? null, request?.serial ?? null, request?.lot ?? null, historyCount] as const

/**
 * The history query's options. `enabled` only while the unit's row is expanded; `staleTime:
 * Infinity` so a unit opened once is not asked again in this page life — until a re-scan's
 * `historyCount` (part of the key) says the trail has changed. A failure is shown, not retried.
 */
export function historyQuery(request: Gs1HistoryRequest | null, expanded: boolean, historyCount: number | null = null) {
  return {
    queryKey: historyKey(request, historyCount),
    queryFn: () => gs1CheckApi.history(request as Gs1HistoryRequest),
    enabled: expanded && request !== null,
    staleTime: Infinity,
    retry: false,
    refetchOnWindowFocus: false,
  } as const
}

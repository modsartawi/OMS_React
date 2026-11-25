/**
 * BackOffice 4277 (spec 4275 "What head office sees", ADR 0146; SIS.Stock 086): the store's takes per day of the would-be
 * refusals' window, as the stage sheet draws them — pure, pinned by `refusal-days.test.ts`. The fallback's share of
 * scanned takes sits beside the would-be refusal share; in a `Record` store the refusals the fallback would have placed
 * show too. A fallback take is a placed take, never a refusal, and the fallback has no gate of its own: the person who
 * confirms the refusals were read confirms both figures.
 */
import type { StoreGates } from '@/core/models/store-stage'

export interface RefusalDayLine {
  /** `yyyy-MM-dd`. */
  day: string
  takes: number
  refused: number
  /** A percentage to two places; '' on a day with nothing to share. */
  refusalShare: string
  scannedTakes: number
  fallbackTakes: number
  fallbackShare: string
  wouldBePlacements: number
}

export interface RefusalDaysView {
  /** The store's expiry fallback state as the gates answer names it; null from a server without it. */
  state: string | null
  /** A `Record` store: the would-be placements are shown. */
  showWouldBe: boolean
  lines: RefusalDayLine[]
}

/** A fraction (4 dp from the server) as a percentage to two places; null is blank, never 0%. */
export const formatShare = (fraction: number | null | undefined): string =>
  typeof fraction === 'number' && Number.isFinite(fraction) ? `${(fraction * 100).toFixed(2)}%` : ''

export function refusalDaysView(gates: StoreGates | null | undefined): RefusalDaysView {
  const state = gates?.expiryFallback || null
  return {
    state,
    showWouldBe: state === 'Record',
    lines: (gates?.refusalDays ?? []).map((d) => ({
      day: d.day.slice(0, 10),
      takes: d.takes,
      refused: d.refused,
      refusalShare: formatShare(d.refusalShare),
      scannedTakes: d.scannedTakes,
      fallbackTakes: d.fallbackTakes,
      fallbackShare: formatShare(d.fallbackShare),
      wouldBePlacements: d.wouldBePlacements,
    })),
  }
}

/** The table's column ids, each with its header in both locales. */
export const REFUSAL_DAY_COLUMNS = [
  'day', 'takes', 'refused', 'refusalShare', 'scannedTakes', 'fallbackTakes', 'fallbackShare', 'wouldBePlacements',
] as const

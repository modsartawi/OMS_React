/**
 * The shelf chance figures with their evidence (ticket 972, results ticket decision 6 and the amendments by BO 4304,
 * 4327, 4349 and 4283), as BO 4396 reads them: one row per mode and stock class, the lines of one-line deliveries of the
 * app and the site behind it over the evidence's 90 days, the failed lines, the ratio against what the figure expects,
 * the two halves of the window, and the server's verdict — enough to change, inside chance, too few, not steady. Each
 * mode's fleet ratio beside them, read and never a limit.
 *
 * The evidence rides on the phase 2 bar's reading (`Results/Phase2Bar`); BO 4393's `Results/Checks` does not carry it.
 * SERVER GAP (spec 4354) — the 36 cells by units asked and left over, the every-delivery ratio, the lines per channel
 * group and "Counts by half-year" are not answered by any door; the page shows the rows only.
 *
 * Pure. Figures and verdicts as sent: the server judges, the page shows.
 */
import type { BarClose, BarReading, ResultsShipMode, ShelfChanceVerdict } from '@/core/models/sourcing-results'

const MODES: readonly string[] = ['DAWAA_NOW', 'SLOT', 'PICK_UP']
/** `StockClasses.ReadOrder`. */
const CLASSES: readonly string[] = ['NO_STOCK_ROW', 'BOOK_BELOW_ZERO', 'BOOK_AT_ZERO', 'BOOK_SHORT', 'HELD_BY_DELIVERIES', 'HELD_BY_ORDERS', 'COVERED']

export interface ShelfEvidenceRow {
  /** `MODE|STOCK_CLASS`: the key a ruling on it is closed under. */
  key: string
  mode: ResultsShipMode
  stockClass: string
  lines: number
  failedLines: number
  expected: number
  ratio: number | null
  fits: number
  chanceGap: number
  firstHalf: number | null
  secondHalf: number | null
  daysCounted: number
  verdict: ShelfChanceVerdict
  /** Enough evidence to change and no written ruling yet: limit e waits for one. */
  awaitsRuling: boolean
  ruling: BarClose | null
}

export interface ShelfEvidence {
  rows: ShelfEvidenceRow[]
  fleetRatios: { mode: ResultsShipMode; ratio: number | null; expected: number; lines: number }[]
}

const at = (list: readonly string[], v: string) => {
  const i = list.indexOf(v)
  return i < 0 ? list.length : i
}

export function shelfEvidence(reading: Pick<BarReading, 'shelfChance' | 'read'>): ShelfEvidence {
  return {
    rows: [...reading.shelfChance]
      .sort((a, b) => at(MODES, a.mode) - at(MODES, b.mode) || at(CLASSES, a.stockClass) - at(CLASSES, b.stockClass))
      .map((r) => ({
        key: `${r.mode}|${r.stockClass}`,
        mode: r.mode,
        stockClass: r.stockClass,
        lines: r.lines,
        failedLines: r.failedLines,
        expected: r.expected,
        ratio: r.ratio ?? null,
        fits: r.fits,
        chanceGap: r.chanceGap,
        firstHalf: r.firstHalf ?? null,
        secondHalf: r.secondHalf ?? null,
        daysCounted: r.daysCounted,
        verdict: r.verdict,
        awaitsRuling: r.needsRuling && !r.ruling,
        ruling: r.ruling ?? null,
      })),
    fleetRatios: [...reading.read.fleetRatios]
      .sort((a, b) => at(MODES, a.mode) - at(MODES, b.mode))
      .map((f) => ({ mode: f.mode, ratio: f.ratio ?? null, expected: f.expected, lines: f.lines })),
  }
}

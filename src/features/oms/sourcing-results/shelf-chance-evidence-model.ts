/**
 * The shelf chance table with its evidence (ticket 972, results ticket decision 6 and the amendments by BO 4304, 4327,
 * 4349 and 4283): 36 cells by units asked and units left over for one mode, each with the chance in the weight set's
 * table and its evidence; the eight short-figure rows "from deliveries" with their one-line and every-delivery ratios
 * and the lines behind both per channel group; the mode's fleet ratio, the window and the number of counts.
 *
 * Pure. Figures as sent. One rule is the page's to show: "too few" stands where the figure expects under 50 failed
 * lines (BO 4283's amendment), so a reading sent against it is not drawn.
 */
import { sequentialWeight } from '@/core/charts/sequential'
import {
  RESULTS_ASKED,
  RESULTS_LEFT_OVERS,
  type ResultsChecksReply,
  type ResultsEvidenceGroup,
  type ResultsEvidenceReading,
  type ResultsPromiseMode,
  type ResultsShelfCell,
  type ResultsShortFigureRow,
} from '@/core/models/sourcing-results'

type Shelf = ResultsChecksReply['shelf']

/** Under this many expected failed lines a figure reads "too few" (BO 4283's amendment of the results ticket). */
export const TOO_FEW_UNDER = 50

const SHELF_MODES: readonly ResultsPromiseMode[] = ['DAWAA_NOW', 'SLOT', 'PICK_UP']
const ROW_MODES: readonly ResultsShortFigureRow['mode'][] = ['SLOT', 'PICK_UP']
const ROW_CLASSES: readonly ResultsShortFigureRow['stockClass'][] = ['BOOK_BELOW_ZERO', 'BOOK_AT_ZERO', 'BOOK_SHORT', 'HELD_BY_DELIVERIES']
const GROUPS: readonly ResultsEvidenceGroup[] = ['APP_SITE', 'CC_OUTBOUND', 'CC_OTHER']

export interface ShelfCellView extends ResultsShelfCell {
  key: string
  /** The cell's shade, a sequential weight (geometry only, never written as a figure). */
  heat: number
}

export interface ShortFigureRowView extends ResultsShortFigureRow {
  key: string
  /** The eight rows come from deliveries, apart from the cells that come from counts. */
  source: 'DELIVERIES'
}

export interface ShelfEvidence {
  set: Shelf['set']
  window: Shelf['window']
  halves: Shelf['halves']
  fleetRatio: number | null
  fleetRatios: { mode: ResultsPromiseMode; ratio: number | null }[]
  grid: { asked: number; cells: (ShelfCellView | null)[] }[]
  rows: ShortFigureRowView[]
}

const readingOf = (expectedFailed: number, sent: ResultsEvidenceReading): ResultsEvidenceReading =>
  expectedFailed < TOO_FEW_UNDER ? 'TOO_FEW' : sent

const order = <T>(list: readonly T[], v: T) => {
  const i = list.indexOf(v)
  return i < 0 ? list.length : i
}

export function shelfEvidence(shelf: Shelf, mode: ResultsPromiseMode): ShelfEvidence {
  const modeRow = shelf.modes.find((m) => m.mode === mode)
  const cells = modeRow?.cells ?? []
  const chances = cells.map((c) => c.chance)
  const min = Math.min(...chances)
  const max = Math.max(...chances)
  const at = (asked: number, leftOver: string) => cells.find((c) => c.asked === asked && c.leftOver === leftOver)

  return {
    set: shelf.set,
    window: shelf.window,
    halves: shelf.halves,
    fleetRatio: modeRow?.fleetRatio ?? null,
    fleetRatios: [...shelf.modes]
      .sort((a, b) => order(SHELF_MODES, a.mode) - order(SHELF_MODES, b.mode))
      .map((m) => ({ mode: m.mode, ratio: m.fleetRatio })),
    grid: RESULTS_ASKED.map((asked) => ({
      asked,
      cells: RESULTS_LEFT_OVERS.map((leftOver) => {
        const c = at(asked, leftOver)
        if (!c) return null
        return { ...c, key: `${asked}:${leftOver}`, heat: sequentialWeight(c.chance, min, max), reading: readingOf(c.expectedFailed, c.reading) }
      }),
    })),
    rows: [...shelf.rows]
      .sort((a, b) => order(ROW_MODES, a.mode) - order(ROW_MODES, b.mode) || order(ROW_CLASSES, a.stockClass) - order(ROW_CLASSES, b.stockClass))
      .map((r) => ({
        ...r,
        key: `${r.mode}:${r.stockClass}`,
        source: 'DELIVERIES' as const,
        groups: [...r.groups].sort((a, b) => order(GROUPS, a.group) - order(GROUPS, b.group)),
        reading: readingOf(r.oneLine.expectedFailed, r.reading),
      })),
  }
}

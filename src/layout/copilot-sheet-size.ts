import { create } from 'zustand'

// The copilot sheet's size (CTO demo): its width as the user dragged it, and whether it fills the screen ("full view").
// A per-user preference, persisted as the rail's is (`./rail-preference`). The conversation itself never is.
const STORAGE_KEY = 'oms.copilotSheet'

/** The sheet's width before anyone resizes it: 32rem. */
export const SHEET_DEFAULT_WIDTH = 512
/** The narrowest the sheet may be dragged: the question box and an answer's table still fit. */
export const SHEET_MIN_WIDTH = 380
/** What the screen keeps beside a dragged sheet, so its backdrop can still be clicked to close it. */
const SHEET_GUTTER = 48

/** A width the sheet can take on a viewport this wide: never under the minimum, never past the gutter. */
export function clampSheetWidth(width: number, viewport: number): number {
  const max = Math.max(SHEET_MIN_WIDTH, viewport - SHEET_GUTTER)
  if (!Number.isFinite(width)) return Math.min(SHEET_DEFAULT_WIDTH, max)
  return Math.round(Math.min(max, Math.max(SHEET_MIN_WIDTH, width)))
}

export interface SheetSize {
  width: number
  full: boolean
}

/** The stored value → a size. Anything this store did not write reads as the default. */
export function parseSheetSize(raw: string | null): SheetSize {
  try {
    const v = raw ? (JSON.parse(raw) as Partial<SheetSize>) : null
    const width = typeof v?.width === 'number' && Number.isFinite(v.width) ? v.width : SHEET_DEFAULT_WIDTH
    return { width: Math.max(SHEET_MIN_WIDTH, Math.round(width)), full: v?.full === true }
  } catch {
    return { width: SHEET_DEFAULT_WIDTH, full: false }
  }
}

function initial(): SheetSize {
  try {
    return parseSheetSize(localStorage.getItem(STORAGE_KEY))
  } catch {
    return { width: SHEET_DEFAULT_WIDTH, full: false } // storage unavailable
  }
}

function save(size: SheetSize) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(size))
  } catch {
    /* storage unavailable — the size just won't persist */
  }
}

interface CopilotSheetSizeState extends SheetSize {
  /** A drag in progress: the width moves, nothing is written yet. */
  setWidth: (width: number) => void
  /** The drag ended: the width it reached is remembered. */
  commit: () => void
  toggleFull: () => void
  reset: () => void
}

export const useCopilotSheetSize = create<CopilotSheetSizeState>((set, get) => ({
  ...initial(),
  setWidth: (width) => set({ width: Math.round(width), full: false }),
  commit: () => save({ width: get().width, full: get().full }),
  toggleFull: () =>
    set((s) => {
      const next = { width: s.width, full: !s.full }
      save(next)
      return next
    }),
  reset: () =>
    set(() => {
      const next = { width: SHEET_DEFAULT_WIDTH, full: false }
      save(next)
      return next
    }),
}))

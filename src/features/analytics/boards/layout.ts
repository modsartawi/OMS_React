import type { CSSProperties } from 'react'
import type { AnalyticsBoardPanel, AnalyticsChartType, AnalyticsLabel, BoardFilterKey, BoardLayout } from '@/core/models/analytics'

/**
 * The board grid's layout reducer (spec 766 §F "Board grid", ticket 777) — hand-rolled on CSS grid, because no
 * grid library passed the ticket's check (react-grid-layout 2.3.0: no RTL, no keyboard; gridstack 14.1.0: RTL
 * but no keyboard move/resize, imperative DOM, colour literals in its CSS).
 *
 * 12 columns in LOGICAL order (column 0 is the inline start, so the board mirrors under RTL with no code of
 * its own) and fixed row units. Every move and resize keeps the panel inside the columns, at least its chart
 * type's minimum size, and overlapping nothing: a panel it lands on is pushed down, and so on down the board.
 */

export const GRID_COLUMNS = 12

export interface Size {
  w: number
  h: number
}

/** The smallest a panel may be, by what it draws (story 53): no panel shrinks into nonsense. */
const MIN_VIEW: Record<AnalyticsChartType, Size> = {
  kpi: { w: 2, h: 2 },
  line: { w: 4, h: 3 },
  area: { w: 4, h: 3 },
  bar: { w: 4, h: 3 },
  donut: { w: 3, h: 3 },
  table: { w: 4, h: 3 },
  heatmap: { w: 4, h: 3 },
  combo: { w: 4, h: 4 },
}
/** A view whose chart is not known yet, or whose view was removed: the smallest any view may be. */
const MIN_VIEW_UNKNOWN: Size = { w: 2, h: 2 }

export function minSizeOf(of: { kind: 'view'; chart?: AnalyticsChartType | null } | { kind: 'text' } | { kind: 'section' }): Size {
  if (of.kind === 'text') return { w: 2, h: 1 }
  if (of.kind === 'section') return { w: 3, h: 1 }
  return (of.chart && MIN_VIEW[of.chart]) || MIN_VIEW_UNKNOWN
}

export interface LayoutState {
  panels: AnalyticsBoardPanel[]
  /** Each panel's known minimum, by id; a panel with none takes its kind's (`minSizeOf`). */
  mins: Record<string, Size>
}

/** What a panel's words or links may be changed to without touching its place on the grid. */
export type PanelPatch = Partial<{ text: AnalyticsLabel; title: AnalyticsLabel; optOut: BoardFilterKey[] }>

export type LayoutAction =
  | { type: 'move'; id: string; x: number; y: number }
  | { type: 'resize'; id: string; w: number; h: number }
  | { type: 'nudge'; id: string; dx: number; dy: number }
  | { type: 'grow'; id: string; dw: number; dh: number }
  | { type: 'min'; id: string; size: Size }
  | { type: 'add'; panel: AnalyticsBoardPanel; min: Size }
  /** 837: a new panel dropped on a grid cell — added, then moved there (its top-start corner on the cell). */
  | { type: 'drop'; panel: AnalyticsBoardPanel; min: Size; at: Cell }
  | { type: 'remove'; id: string }
  | { type: 'patch'; id: string; patch: PanelPatch }
  /** Back to a snapshot: a pointer drag re-works every step from where it started, so a panel it passed over is not left pushed down. */
  | { type: 'reset'; state: LayoutState }

export const overlaps = (a: BoardLayout, b: BoardLayout) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h

const bottomOf = (panels: readonly AnalyticsBoardPanel[]) => panels.reduce((m, p) => Math.max(m, p.layout.y + p.layout.h), 0)

/** Where a new panel goes: below everything, at the inline start, half the width (or its minimum). */
export function addedLayout(panels: readonly AnalyticsBoardPanel[], min: Size): BoardLayout {
  return { x: 0, y: bottomOf(panels), w: Math.max(6, min.w), h: min.h < 2 ? min.h : Math.max(3, min.h) }
}

/** Inside the columns, at least the minimum, never above row 0. Width first, then the start that fits it. */
function fit(l: BoardLayout, min: Size): BoardLayout {
  const w = Math.min(GRID_COLUMNS, Math.max(min.w, Math.round(l.w)))
  const h = Math.max(min.h, Math.round(l.h))
  const x = Math.min(GRID_COLUMNS - w, Math.max(0, Math.round(l.x)))
  const y = Math.max(0, Math.round(l.y))
  return { x, y, w, h }
}

/** `fixed` stays where it was put; every other panel, top to bottom, drops below whatever it lands on. */
function settle(panels: readonly AnalyticsBoardPanel[], fixedId: string): AnalyticsBoardPanel[] {
  const fixed = panels.find((p) => p.id === fixedId)
  if (!fixed) return [...panels]
  const placed: BoardLayout[] = [fixed.layout]
  const moved = new Map<string, BoardLayout>([[fixedId, fixed.layout]])
  const others = panels.filter((p) => p.id !== fixedId).sort((a, b) => a.layout.y - b.layout.y || a.layout.x - b.layout.x)
  for (const p of others) {
    const l = { ...p.layout }
    for (let hit = placed.find((q) => overlaps(l, q)); hit; hit = placed.find((q) => overlaps(l, q))) l.y = hit.y + hit.h
    placed.push(l)
    moved.set(p.id, l)
  }
  // The panels keep their own order (the saved definition's); only their places change.
  return panels.map((p) => {
    const l = moved.get(p.id)!
    return l === p.layout || (l.x === p.layout.x && l.y === p.layout.y && l.w === p.layout.w && l.h === p.layout.h) ? p : { ...p, layout: l }
  })
}

/** A grid cell, columns counted from the inline start. */
export interface Cell {
  col: number
  row: number
}

/**
 * 837: where a panel dropped on `at` lands — the outline the grid shows while a view is dragged over it, and the
 * place the `drop` action gives the panel (the same `fit`): its asked size, at least its minimum, its top-start
 * corner on the cell, pulled back inside the columns when it would overhang the end.
 */
export function dropOutline(at: Cell, asked: Size, min: Size): BoardLayout {
  return fit({ x: at.col, y: at.row, w: Math.max(asked.w, min.w), h: Math.max(asked.h, min.h) }, min)
}

export function layoutReducer(state: LayoutState, action: LayoutAction): LayoutState {
  if (action.type === 'reset') return action.state
  if (action.type === 'drop') {
    // Dropped on free cells, the panel just lands there. Dropped onto other panels, it is INSERTED: every panel
    // from its row down moves down by its height, so the rows below keep their order (a section's panels stay
    // under their header) instead of only the panels it covers being pushed below it.
    const target = dropOutline(action.at, action.panel.layout, action.min)
    const covered = state.panels.some((p) => overlaps(p.layout, target))
    const shifted = covered
      ? state.panels.map((p) => (p.layout.y >= target.y ? { ...p, layout: { ...p.layout, y: p.layout.y + target.h } } : p))
      : state.panels
    const panel = { ...action.panel, layout: target }
    return { panels: settle([...shifted, panel], panel.id), mins: { ...state.mins, [panel.id]: action.min } }
  }
  if (action.type === 'add') {
    const at = addedLayout(state.panels, action.min)
    const asked = action.panel.layout
    const panel = { ...action.panel, layout: fit({ ...at, w: Math.max(asked.w, action.min.w), h: Math.max(asked.h, action.min.h) }, action.min) }
    return { panels: [...state.panels, panel], mins: { ...state.mins, [panel.id]: action.min } }
  }
  if (action.type === 'remove') {
    const { [action.id]: _gone, ...mins } = state.mins
    return { panels: state.panels.filter((p) => p.id !== action.id), mins }
  }
  const panel = state.panels.find((p) => p.id === action.id)
  if (!panel) return state
  if (action.type === 'patch') {
    return { ...state, panels: state.panels.map((p) => (p.id === action.id ? ({ ...p, ...action.patch } as AnalyticsBoardPanel) : p)) }
  }
  const mins = action.type === 'min' ? { ...state.mins, [action.id]: action.size } : state.mins
  const min = mins[action.id] ?? minSizeOf(panel)
  const l = panel.layout
  const next =
    action.type === 'move'
      ? { ...l, x: action.x, y: action.y }
      : action.type === 'nudge'
        ? { ...l, x: l.x + action.dx, y: l.y + action.dy }
        : action.type === 'resize'
          ? { ...l, w: Math.min(action.w, GRID_COLUMNS - l.x), h: action.h }
          : action.type === 'grow'
            ? { ...l, w: Math.min(l.w + action.dw, GRID_COLUMNS - l.x), h: l.h + action.dh }
            : l
  const placed = fit(next, min)
  const panels = state.panels.map((p) => (p.id === action.id ? { ...p, layout: placed } : p))
  return { panels: settle(panels, action.id), mins }
}

/** The CSS grid placement: logical columns, so `dir="rtl"` mirrors the board by itself. */
export const gridPlacement = ({ x, y, w, h }: BoardLayout): CSSProperties => ({ gridColumn: `${x + 1} / span ${w}`, gridRow: `${y + 1} / span ${h}` })

/**
 * The keyboard's move and resize (766 §F): an arrow moves one column or row, Shift with an arrow resizes. The
 * arrows mean what they show: Right is toward the inline END in en and toward the inline START in ar.
 */
export function keyAction(id: string, key: string, shift: boolean, dir: 'ltr' | 'rtl'): LayoutAction | null {
  const ahead = dir === 'rtl' ? -1 : 1
  const step: Record<string, [number, number]> = { ArrowRight: [ahead, 0], ArrowLeft: [-ahead, 0], ArrowDown: [0, 1], ArrowUp: [0, -1] }
  const s = step[key]
  if (!s) return null
  return shift ? { type: 'grow', id, dw: s[0], dh: s[1] } : { type: 'nudge', id, dx: s[0], dy: s[1] }
}

/** The grid cell under a pointer, columns counted from the inline-start edge (the right edge under RTL). */
export function cellAt(
  pointer: { x: number; y: number },
  rect: { left: number; right: number; top: number },
  rowPitch: number,
  dir: 'ltr' | 'rtl',
): { col: number; row: number } {
  const colWidth = (rect.right - rect.left) / GRID_COLUMNS
  const fromStart = dir === 'rtl' ? rect.right - pointer.x : pointer.x - rect.left
  const col = Math.min(GRID_COLUMNS - 1, Math.max(0, Math.floor(fromStart / colWidth)))
  const row = Math.max(0, Math.floor((pointer.y - rect.top) / rowPitch))
  return { col, row }
}

/** The rows the editor's grid shows: every panel, plus room below to drag into. */
export const rowsShown = (panels: readonly AnalyticsBoardPanel[], spare = 3) => bottomOf(panels) + spare

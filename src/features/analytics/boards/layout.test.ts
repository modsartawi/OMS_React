import { describe, expect, it } from 'vitest'
import type { AnalyticsBoardPanel } from '@/core/models/analytics'
import { addedLayout, cellAt, gridPlacement, keyAction, layoutReducer, minSizeOf, overlaps, type LayoutState } from './layout'

const view = (id: string, x: number, y: number, w: number, h: number): AnalyticsBoardPanel => ({ id, kind: 'view', viewId: `v-${id}`, layout: { x, y, w, h }, optOut: [] })
const text = (id: string, x: number, y: number, w: number, h: number): AnalyticsBoardPanel => ({ id, kind: 'text', text: { en: '', ar: '' }, layout: { x, y, w, h } })
const at = (s: LayoutState, id: string) => s.panels.find((p) => p.id === id)!.layout
const state = (...panels: AnalyticsBoardPanel[]): LayoutState => ({ panels, mins: {} })
const noOverlap = (s: LayoutState) => s.panels.every((a, i) => s.panels.every((b, j) => i === j || !overlaps(a.layout, b.layout)))

describe('minimum sizes per chart type', () => {
  it('a KPI may be small, a combo may not; text and section headers are one row', () => {
    expect(minSizeOf({ kind: 'view', chart: 'kpi' })).toEqual({ w: 2, h: 2 })
    expect(minSizeOf({ kind: 'view', chart: 'bar' })).toEqual({ w: 4, h: 3 })
    expect(minSizeOf({ kind: 'view', chart: 'combo' })).toEqual({ w: 4, h: 4 })
    expect(minSizeOf({ kind: 'view', chart: 'donut' })).toEqual({ w: 3, h: 3 })
    expect(minSizeOf({ kind: 'text' })).toEqual({ w: 2, h: 1 })
    expect(minSizeOf({ kind: 'section' })).toEqual({ w: 3, h: 1 })
  })
  it('a view whose chart is not known yet (or removed) takes the smallest view size', () => {
    expect(minSizeOf({ kind: 'view' })).toEqual({ w: 2, h: 2 })
  })
})

describe('layoutReducer: move', () => {
  it('moves a panel to a cell', () => {
    const s = layoutReducer(state(view('a', 0, 0, 4, 3)), { type: 'move', id: 'a', x: 5, y: 2 })
    expect(at(s, 'a')).toEqual({ x: 5, y: 2, w: 4, h: 3 })
  })
  it('keeps the panel inside the 12 columns and below row 0', () => {
    const s = layoutReducer(state(view('a', 0, 0, 4, 3)), { type: 'move', id: 'a', x: 11, y: -3 })
    expect(at(s, 'a')).toEqual({ x: 8, y: 0, w: 4, h: 3 })
  })
  it('a panel moved onto another pushes it down, never overlapping', () => {
    const s = layoutReducer(state(view('a', 0, 0, 4, 3), view('b', 4, 0, 4, 3), view('c', 4, 3, 4, 3)), { type: 'move', id: 'a', x: 4, y: 1 })
    expect(at(s, 'a')).toEqual({ x: 4, y: 1, w: 4, h: 3 })
    expect(at(s, 'b')).toEqual({ x: 4, y: 4, w: 4, h: 3 })
    expect(at(s, 'c')).toEqual({ x: 4, y: 7, w: 4, h: 3 })
    expect(noOverlap(s)).toBe(true)
  })
  it('a panel nobody touches stays where it is', () => {
    const s = layoutReducer(state(view('a', 0, 0, 4, 3), view('z', 8, 0, 4, 3)), { type: 'move', id: 'a', x: 2, y: 5 })
    expect(at(s, 'z')).toEqual({ x: 8, y: 0, w: 4, h: 3 })
  })
})

describe('layoutReducer: resize', () => {
  it('resizes a panel, never below its minimum or past the last column', () => {
    const s0: LayoutState = { panels: [view('a', 6, 0, 4, 3)], mins: { a: { w: 4, h: 3 } } }
    expect(at(layoutReducer(s0, { type: 'resize', id: 'a', w: 6, h: 5 }), 'a')).toEqual({ x: 6, y: 0, w: 6, h: 5 })
    expect(at(layoutReducer(s0, { type: 'resize', id: 'a', w: 1, h: 1 }), 'a')).toEqual({ x: 6, y: 0, w: 4, h: 3 })
    expect(at(layoutReducer(s0, { type: 'resize', id: 'a', w: 12, h: 3 }), 'a')).toEqual({ x: 6, y: 0, w: 6, h: 3 })
  })
  it('growing into a neighbour pushes the neighbour down', () => {
    const s = layoutReducer(state(view('a', 0, 0, 4, 3), view('b', 0, 3, 4, 3)), { type: 'resize', id: 'a', w: 4, h: 5 })
    expect(at(s, 'b')).toEqual({ x: 0, y: 5, w: 4, h: 3 })
    expect(noOverlap(s)).toBe(true)
  })
  it('learning a larger minimum (the view loaded as a combo) grows the panel to it', () => {
    const s = layoutReducer(state(view('a', 0, 0, 2, 2)), { type: 'min', id: 'a', size: { w: 4, h: 4 } })
    expect(at(s, 'a')).toEqual({ x: 0, y: 0, w: 4, h: 4 })
  })
  it('a minimum wider than the room left moves the panel toward the start', () => {
    const s = layoutReducer(state(view('a', 10, 0, 2, 2)), { type: 'min', id: 'a', size: { w: 4, h: 3 } })
    expect(at(s, 'a')).toEqual({ x: 8, y: 0, w: 4, h: 3 })
  })
})

describe('layoutReducer: add and remove', () => {
  it('a new panel lands below everything, at the start, at least its minimum', () => {
    const s0 = state(view('a', 0, 0, 12, 3), text('t', 0, 3, 6, 1))
    expect(addedLayout(s0.panels, { w: 4, h: 3 })).toEqual({ x: 0, y: 4, w: 6, h: 3 })
    expect(addedLayout([], { w: 3, h: 1 })).toEqual({ x: 0, y: 0, w: 6, h: 1 })
    const s = layoutReducer(s0, { type: 'add', panel: text('n', 0, 0, 6, 1), min: { w: 2, h: 1 } })
    expect(at(s, 'n')).toEqual({ x: 0, y: 4, w: 6, h: 1 })
    expect(s.mins.n).toEqual({ w: 2, h: 1 })
  })
  it('a new panel keeps the size it is added at (a full-width section header) when that is above its minimum', () => {
    const s = layoutReducer(state(view('a', 0, 0, 4, 3)), { type: 'add', panel: { id: 'h', kind: 'section', title: { en: '', ar: '' }, layout: { x: 3, y: 9, w: 12, h: 1 } }, min: { w: 3, h: 1 } })
    expect(at(s, 'h')).toEqual({ x: 0, y: 3, w: 12, h: 1 })
  })
  it('a drag is worked out from where it started: passing over a panel on the way does not leave it pushed down', () => {
    const start = state(view('kpi', 0, 0, 6, 3), view('bar', 0, 3, 6, 3))
    const passing = layoutReducer(start, { type: 'move', id: 'bar', x: 2, y: 0 })
    expect(at(passing, 'kpi').y).toBe(3)
    const landed = layoutReducer(layoutReducer(passing, { type: 'reset', state: start }), { type: 'move', id: 'bar', x: 6, y: 0 })
    expect(at(landed, 'kpi')).toEqual({ x: 0, y: 0, w: 6, h: 3 })
    expect(at(landed, 'bar')).toEqual({ x: 6, y: 0, w: 6, h: 3 })
  })
  it('removing a panel leaves the others where they were', () => {
    const s = layoutReducer(state(view('a', 0, 0, 4, 3), view('b', 4, 0, 4, 3)), { type: 'remove', id: 'a' })
    expect(s.panels.map((p) => p.id)).toEqual(['b'])
    expect(at(s, 'b')).toEqual({ x: 4, y: 0, w: 4, h: 3 })
  })
  it('replaces one panel in place (its words, its opt-outs), keeping its layout', () => {
    const s = layoutReducer(state(text('t', 2, 1, 6, 1)), { type: 'patch', id: 't', patch: { text: { en: 'Hello', ar: 'مرحبا' } } })
    expect(s.panels[0]).toMatchObject({ kind: 'text', text: { en: 'Hello', ar: 'مرحبا' }, layout: { x: 2, y: 1, w: 6, h: 1 } })
  })
})

describe('logical order mirrors under RTL', () => {
  it('a panel is placed in logical grid columns: x 0 is the inline start in either direction', () => {
    expect(gridPlacement({ x: 0, y: 0, w: 4, h: 3 })).toEqual({ gridColumn: '1 / span 4', gridRow: '1 / span 3' })
    expect(gridPlacement({ x: 8, y: 2, w: 4, h: 1 })).toEqual({ gridColumn: '9 / span 4', gridRow: '3 / span 1' })
  })
  it('the arrow keys move by reading direction: Right is toward the end in en, toward the start in ar', () => {
    expect(keyAction('a', 'ArrowRight', false, 'ltr')).toEqual({ type: 'nudge', id: 'a', dx: 1, dy: 0 })
    expect(keyAction('a', 'ArrowRight', false, 'rtl')).toEqual({ type: 'nudge', id: 'a', dx: -1, dy: 0 })
    expect(keyAction('a', 'ArrowLeft', false, 'rtl')).toEqual({ type: 'nudge', id: 'a', dx: 1, dy: 0 })
    expect(keyAction('a', 'ArrowDown', false, 'rtl')).toEqual({ type: 'nudge', id: 'a', dx: 0, dy: 1 })
  })
  it('Shift with an arrow resizes, mirrored the same way', () => {
    expect(keyAction('a', 'ArrowRight', true, 'ltr')).toEqual({ type: 'grow', id: 'a', dw: 1, dh: 0 })
    expect(keyAction('a', 'ArrowLeft', true, 'rtl')).toEqual({ type: 'grow', id: 'a', dw: 1, dh: 0 })
    expect(keyAction('a', 'ArrowUp', true, 'ltr')).toEqual({ type: 'grow', id: 'a', dw: 0, dh: -1 })
    expect(keyAction('a', 'Enter', false, 'ltr')).toBeNull()
  })
  it('nudge and grow go through the same limits as move and resize', () => {
    const s0: LayoutState = { panels: [view('a', 0, 0, 4, 3)], mins: { a: { w: 4, h: 3 } } }
    expect(at(layoutReducer(s0, { type: 'nudge', id: 'a', dx: -1, dy: 0 }), 'a')).toEqual({ x: 0, y: 0, w: 4, h: 3 })
    expect(at(layoutReducer(s0, { type: 'nudge', id: 'a', dx: 1, dy: 1 }), 'a')).toEqual({ x: 1, y: 1, w: 4, h: 3 })
    expect(at(layoutReducer(s0, { type: 'grow', id: 'a', dw: -1, dh: 1 }), 'a')).toEqual({ x: 0, y: 0, w: 4, h: 4 })
    expect(at(layoutReducer(s0, { type: 'grow', id: 'a', dw: 2, dh: 0 }), 'a')).toEqual({ x: 0, y: 0, w: 6, h: 3 })
  })
  it('a pointer is read from the inline-start edge: the same spot is column 2 in en and column 9 in ar', () => {
    const rect = { left: 100, right: 1300, top: 50 }
    // 1200 px over 12 columns = 100 px a column; 80 px a row.
    expect(cellAt({ x: 350, y: 50 + 170 }, rect, 80, 'ltr')).toEqual({ col: 2, row: 2 })
    expect(cellAt({ x: 350, y: 50 + 170 }, rect, 80, 'rtl')).toEqual({ col: 9, row: 2 })
    expect(cellAt({ x: 50, y: 0 }, rect, 80, 'ltr')).toEqual({ col: 0, row: 0 })
    expect(cellAt({ x: 1400, y: 50 }, rect, 80, 'ltr')).toEqual({ col: 11, row: 0 })
  })
})

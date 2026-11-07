import { describe, expect, it } from 'vitest'
import type { AnalyticsBoardPanel } from '@/core/models/analytics'
import { addedLayout, cellAt, closeGaps, dropOutline, freeSlotBelow, gridPlacement, keyAction, layoutReducer, minSizeOf, overlaps, sectionOf, type LayoutState } from './layout'

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

describe('837: a view dropped from the palette', () => {
  const panel = (id: string): AnalyticsBoardPanel => ({ id, kind: 'view', viewId: `v-${id}`, layout: { x: 0, y: 0, w: 6, h: 3 }, optOut: [] })
  const bar = minSizeOf({ kind: 'view', chart: 'bar' })

  it('lands with its top-start corner on the drop cell, at its asked size', () => {
    const s = layoutReducer(state(), { type: 'drop', panel: panel('n'), min: bar, at: { col: 3, row: 2 } })
    expect(at(s, 'n')).toEqual({ x: 3, y: 2, w: 6, h: 3 })
    expect(s.mins.n).toEqual(bar)
  })
  it('is pulled back inside the columns when the cell is near the end', () => {
    const s = layoutReducer(state(), { type: 'drop', panel: panel('n'), min: bar, at: { col: 10, row: 0 } })
    expect(at(s, 'n')).toEqual({ x: 6, y: 0, w: 6, h: 3 })
  })
  it('takes at least its chart minimum', () => {
    const combo = minSizeOf({ kind: 'view', chart: 'combo' })
    const s = layoutReducer(state(), { type: 'drop', panel: panel('n'), min: combo, at: { col: 0, row: 0 } })
    expect(at(s, 'n')).toEqual({ x: 0, y: 0, w: 6, h: 4 })
  })
  it('dropped on another panel pushes it down; nothing overlaps; the panels keep their order', () => {
    const s = layoutReducer(state(view('a', 0, 0, 6, 3), view('b', 6, 0, 6, 3)), { type: 'drop', panel: panel('n'), min: bar, at: { col: 2, row: 1 } })
    expect(at(s, 'n')).toEqual({ x: 2, y: 1, w: 6, h: 3 })
    expect(at(s, 'a')).toEqual({ x: 0, y: 4, w: 6, h: 3 })
    expect(at(s, 'b')).toEqual({ x: 6, y: 4, w: 6, h: 3 })
    expect(noOverlap(s)).toBe(true)
    expect(s.panels.map((p) => p.id)).toEqual(['a', 'b', 'n'])
  })
  it('dropped onto a section, it is inserted: every panel from that row down moves, so a section stays under its header', () => {
    // A header at row 0, four KPIs at row 1, a chart at row 3; the view is dropped on the header's start.
    const header: AnalyticsBoardPanel = { id: 'h', kind: 'section', title: { en: 'Sales', ar: '' }, layout: { x: 0, y: 0, w: 12, h: 1 } }
    const s0 = state(header, view('k1', 0, 1, 3, 2), view('k2', 3, 1, 3, 2), view('k3', 6, 1, 3, 2), view('k4', 9, 1, 3, 2), view('c', 0, 3, 12, 4))
    const s = layoutReducer(s0, { type: 'drop', panel: panel('n'), min: bar, at: { col: 0, row: 0 } })
    expect(at(s, 'n')).toEqual({ x: 0, y: 0, w: 6, h: 3 })
    expect(at(s, 'h').y).toBe(3)
    for (const k of ['k1', 'k2', 'k3', 'k4']) expect(at(s, k).y).toBe(4)
    expect(at(s, 'c').y).toBe(6)
    expect(noOverlap(s)).toBe(true)
  })
  it('dropped on free cells beside other panels, nothing moves', () => {
    const s = layoutReducer(state(view('a', 0, 0, 6, 3), view('b', 0, 3, 12, 3)), { type: 'drop', panel: panel('n'), min: bar, at: { col: 6, row: 0 } })
    expect(at(s, 'n')).toEqual({ x: 6, y: 0, w: 6, h: 3 })
    expect(at(s, 'a')).toEqual({ x: 0, y: 0, w: 6, h: 3 })
    expect(at(s, 'b')).toEqual({ x: 0, y: 3, w: 12, h: 3 })
  })
  it('the outline shown while dragging is where the drop puts it', () => {
    const base = state(view('a', 0, 0, 4, 3))
    for (const cell of [{ col: 0, row: 0 }, { col: 7, row: 5 }, { col: 11, row: 1 }]) {
      for (const min of [bar, minSizeOf({ kind: 'view', chart: 'kpi' }), minSizeOf({ kind: 'view', chart: 'combo' })]) {
        const s = layoutReducer(base, { type: 'drop', panel: panel('n'), min, at: cell })
        expect(at(s, 'n')).toEqual(dropOutline(cell, { w: 6, h: 3 }, min))
      }
    }
  })
})

const section = (id: string, x: number, y: number, w = 12, h = 1): AnalyticsBoardPanel => ({ id, kind: 'section', title: { en: id, ar: '' }, layout: { x, y, w, h } })

describe('846: Close gaps', () => {
  it('moves every panel up into the empty rows above it, keeping the reading order', () => {
    // A deleted panel left rows 0–2 empty at the start; c sat under it.
    const s0 = state(view('b', 6, 0, 6, 3), view('c', 0, 3, 6, 3), view('d', 0, 8, 12, 2))
    const s = layoutReducer(s0, { type: 'closeGaps' })
    expect(at(s, 'b')).toEqual({ x: 6, y: 0, w: 6, h: 3 })
    expect(at(s, 'c')).toEqual({ x: 0, y: 0, w: 6, h: 3 })
    expect(at(s, 'd')).toEqual({ x: 0, y: 3, w: 12, h: 2 })
    expect(s.panels.map((p) => p.id)).toEqual(['b', 'c', 'd'])
    expect(noOverlap(s)).toBe(true)
  })
  it('a panel never floats above its section header, even past a narrow header', () => {
    const s0 = state(section('h1', 0, 0), view('a', 0, 1, 6, 3), section('h2', 0, 6, 4), view('b', 6, 8, 6, 3))
    const s = layoutReducer(s0, { type: 'closeGaps' })
    expect(at(s, 'h2').y).toBe(4)
    // b sits beside the narrow header's column span, but stays under it.
    expect(at(s, 'b').y).toBe(5)
  })
  it('one section only: its panels move up under its header; the rest of the board stays', () => {
    const s0 = state(view('top', 0, 2, 6, 3), section('h', 0, 5), view('a', 0, 8, 6, 3), view('b', 6, 9, 6, 3), section('h2', 0, 14), view('z', 0, 17, 6, 3))
    const s = layoutReducer(s0, { type: 'closeGaps', section: 'h' })
    expect(at(s, 'a').y).toBe(6)
    expect(at(s, 'b').y).toBe(6)
    expect(at(s, 'top').y).toBe(2)
    expect(at(s, 'h').y).toBe(5)
    expect(at(s, 'h2').y).toBe(14)
    expect(at(s, 'z').y).toBe(17)
  })
  it('no gap: the state is the same object (the editor says so)', () => {
    const s0 = state(view('a', 0, 0, 6, 3), view('b', 6, 0, 6, 3), view('c', 0, 3, 12, 3))
    expect(layoutReducer(s0, { type: 'closeGaps' })).toBe(s0)
    expect(closeGaps(s0.panels)).toBe(s0.panels)
    const s1 = state(section('h', 0, 0), view('a', 0, 1, 6, 3), view('far', 0, 9, 6, 3))
    expect(layoutReducer(s1, { type: 'closeGaps', section: 'h' })).not.toBe(s1)
  })
  it('a panel belongs to the nearest header above it', () => {
    const panels = [view('pre', 0, 0, 6, 2), section('h', 0, 2), view('a', 0, 3, 6, 3), section('h2', 0, 6), view('b', 4, 7, 6, 3)]
    expect(sectionOf(panels, 'pre')).toBeNull()
    expect(sectionOf(panels, 'a')).toBe('h')
    expect(sectionOf(panels, 'b')).toBe('h2')
  })
})

describe('846: duplicate into the first free slot below', () => {
  it('the slot is the first place below the panel it fits, nearest its own column first', () => {
    const panels = [view('a', 0, 0, 6, 3), view('b', 6, 0, 6, 3), view('c', 0, 3, 6, 3)]
    // Under a (rows 3–5) is c, so the copy goes beside c, under b.
    expect(freeSlotBelow(panels, 'a')).toEqual({ x: 6, y: 3, w: 6, h: 3 })
    expect(freeSlotBelow(panels, 'b')).toEqual({ x: 6, y: 3, w: 6, h: 3 })
    expect(freeSlotBelow([view('a', 2, 0, 4, 3)], 'a')).toEqual({ x: 2, y: 3, w: 4, h: 3 })
  })
  it('duplicate adds a copy with a new id there, its minimum and its words, nothing moves', () => {
    const s0: LayoutState = { panels: [text('t', 0, 0, 6, 1), view('a', 0, 1, 12, 3)], mins: { t: { w: 2, h: 1 } } }
    s0.panels[0] = { ...s0.panels[0], text: { en: 'Hi', ar: 'مرحبا' } } as AnalyticsBoardPanel
    const s = layoutReducer(s0, { type: 'duplicate', id: 't', newId: 't2' })
    expect(s.panels.map((p) => p.id)).toEqual(['t', 'a', 't2'])
    // Below t is the full-width a, so the copy goes under a.
    expect(s.panels[2]).toMatchObject({ kind: 'text', text: { en: 'Hi', ar: 'مرحبا' }, layout: { x: 0, y: 4, w: 6, h: 1 } })
    expect(s.mins.t2).toEqual({ w: 2, h: 1 })
    expect(at(s, 'a')).toEqual({ x: 0, y: 1, w: 12, h: 3 })
  })
})

describe('846: several panels at once', () => {
  it('moves a selection together with the arrows; one hitting the edge stops the group', () => {
    const s0 = state(view('a', 0, 0, 4, 3), view('b', 4, 0, 4, 3), view('c', 0, 6, 4, 3))
    const right = layoutReducer(s0, { type: 'nudgeMany', ids: ['a', 'b'], dx: 1, dy: 0 })
    expect([at(right, 'a').x, at(right, 'b').x]).toEqual([1, 5])
    const left = layoutReducer(s0, { type: 'nudgeMany', ids: ['a', 'b'], dx: -1, dy: 0 })
    expect(left).toBe(s0)
    const down = layoutReducer(s0, { type: 'nudgeMany', ids: ['a', 'b'], dx: 0, dy: 4 })
    expect([at(down, 'a').y, at(down, 'b').y]).toEqual([4, 4])
    // c, landed on, is pushed below the group.
    expect(at(down, 'c').y).toBe(7)
    expect(noOverlap(down)).toBe(true)
  })
  it('removes a selection', () => {
    const s = layoutReducer(state(view('a', 0, 0, 4, 3), view('b', 4, 0, 4, 3), view('c', 8, 0, 4, 3)), { type: 'removeMany', ids: ['a', 'c'] })
    expect(s.panels.map((p) => p.id)).toEqual(['b'])
  })
  it('aligns the start edges: stacked panels stay stacked, side-by-side ones stack in reading order', () => {
    const s = layoutReducer(state(view('a', 2, 0, 4, 3), view('b', 5, 3, 4, 3), view('z', 9, 0, 3, 3)), { type: 'align', ids: ['a', 'b'], how: 'start' })
    expect(at(s, 'a')).toEqual({ x: 2, y: 0, w: 4, h: 3 })
    expect(at(s, 'b')).toEqual({ x: 2, y: 3, w: 4, h: 3 })
    expect(at(s, 'z')).toEqual({ x: 9, y: 0, w: 3, h: 3 })
    const side = layoutReducer(state(view('a', 0, 0, 4, 3), view('b', 6, 0, 4, 3)), { type: 'align', ids: ['b', 'a'], how: 'start' })
    expect(at(side, 'a')).toEqual({ x: 0, y: 0, w: 4, h: 3 })
    expect(at(side, 'b')).toEqual({ x: 0, y: 3, w: 4, h: 3 })
    expect(noOverlap(side)).toBe(true)
  })
  it('aligns the tops to the highest', () => {
    const s = layoutReducer(state(view('a', 0, 2, 4, 3), view('b', 6, 5, 4, 3)), { type: 'align', ids: ['a', 'b'], how: 'top' })
    expect([at(s, 'a').y, at(s, 'b').y]).toEqual([2, 2])
  })
  it('makes the selection as wide as the first one picked, inside the columns and above each minimum', () => {
    const s0: LayoutState = { panels: [view('a', 0, 0, 8, 3), view('b', 9, 3, 3, 3), view('c', 0, 6, 6, 3)], mins: { c: { w: 4, h: 3 } } }
    const s = layoutReducer(s0, { type: 'align', ids: ['a', 'b'], how: 'width' })
    expect(at(s, 'a')).toEqual({ x: 0, y: 0, w: 8, h: 3 })
    expect(at(s, 'b')).toEqual({ x: 4, y: 3, w: 8, h: 3 })
    const narrow = layoutReducer({ ...s0, panels: [view('k', 0, 0, 2, 2), view('c', 4, 0, 6, 3)] }, { type: 'align', ids: ['k', 'c'], how: 'width' })
    expect(at(narrow, 'c').w).toBe(4)
  })
})

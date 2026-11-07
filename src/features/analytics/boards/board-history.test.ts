import { describe, expect, it } from 'vitest'
import type { AnalyticsBoardPanel } from '@/core/models/analytics'
import { canRedo, canUndo, copyBindings, outlineOf, record, redo, startHistory, undo, HISTORY_CAP } from './board-history'

type S = { n: number }
const same = (a: S, b: S) => a.n === b.n
const rec = (h: ReturnType<typeof startHistory<S>>, n: number, opts: Partial<Parameters<typeof record>[3]> = {}) => record(h, { n }, same, { time: 0, ...opts })

describe('846: the board editor history', () => {
  it('each finished change is one step; undo and redo walk them; a new change clears redo', () => {
    let h = startHistory<S>({ n: 0 })
    expect(canUndo(h)).toBe(false)
    h = rec(h, 1)
    h = rec(h, 2)
    expect(h.past.map((s) => s.n)).toEqual([0, 1])
    h = undo(h)
    expect(h.at.n).toBe(1)
    expect(canRedo(h)).toBe(true)
    h = redo(h)
    expect(h.at.n).toBe(2)
    h = undo(undo(h))
    expect(h.at.n).toBe(0)
    h = rec(h, 5)
    expect(canRedo(h)).toBe(false)
    expect(h.past.map((s) => s.n)).toEqual([0])
  })
  it('a drag is ONE step: what it passes through while the gesture runs is not recorded, only where it ends', () => {
    let h = startHistory<S>({ n: 0 })
    for (const n of [1, 2, 3]) h = rec(h, n, { gesture: true })
    expect(h.past).toEqual([])
    h = rec(h, 3)
    expect(h.past.map((s) => s.n)).toEqual([0])
    expect(undo(h).at.n).toBe(0)
  })
  it('a change that changes nothing is no step; undo with nothing to undo is the same history', () => {
    const h = rec(startHistory<S>({ n: 0 }), 0)
    expect(h.past).toEqual([])
    expect(undo(h)).toBe(h)
    expect(redo(h)).toBe(h)
  })
  it('typing in one field is one step while it runs (the same key within the window); another field starts a new one', () => {
    let h = startHistory<S>({ n: 0 })
    h = rec(h, 1, { key: 'title', time: 1000 })
    h = rec(h, 2, { key: 'title', time: 1500 })
    h = rec(h, 3, { key: 'title', time: 2500 })
    expect(h.past.map((s) => s.n)).toEqual([0])
    h = rec(h, 4, { key: 'subtitle', time: 2600 })
    expect(h.past.map((s) => s.n)).toEqual([0, 3])
    h = rec(h, 5, { key: 'subtitle', time: 9000 })
    expect(h.past.map((s) => s.n)).toEqual([0, 3, 4])
  })
  it('a rebase (the editor learning a chart minimum, a v1 board converting) moves the checkpoint without a step', () => {
    let h = rec(startHistory<S>({ n: 0 }), 1)
    h = rec(h, 2, { rebase: true })
    expect(h.past.map((s) => s.n)).toEqual([0])
    expect(h.at.n).toBe(2)
  })
  it('an outside replace (the copilot) is one step, undone at once', () => {
    let h = rec(startHistory<S>({ n: 0 }), 1)
    h = rec(h, 99, { key: 'ai' })
    expect(undo(h).at.n).toBe(1)
  })
  it(`keeps at most ${HISTORY_CAP} steps, the oldest dropped`, () => {
    let h = startHistory<S>({ n: 0 })
    for (let n = 1; n <= HISTORY_CAP + 5; n++) h = rec(h, n)
    expect(h.past.length).toBe(HISTORY_CAP)
    expect(h.past[0].n).toBe(5)
  })
})

const view = (id: string, x: number, y: number): AnalyticsBoardPanel => ({ id, kind: 'view', viewId: `v-${id}`, layout: { x, y, w: 6, h: 3 }, optOut: [] })
const section = (id: string, y: number): AnalyticsBoardPanel => ({ id, kind: 'section', title: { en: id, ar: '' }, layout: { x: 0, y, w: 12, h: 1 } })

describe('846: the outline', () => {
  it('lists the panels in reading order, each section header with its panels under it', () => {
    // h is a half-width header; b sits beside it on its row, so b is not under it.
    const h: AnalyticsBoardPanel = { ...section('h', 3), layout: { x: 0, y: 3, w: 6, h: 1 } }
    const panels = [view('b', 6, 3), section('h2', 8), view('pre', 0, 0), view('c', 0, 9), h, view('a', 0, 4)]
    expect(outlineOf(panels).map((e) => `${e.id}:${e.depth}`)).toEqual(['pre:0', 'h:0', 'b:0', 'a:1', 'h2:0', 'c:1'])
  })
})

describe('846: a duplicated view keeps its bindings', () => {
  it('binds the copy wherever the original is bound, with the same target', () => {
    const b = { period: { p1: true as const }, city: { p1: 'city', p2: 'city' }, store: { p2: 'store' } }
    expect(copyBindings(b, 'p1', 'p9')).toEqual({ period: { p1: true, p9: true }, city: { p1: 'city', p2: 'city', p9: 'city' }, store: { p2: 'store' } })
  })
})

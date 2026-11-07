import { describe, expect, it } from 'vitest'
import type { AnalyticsReportDefinition, AnalyticsViewDefinition } from '@/core/models/analytics'
import { blockDrop, lineEdge, sectionDrop, slotAmong } from './report-drop'

const l = (en: string) => ({ en, ar: en })
const view: AnalyticsViewDefinition = { chart: { type: 'bar' }, query: { measures: ['orders'], dimensions: ['city'], filters: [] } }
const text = (id: string) => ({ id, kind: 'text' as const, text: l(id) })
const panel = (id: string) => ({ id, kind: 'panel' as const, title: l(id), definition: view })
const def: AnalyticsReportDefinition = {
  params: [],
  bindings: {},
  sections: [
    { id: 's1', heading: l('One'), blocks: [panel('p1'), text('t1'), text('t2')] },
    { id: 's2', heading: l('Two'), blocks: [panel('p2')] },
    { id: 's3', heading: l('Three'), blocks: [] },
  ],
}

// Three stacked boxes, 100 px tall, 12 px apart: 0–100, 112–212, 224–324.
const boxes = [
  { top: 0, height: 100 },
  { top: 112, height: 100 },
  { top: 224, height: 100 },
]

describe('the nearest edge (846): which gap the pointer is nearest', () => {
  it('the top half of a box is the gap before it, the bottom half the gap after it', () => {
    expect(slotAmong(10, boxes)).toBe(0)
    expect(slotAmong(50, boxes)).toBe(0)
    expect(slotAmong(51, boxes)).toBe(1)
    expect(slotAmong(150, boxes)).toBe(1)
    expect(slotAmong(170, boxes)).toBe(2)
    expect(slotAmong(300, boxes)).toBe(3)
  })
  it('in the gap between two boxes it is that gap; above the first 0, below the last n', () => {
    expect(slotAmong(106, boxes)).toBe(1)
    expect(slotAmong(-40, boxes)).toBe(0)
    expect(slotAmong(900, boxes)).toBe(3)
  })
  it('no boxes: the only gap, 0', () => {
    expect(slotAmong(50, [])).toBe(0)
  })
})

describe('a block or view dropped at a gap (846)', () => {
  it('a block anywhere but its own place is allowed', () => {
    expect(blockDrop(def, { kind: 'block', id: 'p1' }, 's1', 3)).toEqual({ kind: 'block', section: 's1', index: 3 })
    expect(blockDrop(def, { kind: 'block', id: 't2' }, 's1', 0)).toEqual({ kind: 'block', section: 's1', index: 0 })
    expect(blockDrop(def, { kind: 'block', id: 'p1' }, 's3', 0)).toEqual({ kind: 'block', section: 's3', index: 0 })
  })
  it('its own place (the gap just before or after it) is no drop: no line', () => {
    expect(blockDrop(def, { kind: 'block', id: 't1' }, 's1', 1)).toBeNull()
    expect(blockDrop(def, { kind: 'block', id: 't1' }, 's1', 2)).toBeNull()
  })
  it('the same gap in another section is a move', () => {
    expect(blockDrop(def, { kind: 'block', id: 'p2' }, 's1', 0)).toEqual({ kind: 'block', section: 's1', index: 0 })
  })
  it('a view lands at any gap of any section', () => {
    expect(blockDrop(def, { kind: 'view', viewId: 'v9' }, 's1', 1)).toEqual({ kind: 'block', section: 's1', index: 1 })
    expect(blockDrop(def, { kind: 'view', viewId: 'v9' }, 's3', 0)).toEqual({ kind: 'block', section: 's3', index: 0 })
  })
  it('a section among blocks, an unknown section or block, or nothing dragged, is no drop', () => {
    expect(blockDrop(def, { kind: 'section', id: 's2' }, 's1', 0)).toBeNull()
    expect(blockDrop(def, { kind: 'block', id: 'p1' }, 'nope', 0)).toBeNull()
    expect(blockDrop(def, { kind: 'block', id: 'nope' }, 's1', 0)).toBeNull()
    expect(blockDrop(def, null, 's1', 0)).toBeNull()
  })
  it('an index past the end is the end', () => {
    expect(blockDrop(def, { kind: 'view', viewId: 'v9' }, 's2', 7)).toEqual({ kind: 'block', section: 's2', index: 1 })
  })
})

describe('a section dropped at a gap (846)', () => {
  it('anywhere but its own place', () => {
    expect(sectionDrop(def, { kind: 'section', id: 's3' }, 0)).toEqual({ kind: 'section', index: 0 })
    expect(sectionDrop(def, { kind: 'section', id: 's1' }, 3)).toEqual({ kind: 'section', index: 3 })
  })
  it('its own place is no drop', () => {
    expect(sectionDrop(def, { kind: 'section', id: 's2' }, 1)).toBeNull()
    expect(sectionDrop(def, { kind: 'section', id: 's2' }, 2)).toBeNull()
  })
  it('a block or a view among sections is no drop', () => {
    expect(sectionDrop(def, { kind: 'block', id: 'p1' }, 0)).toBeNull()
    expect(sectionDrop(def, { kind: 'view', viewId: 'v9' }, 0)).toBeNull()
    expect(sectionDrop(def, { kind: 'section', id: 'nope' }, 0)).toBeNull()
  })
})

describe('where the line is drawn (846): on the nearest edge of one item', () => {
  it('a gap before an item is that item\'s top edge', () => {
    expect(lineEdge(0, 0, 3)).toBe('before')
    expect(lineEdge(2, 2, 3)).toBe('before')
    expect(lineEdge(2, 1, 3)).toBeNull()
  })
  it('the gap after the last item is the last item\'s bottom edge, and no other item draws it', () => {
    expect(lineEdge(3, 2, 3)).toBe('after')
    expect(lineEdge(3, 1, 3)).toBeNull()
  })
  it('no drop: no line', () => {
    expect(lineEdge(null, 0, 3)).toBeNull()
  })
})

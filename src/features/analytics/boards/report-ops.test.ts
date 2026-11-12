import { describe, expect, it } from 'vitest'
import type { AnalyticsModel, AnalyticsReportDefinition, AnalyticsViewDefinition, Param } from '@/core/models/analytics'
import {
  addBlock,
  addSection,
  dropIndex,
  dropSide,
  duplicateBlock,
  freshId,
  hasSummary,
  locateBlock,
  moveBlock,
  moveBlockTo,
  moveSection,
  moveSectionTo,
  removeBlock,
  removeSection,
  renameSection,
  updateBlock,
} from './report-ops'

const l = (en: string) => ({ en, ar: en })
const view: AnalyticsViewDefinition = { chart: { type: 'bar' }, query: { measures: ['orders'], dimensions: ['city'], filters: [] } }
const text = (id: string) => ({ id, kind: 'text' as const, text: l(id) })
const panel = (id: string) => ({ id, kind: 'panel' as const, title: l(id), definition: view })

const sample = (): AnalyticsReportDefinition => ({
  params: [],
  bindings: { city: { p1: 'city', p2: 'city' }, period: { p1: true, p2: true } },
  sections: [
    { id: 's1', heading: l('One'), blocks: [panel('p1'), text('t1'), text('t2')] },
    { id: 's2', heading: l('Two'), blocks: [panel('p2')] },
    { id: 's3', heading: l('Three'), blocks: [] },
  ],
})
const ids = (d: AnalyticsReportDefinition) => d.sections.map((s) => `${s.id}:${s.blocks.map((b) => b.id).join(',')}`)

describe('the drop side (828): the top or bottom half of the target', () => {
  it('the top half lands before the target, the bottom half after it', () => {
    expect(dropSide(110, 100, 40)).toBe(0)
    expect(dropSide(119, 100, 40)).toBe(0)
    expect(dropSide(120, 100, 40)).toBe(0)
    expect(dropSide(121, 100, 40)).toBe(1)
    expect(dropSide(139, 100, 40)).toBe(1)
  })
  it('a target at index i gives i before it and i + 1 after it', () => {
    expect(dropIndex(2, 0)).toBe(2)
    expect(dropIndex(2, 1)).toBe(3)
  })
})

describe('moving a block (828)', () => {
  it('within its section: a drop index counts the places before the move', () => {
    // t2 dropped before p1 (index 0).
    expect(ids(moveBlockTo(sample(), 't2', 's1', 0))).toEqual(['s1:t2,p1,t1', 's2:p2', 's3:'])
    // p1 dropped after t1 (index 2): it lands between t1 and t2.
    expect(ids(moveBlockTo(sample(), 'p1', 's1', 2))).toEqual(['s1:t1,p1,t2', 's2:p2', 's3:'])
    // p1 dropped at the section's end (index 3).
    expect(ids(moveBlockTo(sample(), 'p1', 's1', 3))).toEqual(['s1:t1,t2,p1', 's2:p2', 's3:'])
  })

  it('a drop on its own place changes nothing (the same definition: no history step)', () => {
    const d = sample()
    expect(moveBlockTo(d, 't1', 's1', 1)).toBe(d)
    expect(moveBlockTo(d, 't1', 's1', 2)).toBe(d)
  })

  it('across sections, and into an empty one', () => {
    expect(ids(moveBlockTo(sample(), 't1', 's2', 0))).toEqual(['s1:p1,t2', 's2:t1,p2', 's3:'])
    expect(ids(moveBlockTo(sample(), 'p2', 's1', 1))).toEqual(['s1:p1,p2,t1,t2', 's2:', 's3:'])
    expect(ids(moveBlockTo(sample(), 'p1', 's3', 0))).toEqual(['s1:t1,t2', 's2:p2', 's3:p1'])
  })

  it('keeps its bindings when it moves', () => {
    expect(moveBlockTo(sample(), 'p1', 's3', 0).bindings).toEqual(sample().bindings)
  })

  it('an unknown block or section changes nothing', () => {
    const d = sample()
    expect(moveBlockTo(d, 'nope', 's1', 0)).toBe(d)
    expect(moveBlockTo(d, 'p1', 'nope', 0)).toBe(d)
  })

  it('up and down from the keyboard cover the same moves, crossing into the next section at an edge', () => {
    expect(ids(moveBlock(sample(), 't1', -1))).toEqual(['s1:t1,p1,t2', 's2:p2', 's3:'])
    expect(ids(moveBlock(sample(), 't1', 1))).toEqual(['s1:p1,t2,t1', 's2:p2', 's3:'])
    // The last block of s1, down: the top of s2. The first of s2, up: the end of s1.
    expect(ids(moveBlock(sample(), 't2', 1))).toEqual(['s1:p1,t1', 's2:t2,p2', 's3:'])
    expect(ids(moveBlock(sample(), 'p2', -1))).toEqual(['s1:p1,t1,t2,p2', 's2:', 's3:'])
    // ...and into an empty section.
    expect(ids(moveBlock(sample(), 'p2', 1))).toEqual(['s1:p1,t1,t2', 's2:', 's3:p2'])
  })

  it('the first block of the report cannot go up, nor the last go down', () => {
    const d = sample()
    expect(moveBlock(d, 'p1', -1)).toBe(d)
    const e = moveBlock(d, 'p2', 1)
    expect(moveBlock(e, 'p2', 1)).toBe(e)
  })
})

describe('moving a section (828)', () => {
  it('by a drop index that counts the places before the move', () => {
    expect(ids(moveSectionTo(sample(), 's3', 0)).map((x) => x.split(':')[0])).toEqual(['s3', 's1', 's2'])
    expect(ids(moveSectionTo(sample(), 's1', 2)).map((x) => x.split(':')[0])).toEqual(['s2', 's1', 's3'])
    expect(ids(moveSectionTo(sample(), 's1', 3)).map((x) => x.split(':')[0])).toEqual(['s2', 's3', 's1'])
  })
  it('its blocks go with it', () => {
    expect(ids(moveSectionTo(sample(), 's2', 0))).toEqual(['s2:p2', 's1:p1,t1,t2', 's3:'])
  })
  it('a drop on its own place, or an unknown section, changes nothing', () => {
    const d = sample()
    expect(moveSectionTo(d, 's2', 1)).toBe(d)
    expect(moveSectionTo(d, 's2', 2)).toBe(d)
    expect(moveSectionTo(d, 'nope', 0)).toBe(d)
  })
  it('up and down by one, stopping at the ends', () => {
    expect(ids(moveSection(sample(), 's2', -1)).map((x) => x.split(':')[0])).toEqual(['s2', 's1', 's3'])
    expect(ids(moveSection(sample(), 's2', 1)).map((x) => x.split(':')[0])).toEqual(['s1', 's3', 's2'])
    const d = sample()
    expect(moveSection(d, 's1', -1)).toBe(d)
    expect(moveSection(d, 's3', 1)).toBe(d)
  })
})

describe('adding and removing (828)', () => {
  it('a fresh id is the first free one for its prefix, across sections and blocks', () => {
    expect(freshId(sample(), 's')).toBe('s4')
    expect(freshId(sample(), 't')).toBe('t3')
    expect(freshId(sample(), 'p')).toBe('p3')
  })

  it('adds an empty section at the end', () => {
    const d = addSection(sample(), 's9')
    expect(d.sections.at(-1)).toEqual({ id: 's9', heading: { en: '', ar: '' }, blocks: [] })
  })

  it('renames a section, and the same heading is no change', () => {
    const d = sample()
    expect(renameSection(d, 's2', l('Deux')).sections[1].heading).toEqual(l('Deux'))
    expect(renameSection(d, 's2', d.sections[1].heading)).toBe(d)
  })

  it('removing a section drops its blocks and their bindings; the other bindings stay', () => {
    const d = removeSection(sample(), 's1')
    expect(ids(d)).toEqual(['s2:p2', 's3:'])
    expect(d.bindings).toEqual({ city: { p2: 'city' }, period: { p2: true } })
  })

  it('removing a block drops its bindings', () => {
    const d = removeBlock(sample(), 'p2')
    expect(ids(d)).toEqual(['s1:p1,t1,t2', 's2:', 's3:'])
    expect(d.bindings).toEqual({ city: { p1: 'city' }, period: { p1: true } })
  })

  it('locates a block: its section and place', () => {
    expect(locateBlock(sample(), 't2')).toEqual({ section: 's1', index: 2 })
    expect(locateBlock(sample(), 'nope')).toBeNull()
  })

  it('adds a block at the end of a section; a report holds one summary', () => {
    const model = { measures: [], dimensions: [], areas: [] } as unknown as AnalyticsModel
    const d = addBlock(sample(), 's3', { id: 'sum', kind: 'summary' }, model)
    expect(ids(d)).toEqual(['s1:p1,t1,t2', 's2:p2', 's3:sum'])
    expect(hasSummary(d)).toBe(true)
    expect(hasSummary(sample())).toBe(false)
    expect(addBlock(d, 's1', { id: 'sum2', kind: 'summary' }, model)).toBe(d)
  })

  it('a new panel binds every parameter that can take it', () => {
    const model = {
      areas: [{ key: 'orders', available: true }],
      measures: [{ key: 'orders', area: 'orders', shape: 'count', unit: 'count', label: l('Orders'), description: l(''), dimensions: ['city', 'day'] }],
      dimensions: [
        { key: 'city', kind: 'category', label: l('City') },
        { key: 'day', kind: 'time', label: l('Day') },
      ],
    } as unknown as AnalyticsModel
    const params: Param[] = [
      { name: 'period', kind: 'period', label: l('Period'), required: true, default: { kind: 'period', token: 'yesterday' } },
      { name: 'grain', kind: 'grain', label: l('By'), required: true, grains: ['day'], default: { kind: 'grain', grain: 'day' } },
      { name: 'city', kind: 'members', label: l('City'), required: false, dimension: 'city', pinned: null, multi: true, default: { kind: 'members', values: [] } },
    ]
    const d = addBlock({ ...sample(), params }, 's3', panel('p3'), model)
    expect(d.bindings.period.p3).toBe(true)
    expect(d.bindings.city.p3).toBe('city')
    // No time axis on this panel: grain cannot bind.
    expect(d.bindings.grain?.p3).toBeUndefined()
  })
})

describe('a block edited in place (829)', () => {
  it('changes only that block; the same content is no change', () => {
    const d = sample()
    const next = updateBlock(d, 't1', (b) => (b.kind === 'text' ? { ...b, text: l('Now') } : b))
    expect(next.sections[0].blocks[1]).toEqual({ id: 't1', kind: 'text', text: l('Now') })
    expect(next.sections[1]).toBe(d.sections[1])
    expect(updateBlock(d, 't1', (b) => ({ ...b }))).toBe(d)
    expect(updateBlock(d, 'nope', (b) => b)).toBe(d)
  })

  it('a panel edited so it can no longer take a binding drops that binding, and keeps the rest (P6: the ready-made parameters)', () => {
    const model = {
      areas: [{ key: 'orders', available: true }],
      measures: [{ key: 'orders', area: 'orders', shape: 'count', unit: 'count', label: l('Orders'), description: l(''), dimensions: ['city', 'day'] }],
      dimensions: [
        { key: 'city', kind: 'category', label: l('City') },
        { key: 'day', kind: 'time', label: l('Day') },
      ],
    } as unknown as AnalyticsModel
    const params: Param[] = [
      { name: 'period', kind: 'period', label: l('Period'), required: true, default: { kind: 'period', token: 'yesterday' } },
      { name: 'city', kind: 'members', label: l('City'), required: false, dimension: 'city', pinned: null, multi: true, default: { kind: 'members', values: [] } },
    ]
    const d = { ...sample(), params }
    // A named series filtering by city: the city parameter can no longer bind p1 (seriesFilters).
    const withSeries = (b: Parameters<Parameters<typeof updateBlock>[2]>[0]) =>
      b.kind === 'panel' && b.engine !== 'sql' ? { ...b, definition: { ...b.definition, series: [{ id: 's1', label: l('Riyadh'), filters: [{ dimension: 'city', values: ['riyadh'] }] }] } } : b
    const next = updateBlock(d, 'p1', withSeries, model)
    expect(next.bindings.city).toEqual({ p2: 'city' })
    expect(next.bindings.period).toEqual({ p1: true, p2: true })
    // A text edit, or no model, never touches the bindings.
    expect(updateBlock(d, 'p1', withSeries).bindings).toBe(d.bindings)
  })
})

describe('a view dropped at a gap, and duplicating (846)', () => {
  const model = { measures: [], dimensions: [], areas: [] } as unknown as AnalyticsModel

  it('adds a block at a given place in a section; past the end is the end', () => {
    expect(ids(addBlock(sample(), 's1', panel('p3'), model, 1))).toEqual(['s1:p1,p3,t1,t2', 's2:p2', 's3:'])
    expect(ids(addBlock(sample(), 's1', panel('p3'), model, 0))).toEqual(['s1:p3,p1,t1,t2', 's2:p2', 's3:'])
    expect(ids(addBlock(sample(), 's2', panel('p3'), model, 9))).toEqual(['s1:p1,t1,t2', 's2:p2,p3', 's3:'])
  })

  it('duplicates a block just after itself, under the new id', () => {
    const d = duplicateBlock(sample(), 't1', 't3')
    expect(ids(d)).toEqual(['s1:p1,t1,t3,t2', 's2:p2', 's3:'])
    expect(d.sections[0].blocks[2]).toEqual({ ...text('t1'), id: 't3' })
  })

  it('a duplicated panel is bound as the original is', () => {
    const d = duplicateBlock(sample(), 'p2', 'p3')
    expect(ids(d)).toEqual(['s1:p1,t1,t2', 's2:p2,p3', 's3:'])
    expect(d.bindings).toEqual({ city: { p1: 'city', p2: 'city', p3: 'city' }, period: { p1: true, p2: true, p3: true } })
  })

  it('the summary (one per report), an unknown block or a taken id is no change', () => {
    const withSum = addBlock(sample(), 's3', { id: 'sum', kind: 'summary' }, model)
    expect(duplicateBlock(withSum, 'sum', 'sum2')).toBe(withSum)
    const d = sample()
    expect(duplicateBlock(d, 'nope', 't9')).toBe(d)
    expect(duplicateBlock(d, 't1', 'p2')).toBe(d)
  })
})

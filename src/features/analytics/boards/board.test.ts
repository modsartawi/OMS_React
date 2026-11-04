import { describe, expect, it } from 'vitest'
import { readBoard, readMembers } from './wire'
import { boardDefaults, inLogicalOrder, streamProgress, NO_WAVE } from './board'

describe('board', () => {
  it('reads a board defensively: absent panels are none, an unknown panel kind is dropped, an absent opt-out is none', () => {
    const b = readBoard({
      id: 'b-1',
      kind: 'board',
      title: { en: 'Ops', ar: 'العمليات' },
      definition: {
        panels: [
          { id: 'p1', kind: 'view', viewId: 'v-1', layout: { x: 0, y: 0, w: 6, h: 2 } },
          { id: 'p2', kind: 'gauge', layout: { x: 6, y: 0, w: 6, h: 2 } },
          { id: 'p3', kind: 'section', title: { en: 'Stores' }, layout: { x: 0, y: 2, w: 12, h: 1 } },
        ],
      },
    })
    expect(b.definition.panels.map((p) => p.id)).toEqual(['p1', 'p3'])
    expect(b.definition.panels[0]).toMatchObject({ kind: 'view', optOut: [] })
    expect(b.definition.panels[1]).toMatchObject({ kind: 'section', title: { en: 'Stores', ar: '' } })
    expect(readBoard({ id: 'b-2' }).definition.panels).toEqual([])
  })

  it('reads DimensionValues members with a plain or a bilingual label', () => {
    expect(readMembers([{ key: 'P001', label: 'Olaya' }, { key: 'riyadh', label: { en: 'Riyadh', ar: 'الرياض' } }])).toEqual([
      { key: 'P001', label: { en: 'Olaya', ar: 'Olaya' } },
      { key: 'riyadh', label: { en: 'Riyadh', ar: 'الرياض' } },
    ])
    expect(readMembers(null)).toEqual([])
  })

  it("the board's saved filters fill the defaults; a board saving none opens on the last 30 days", () => {
    expect(boardDefaults({ panels: [] })).toEqual({ period: { kind: 'relative', token: 'last-30-days' }, city: [], region: [], store: [], channel: [], country: [] })
    expect(boardDefaults({ panels: [], filters: { period: { kind: 'relative', token: 'this-week' }, region: ['central'] } })).toMatchObject({
      period: { kind: 'relative', token: 'this-week' },
      region: ['central'],
      store: [],
    })
  })

  it('panels read in logical order: row by row, then column by column', () => {
    const at = (id: string, x: number, y: number) => ({ id, kind: 'text' as const, text: { en: id, ar: id }, layout: { x, y, w: 6, h: 1 } })
    expect(inLogicalOrder([at('c', 0, 2), at('b', 6, 0), at('a', 0, 0)]).map((p) => p.id)).toEqual(['a', 'b', 'c'])
  })

  it('the strip counts n of N over one wave: panels join while it runs, it ends when none is fetching', () => {
    let w = streamProgress(NO_WAVE, ['p1', 'p2', 'p3'])
    expect([w.done, w.total]).toEqual([0, 3])
    w = streamProgress(w, ['p2', 'p3'])
    expect([w.done, w.total]).toEqual([1, 3])
    w = streamProgress(w, ['p3', 'p4']) // p4 joins the running wave
    expect([w.done, w.total]).toEqual([2, 4])
    w = streamProgress(w, [])
    expect(w).toEqual(NO_WAVE)
  })
})

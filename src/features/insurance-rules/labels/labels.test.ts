/**
 * Ticket 706 — a workbook's label diff, grouped by what happened to each code. The rows arrive as the door
 * sends them, so the groups keep the door's order, an unknown change is never dropped, and an empty diff says so.
 */
import { describe, expect, it } from 'vitest'
import { groupLabelDiff, uploadForm, type LabelDiffRow } from './labels'

const row = (code: string, change: string): LabelDiffRow => ({ system: 'http://nphies.sa/benefit-category', code, change, before: null, after: null })

describe('groupLabelDiff', () => {
  it('puts each row under added, changed or removed, in the order the door sent them', () => {
    const g = groupLabelDiff([row('3', 'changed'), row('2', 'added'), row('9', 'removed'), row('1', 'changed'), row('5', 'added')])
    expect(g.added.map((r) => r.code)).toEqual(['2', '5'])
    expect(g.changed.map((r) => r.code)).toEqual(['3', '1'])
    expect(g.removed.map((r) => r.code)).toEqual(['9'])
  })

  it('counts every row, and an empty diff has empty groups and a total of zero', () => {
    expect(groupLabelDiff([row('2', 'added'), row('3', 'removed')]).total).toBe(2)
    expect(groupLabelDiff([])).toEqual({ added: [], changed: [], removed: [], total: 0 })
  })

  it('shows a change it does not know as changed: a row is never lost', () => {
    const g = groupLabelDiff([row('7', 'renamed')])
    expect(g.changed.map((r) => r.code)).toEqual(['7'])
    expect(g.total).toBe(1)
  })
})

describe('uploadForm', () => {
  it('sends the file alone: the door reads which workbook it is', () => {
    const form = uploadForm(new File(['x'], 'CodeableConcept-v3.xlsx'))
    expect((form.get('file') as File).name).toBe('CodeableConcept-v3.xlsx')
    expect([...form.keys()]).toEqual(['file'])
  })
})

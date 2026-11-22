import { describe, expect, it } from 'vitest'
import { gridRowIds, rowKey } from './row-ids'

describe('a row’s key from its parts', () => {
  it('joins the parts, so two rows differ when any part does', () => {
    expect(rowKey('T1', '2026-11-22T10:00:00')).not.toBe(rowKey('T1', '2026-11-22T10:00:01'))
    expect(rowKey('T1', 'B1')).toBe(rowKey('T1', 'B1'))
  })

  it('is blank when every part is blank — it names no row', () => {
    expect(rowKey('', null, undefined, '  ')).toBe('')
  })
})

describe('the grid’s row ids for one page', () => {
  const idOf = (r: { id: string }) => r.id

  it('are the rows’ own keys when each names one row', () => {
    const rows = [{ id: 'a' }, { id: 'b' }]
    expect(rows.map((r) => gridRowIds(rows, idOf).get(r))).toEqual(['a', 'b'])
  })

  it('fall back to the row’s place when its key is blank or already taken — no row is dropped', () => {
    const rows = [{ id: 'a' }, { id: '' }, { id: 'a' }, { id: '' }]
    const ids = rows.map((r) => gridRowIds(rows, idOf).get(r))
    expect(ids).toEqual(['a', '#1', '#2', '#3'])
    expect(new Set(ids).size).toBe(rows.length)
  })
})

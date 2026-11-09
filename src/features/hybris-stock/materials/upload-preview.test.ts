import { describe, expect, it } from 'vitest'
import type { HybrisStockPreviewRow } from '@/core/models/hybris-stock'
import { changeKind, previewSummary, refusalKind, rowState } from './upload-preview'

const row = (rowNumber: number, outcome: HybrisStockPreviewRow['outcome'], over: Partial<HybrisStockPreviewRow> = {}): HybrisStockPreviewRow => ({
  rowNumber,
  materialNumber: String(100000 + rowNumber),
  enabled: null,
  currentEnabled: null,
  outcome,
  refusal: null,
  ...over,
})

const ROWS = [
  row(2, 'new'),
  row(3, 'changed', { enabled: false, currentEnabled: true }),
  row(4, 'unchanged', { currentEnabled: true }),
  row(5, 'refused', { refusal: 'unknownMaterial' }),
  row(6, 'refused', { refusal: 'malformed', materialNumber: 'ABC' }),
  row(7, 'refused', { refusal: 'unknownMaterial' }),
  row(8, 'new', { enabled: false }),
  row(9, 'refused', { refusal: 'badEnabled' }),
]

describe('previewSummary', () => {
  it('counts each outcome from the rows', () => {
    expect(previewSummary({ rows: ROWS, counts: { new: 2, changed: 1, unchanged: 1, refused: 4 } }).counts).toEqual({ new: 2, changed: 1, unchanged: 1, refused: 4 })
  })

  it('groups the rows by outcome, in file order', () => {
    const s = previewSummary({ rows: ROWS, counts: { new: 2, changed: 1, unchanged: 1, refused: 4 } })
    expect(s.groups.new.map((r) => r.rowNumber)).toEqual([2, 8])
    expect(s.groups.refused.map((r) => r.rowNumber)).toEqual([5, 6, 7, 9])
  })

  it('tallies refused rows by reason, named reasons first and anything else as other', () => {
    expect(previewSummary({ rows: ROWS, counts: { new: 2, changed: 1, unchanged: 1, refused: 4 } }).refusals).toEqual([
      { kind: 'unknownMaterial', count: 2 },
      { kind: 'malformed', count: 1 },
      { kind: 'other', count: 1 },
    ])
  })

  it('flags a server count that disagrees with its rows', () => {
    expect(previewSummary({ rows: ROWS, counts: { new: 2, changed: 1, unchanged: 1, refused: 4 } }).countsMismatch).toBe(false)
    expect(previewSummary({ rows: ROWS, counts: { new: 9, changed: 1, unchanged: 1, refused: 4 } }).countsMismatch).toBe(true)
  })

  it('commits only when a row would change the list', () => {
    expect(previewSummary({ rows: ROWS, counts: undefined as never }).canCommit).toBe(true)
    expect(previewSummary({ rows: [row(2, 'unchanged'), row(3, 'refused', { refusal: 'malformed' })], counts: undefined as never }).canCommit).toBe(false)
    expect(previewSummary({ rows: [], counts: undefined as never }).canCommit).toBe(false)
  })

  it('an outcome the door does not name reads as refused, never applied', () => {
    const s = previewSummary({ rows: [row(2, 'deleted' as never)], counts: undefined as never })
    expect(s.counts.refused).toBe(1)
    expect(s.canCommit).toBe(false)
  })
})

describe('rowState', () => {
  it("a row reads the state it will have: the file's ask, else the list's, else enabled (a new row states nothing)", () => {
    expect(rowState({ enabled: false, currentEnabled: true })).toBe(false)
    expect(rowState({ enabled: null, currentEnabled: false })).toBe(false)
    expect(rowState({ enabled: null, currentEnabled: null })).toBe(true)
  })
})

describe('refusalKind and changeKind', () => {
  it('names the known refusals', () => {
    expect(refusalKind('unknownMaterial')).toBe('unknownMaterial')
    expect(refusalKind('repeated')).toBe('repeated')
    expect(refusalKind('malformed')).toBe('malformed')
    // The guess had a separate bad-enabled refusal; the contract folds it into malformed, so the old word is "other".
    expect(refusalKind('badEnabled')).toBe('other')
    expect(refusalKind(null)).toBe('other')
    expect(refusalKind('nope')).toBe('other')
  })

  it('a changed row is an enable or a disable', () => {
    expect(changeKind({ outcome: 'changed', enabled: false, currentEnabled: true })).toBe('disable')
    expect(changeKind({ outcome: 'changed', enabled: true, currentEnabled: false })).toBe('enable')
    expect(changeKind({ outcome: 'new', enabled: false, currentEnabled: null })).toBeNull()
  })
})

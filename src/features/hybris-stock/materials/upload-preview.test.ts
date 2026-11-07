import { describe, expect, it } from 'vitest'
import type { HybrisStockPreviewRow } from '@/core/models/hybris-stock'
import { changeKind, previewSummary, refusalKind } from './upload-preview'

const row = (line: number, outcome: HybrisStockPreviewRow['outcome'], over: Partial<HybrisStockPreviewRow> = {}): HybrisStockPreviewRow => ({
  line,
  materialNumber: String(100000 + line),
  materialName: 'x',
  enabled: null,
  wasEnabled: null,
  outcome,
  refusal: null,
  ...over,
})

const ROWS = [
  row(2, 'new'),
  row(3, 'changed', { enabled: false, wasEnabled: true }),
  row(4, 'unchanged', { wasEnabled: true }),
  row(5, 'refused', { refusal: 'unknownMaterial', materialName: '' }),
  row(6, 'refused', { refusal: 'malformed', materialNumber: 'ABC' }),
  row(7, 'refused', { refusal: 'unknownMaterial' }),
  row(8, 'new', { enabled: false }),
  row(9, 'refused', { refusal: 'somethingElse' }),
]

describe('previewSummary', () => {
  it('counts each outcome from the rows', () => {
    expect(previewSummary({ rows: ROWS, counts: { new: 2, changed: 1, unchanged: 1, refused: 4 } }).counts).toEqual({ new: 2, changed: 1, unchanged: 1, refused: 4 })
  })

  it('groups the rows by outcome, in file order', () => {
    const s = previewSummary({ rows: ROWS, counts: { new: 2, changed: 1, unchanged: 1, refused: 4 } })
    expect(s.groups.new.map((r) => r.line)).toEqual([2, 8])
    expect(s.groups.refused.map((r) => r.line)).toEqual([5, 6, 7, 9])
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

describe('refusalKind and changeKind', () => {
  it('names the known refusals', () => {
    expect(refusalKind('unknownMaterial')).toBe('unknownMaterial')
    expect(refusalKind('repeated')).toBe('repeated')
    expect(refusalKind(null)).toBe('other')
    expect(refusalKind('nope')).toBe('other')
  })

  it('a changed row is an enable or a disable', () => {
    expect(changeKind({ outcome: 'changed', enabled: false, wasEnabled: true })).toBe('disable')
    expect(changeKind({ outcome: 'changed', enabled: true, wasEnabled: false })).toBe('enable')
    expect(changeKind({ outcome: 'new', enabled: false, wasEnabled: null })).toBeNull()
  })
})

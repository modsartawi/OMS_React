import { describe, expect, it } from 'vitest'
import type { ItemListPreview } from '@/core/models/item-list'
import { fileProblem, problemGroups, saveState, tokenExpired } from './preview'

const matchedRow = { row: 2, level: 'item' as const, key: '100234', label: 'Panadol 500mg 24', from: '2026-09-03', to: null, status: 'unavailable' as const, statusText: 'unavailable', note: '' }

const preview = (over: Partial<ItemListPreview> = {}): ItemListPreview => ({
  token: 'tok-1',
  expiresAt: '2026-11-19T12:30:00Z',
  fileName: 'shortage-q3.xlsx',
  rowCount: 9,
  matched: [matchedRow],
  problems: [],
  ...over,
})

describe('problemGroups: each problem kind, in the preview’s order, each problem with its row numbers', () => {
  it('lists unknown values, then duplicates, bad dates, overlaps and refused rows — each kind once, rows ascending', () => {
    const groups = problemGroups(
      preview({
        problems: [
          { kind: 'overlap', rows: [9, 4], level: 'item', value: '100234', reason: '' },
          { kind: 'unknown', rows: [7], level: 'brand', value: 'Panadool', reason: '' },
          { kind: 'badDate', rows: [5], level: 'item', value: '31/02/2026', reason: '' },
          { kind: 'unknown', rows: [3], level: 'item', value: '0099999', reason: '' },
          { kind: 'duplicate', rows: [8, 6], level: 'category', value: 'Analgesics', reason: '' },
          { kind: 'refused', rows: [10], level: 'item', value: '100235', reason: 'The note holds a phone number.' },
        ],
      }),
    )
    expect(groups.map((g) => g.kind)).toEqual(['unknown', 'duplicate', 'badDate', 'overlap', 'refused'])
    expect(groups[0].problems.map((p) => [p.rows, p.value])).toEqual([
      [[3], '0099999'],
      [[7], 'Panadool'],
    ])
    expect(groups[1].problems[0].rows).toEqual([6, 8])
    expect(groups[3].problems[0].rows).toEqual([4, 9])
    expect(groups[4].problems[0].reason).toBe('The note holds a phone number.')
  })

  it('a kind with no problem is left out; a clean file has no groups', () => {
    expect(problemGroups(preview())).toEqual([])
    expect(problemGroups(preview({ problems: [{ kind: 'badDate', rows: [2], level: 'item', value: 'soon', reason: '' }] })).map((g) => g.kind)).toEqual(['badDate'])
  })
})

describe('saveState: Save is enabled only on a live preview that matched something, named and shared', () => {
  const now = Date.parse('2026-11-19T12:00:00Z')
  const everyone = { everyone: true, roles: [], users: [] }
  const ready = { preview: preview(), mode: 'create' as const, name: 'Shortage Q3', audience: everyone, now, pending: false }

  it('a matched preview, a name and an audience may be saved', () => {
    expect(saveState(ready)).toEqual({ enabled: true, reason: null })
  })
  it('is disabled while nothing matched, even with every other field filled', () => {
    expect(saveState({ ...ready, preview: preview({ matched: [] }) })).toEqual({ enabled: false, reason: 'nothingMatched' })
  })
  it('saves the matched rows when some are unknown (story 6)', () => {
    const some = preview({ problems: [{ kind: 'unknown', rows: [3], level: 'item', value: '0099999', reason: '' }] })
    expect(saveState({ ...ready, preview: some }).enabled).toBe(true)
  })
  it('is disabled with no file read, a blank name, an empty chosen audience, or while saving', () => {
    expect(saveState({ ...ready, preview: null }).reason).toBe('noFile')
    expect(saveState({ ...ready, name: '   ' }).reason).toBe('noName')
    expect(saveState({ ...ready, audience: { everyone: false, roles: [], users: [] } }).reason).toBe('noAudience')
    expect(saveState({ ...ready, pending: true }).reason).toBe('saving')
  })
  it('a re-upload needs neither name nor audience: it replaces the list’s contents only', () => {
    expect(saveState({ ...ready, mode: 'replace', name: '', audience: { everyone: false, roles: [], users: [] } })).toEqual({ enabled: true, reason: null })
  })
  it('an expired token is disabled before anything else is judged', () => {
    expect(saveState({ ...ready, now: Date.parse('2026-11-19T12:30:00Z') }).reason).toBe('expired')
  })
})

describe('tokenExpired: the preview’s token lapses at its expiresAt (30 minutes)', () => {
  it('is live before, expired at and after', () => {
    const p = preview({ expiresAt: '2026-11-19T12:30:00Z' })
    expect(tokenExpired(p, Date.parse('2026-11-19T12:29:59Z'))).toBe(false)
    expect(tokenExpired(p, Date.parse('2026-11-19T12:30:00Z'))).toBe(true)
  })
  it('a token with no or an unreadable expiry is the server’s to judge (never expired here)', () => {
    expect(tokenExpired(preview({ expiresAt: '' }), Date.parse('2030-01-01T00:00:00Z'))).toBe(false)
    expect(tokenExpired(preview({ expiresAt: 'soon' }), Date.parse('2030-01-01T00:00:00Z'))).toBe(false)
  })
})

describe('fileProblem: the drop takes an .xlsx or a .csv of at most 2 MB', () => {
  it('takes either kind, in any case, up to and at 2 MB', () => {
    expect(fileProblem({ name: 'list.xlsx', size: 10 })).toBeNull()
    expect(fileProblem({ name: 'LIST.CSV', size: 2 * 1024 * 1024 })).toBeNull()
  })
  it('refuses another kind, and a file over 2 MB', () => {
    expect(fileProblem({ name: 'list.xls', size: 10 })).toBe('type')
    expect(fileProblem({ name: 'list.txt', size: 10 })).toBe('type')
    expect(fileProblem({ name: 'list.xlsx', size: 2 * 1024 * 1024 + 1 })).toBe('size')
  })
})

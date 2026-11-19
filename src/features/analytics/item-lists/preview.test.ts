import { describe, expect, it } from 'vitest'
import type { ItemListPreview, ItemListProblem } from '@/core/models/item-list'
import { fileProblem, problemGroups, saveState, tokenDeadline } from './preview'

const preview = (over: Partial<ItemListPreview> = {}): ItemListPreview => ({
  token: 'tok-1',
  expiresAt: '2026-11-19T12:30:00',
  name: '',
  fileName: 'shortage-q3.xlsx',
  rowCount: 9,
  matchedRows: 8,
  unknownRows: 1,
  members: [{ level: 'item', key: '100234', label: 'Panadol 500mg 24' }],
  periods: [],
  unknown: [],
  problems: [],
  notices: [],
  overrides: [],
  ...over,
})
const problem = (kind: ItemListProblem['kind'], rows: number[], message = ''): ItemListProblem => ({ kind, rows, field: 'key', reason: kind, message })

describe('problemGroups: the unknown values, each problem kind, then the notices — each with its row numbers', () => {
  it('lists unknown values first, then duplicates, bad dates, overlaps, refused rows and notices; rows ascending', () => {
    const groups = problemGroups(
      preview({
        unknown: [
          { row: 7, level: 'brand', value: 'Panadool' },
          { row: 3, level: 'item', value: '0099999' },
        ],
        problems: [problem('overlap', [9, 4]), problem('badDate', [5]), problem('duplicate', [8, 6]), problem('refused', [10], 'The note holds a phone number.')],
        notices: [problem('notice', [11], 'The note is cut to 200 characters.')],
      }),
    )
    expect(groups.map((g) => g.kind)).toEqual(['unknown', 'duplicate', 'badDate', 'overlap', 'refused', 'notice'])
    expect(groups[0].problems.map((p) => [p.rows, p.value])).toEqual([
      [[3], '0099999'],
      [[7], 'Panadool'],
    ])
    expect(groups[1].problems[0].rows).toEqual([6, 8])
    expect(groups[3].problems[0].rows).toEqual([4, 9])
    expect(groups[4].problems[0].message).toBe('The note holds a phone number.')
    expect(groups[5].problems[0].message).toBe('The note is cut to 200 characters.')
  })

  it('a kind with nothing in it is left out; a clean file has no groups', () => {
    expect(problemGroups(preview())).toEqual([])
    expect(problemGroups(preview({ problems: [problem('badDate', [2])] })).map((g) => g.kind)).toEqual(['badDate'])
  })
  it('a problem naming no row (the name) is listed last in its kind', () => {
    expect(problemGroups(preview({ problems: [problem('refused', []), problem('refused', [4])] }))[0].problems.map((p) => p.rows)).toEqual([[4], []])
  })
})

describe('saveState: Save is enabled only on a saveable preview, named and shared', () => {
  const now = Date.parse('2026-11-19T12:00:00Z')
  const everyone = { everyone: true, roles: [], users: [] }
  const deadline = Date.parse('2026-11-19T12:30:00Z')
  const ready = { preview: preview(), mode: 'create' as const, name: 'Shortage Q3', audience: everyone, deadline, now, pending: false }

  it('a matched preview, a name and an audience may be saved', () => {
    expect(saveState(ready)).toEqual({ enabled: true, reason: null })
  })
  it('is disabled while nothing matched, even with every other field filled', () => {
    expect(saveState({ ...ready, preview: preview({ members: [], token: '' }) })).toEqual({ enabled: false, reason: 'nothingMatched' })
  })
  it('saves the matched members when some values are unknown (story 6): they never hold it', () => {
    const some = preview({ unknown: [{ row: 3, level: 'item', value: '0099999' }] })
    expect(saveState({ ...ready, preview: some }).enabled).toBe(true)
  })
  it('is held while the file has problems: the server gives such a preview no token (BO 4058)', () => {
    const refused = preview({ token: '', expiresAt: '', problems: [problem('duplicate', [4, 5])] })
    expect(saveState({ ...ready, preview: refused })).toEqual({ enabled: false, reason: 'problems' })
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
  it('an expired token is disabled before anything else is judged: live before its deadline, expired at it', () => {
    expect(saveState({ ...ready, now: deadline - 1 }).reason).toBeNull()
    expect(saveState({ ...ready, now: deadline }).reason).toBe('expired')
  })
})

describe('tokenDeadline: the token lives the server’s 30 minutes counted from when this page received it', () => {
  it('is 30 minutes from receipt: the server’s expiresAt is its local wall clock with no zone, never compared with this machine’s', () => {
    const received = Date.parse('2026-11-19T15:00:00Z')
    expect(tokenDeadline(received)).toBe(Date.parse('2026-11-19T15:30:00Z'))
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

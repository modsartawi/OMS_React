import { describe, expect, it } from 'vitest'
import { liveAliases } from './alias-form'
import { affectedRows, draftOf } from './repin'

describe('the doors as built', () => {
  it('lists only live aliases', () => {
    const row = (status: string) => ({ id: status, payer: 'p', wrongUrl: 'w', canonicalUrl: 'c', status })
    expect(liveAliases([row('proposed'), row('approved'), row('rejected'), row('retired')]).map((a) => a.id)).toEqual(['proposed', 'approved'])
    expect(liveAliases(null)).toEqual([])
  })

  it('shows one re-pin row per change and raises by the field key', () => {
    const rows = affectedRows(
      [{ kind: 'guard', versionNo: 4, pendingDraftId: '', changes: [{ scope: 'claim', key: 'a', oldPath: 'x', newPath: 'y' }, { scope: 'claim', key: 'b', oldPath: 'p', newPath: 'p', aliasesAdded: [{}] }] }],
      [{ kind: 'monitor', versionNo: 2, labelVersionNo: 1, latestLabelVersionNo: 3, pendingDraftId: 'D' }],
    )
    expect(rows.map((r) => [r.kind, r.changeId, r.rulesetId, r.draftId])).toEqual([
      ['path', 'a', 'guard', null],
      ['alias', 'b', 'guard', null],
      ['labels', 'labels', 'monitor', 'D'],
    ])
  })

  it('names the URLs of an alias change, in a row and in its draft', () => {
    const change = { scope: 'claim', key: 'b', oldPath: 'p', newPath: 'p', aliasesAdded: [{ payer: '1', wrongUrl: 'http://w', canonicalUrl: 'http://c' }] }
    const row = affectedRows([{ kind: 'guard', versionNo: 4, changes: [change] }], [])[0]
    expect([row.kind, row.before, row.after]).toEqual(['alias', null, 'http://w → http://c'])
    const d = draftOf({ id: '1', kind: 'guard', baseVersionNo: 4, state: 'pending', changes: [change] })
    expect([d.kind, d.before, d.after]).toEqual(['alias', null, 'http://w → http://c'])
  })

  it('reads a draft: pending is open, the counts become the back-test', () => {
    const d = draftOf({ id: '1', kind: 'guard', baseVersionNo: 4, state: 'pending', requestedBy: 'a', changes: [{ scope: 'claim', key: 'a', oldPath: 'x', newPath: 'y' }], backtest: [{ rows: [{ same: 5, gained: 1, lost: 1, changed: 1 }] }] })
    expect(d.state).toBe('open')
    expect(d.backtest).toMatchObject({ status: 'done', bundles: 8, changedTotal: 3 })
    expect(draftOf({ id: '2', kind: 'guard', baseVersionNo: 4, state: 'pending', labelsOnly: true }).kind).toBe('labels')
  })
})

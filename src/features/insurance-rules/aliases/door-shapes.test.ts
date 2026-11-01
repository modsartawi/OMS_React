import { describe, expect, it } from 'vitest'
import { liveAliases } from './alias-form'
import { affectedRows, draftOf } from './repin'
import { compileVerdictOf, probeReplyOf, scopeOf } from '../fields/raw-path'
import { proposalOf } from '../fields/field-proposal'
import { refParts, sampleRef, treeClickOf, treeNodeOf } from '../fields/bundle-tree'
import { overrideOf, worklistRows } from '../labels/overrides'

describe('the doors as built', () => {
  it('keeps a probe warning in the words the door sent', () => {
    expect(probeReplyOf({ warnings: [{ code: 'caseOnlyCode', en: 'Case only', ar: 'حالة' }] }).warnings).toEqual([
      { code: 'caseOnlyCode', message: 'Case only', says: { en: 'Case only', ar: 'حالة' } },
    ])
  })

  it('reads the worklist out of its envelope, and an empty reply as no rows', () => {
    expect(worklistRows({ items: [{ tier: 'rulesetCanShow', system: 's', code: 'c', en: 'E', ar: '', censusCount: 3 }] })).toEqual([
      { system: 's', code: 'c', reason: 'lacksArabic', frequency: 3, current: { en: 'E', ar: '' } },
    ])
    expect(worklistRows(null)).toEqual([])
  })

  it('reads an override, year 1 as not stamped', () => {
    const o = overrideOf({ id: '1', system: 's', code: 'c', status: 'proposed', author: 'a', proposedAt: '2026-10-31T10:00:00', decidedBy: '', decidedAt: '0001-01-01T00:00:00' })
    expect(o.state).toBe('proposed')
    expect(o.proposedBy).toBe('a')
    expect(o.approvedAt).toBeNull()
    expect(o.approvedBy).toBeNull()
  })

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

  it('holds a kept copy as one ref and refuses what is not one', () => {
    expect(refParts(sampleRef({ kind: 'answer', keptId: 'A/1' }))).toEqual({ kind: 'answer', keptId: 'A/1' })
    expect(refParts('nothing')).toBeNull()
    expect(refParts('/x')).toBeNull()
  })

  it('reads a tree and a click', () => {
    expect(treeNodeOf({ id: 'n', name: 'a', type: 'code', value: 'v', clickable: true, children: [{ id: 'm', name: 'b' }] })).toMatchObject({ nodeRef: 'n', fhirType: 'code', pickable: true, children: [{ nodeRef: 'm', pickable: false }] })
    const click = treeClickOf({ scope: 'line.claimResponse', type: 'code', cardinality: 'single', fhirPath: 'p', existing: [{ key: 'k', labelEn: 'K' }], notices: [{ code: 'patient' }] })
    expect(click.proposal).toMatchObject({ moment: 'claimResponse', level: 'line', path: 'p' })
    expect(click.existing?.key).toBe('k')
    expect(click.patient).toBe(true)
  })

  it('reads the raw-path doors', () => {
    expect(scopeOf({ moment: 'claim', level: 'line' })).toBe('line.claim')
    expect(scopeOf({ moment: 'claim', level: 'message' })).toBe('claim')
    expect(compileVerdictOf({ valid: true, readsPatient: true })).toEqual({ refusals: [], warnings: [{ code: 'patient', message: 'patient' }] })
    expect(compileVerdictOf({ valid: false, syntaxError: 'bad', refusedFunctions: ['now'] }).refusals.map((r) => r.detail)).toEqual(['bad', 'now'])
    expect(probeReplyOf({ rows: [{ source: 'golden', payer: '', match: 2 }], errors: [{ code: 'badPath', en: 'no' }] })).toEqual({
      payers: [{ payer: 'golden', match: 2, noMatch: 0, unknown: 0 }],
      refusals: [{ code: 'badPath', message: 'no', detail: 'no' }],
      warnings: [],
    })
  })

  it('reads a proposal', () => {
    const p = proposalOf({ id: '1', key: 'k', scope: 'line.claim', labelEn: 'E', labelAr: 'A', type: 'code', cardinality: 'single', fhirPath: 'p', status: 'rejected', decisionNote: 'why', warnings: [{ code: 'patient' }] })
    expect(p).toMatchObject({ moment: 'claim', level: 'line', state: 'rejected', rejectReason: 'why', patientWarning: true, label: { en: 'E', ar: 'A' } })
  })
})

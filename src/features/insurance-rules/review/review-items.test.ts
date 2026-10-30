/**
 * Ticket 702 — the Review list's new item kinds. A wire row reads into its kind's detail, and a kind this screen
 * has never heard of still reads, as a generic row: the server may add a kind before the client knows it.
 */
import { describe, expect, it } from 'vitest'
import { packageDiffGroups, reviewIn, type ReviewReply } from './model'
import { reviewFromParams } from './review-query'

const wire = (o: Partial<ReviewReply>): ReviewReply => ({
  id: 'R-1', kind: 'monitor', at: '2026-10-27T09:00:00', store: '', pharmacist: '', ruleId: null, item: null, patient: null, reason: null, note: null, exceptionId: null, mark: null, ...o,
})

describe('reviewIn', () => {
  it('reviewIn_monitor_readsRuleSeverityTextAndMessage', () => {
    const row = reviewIn(wire({ ruleId: 'M-004', severity: 'action', text: { en: 'Pre-auth denied', ar: 'رُفض الإذن' }, message: { source: 'nphies', id: 'CR-778' } }))
    expect(row.ruleId).toBe('M-004')
    expect(row.detail).toEqual({ shape: 'monitor', severity: 'action', text: { en: 'Pre-auth denied', ar: 'رُفض الإذن' }, message: { source: 'nphies', id: 'CR-778' } })
    expect(row.cleared).toBeNull()
  })

  it('reviewIn_monitor_anUnheardSeverityHasNoBadgeRatherThanAWrongOne', () => {
    expect(reviewIn(wire({ severity: 'OVERRIDE' })).detail).toMatchObject({ shape: 'monitor', severity: null })
    expect(reviewIn(wire({ severity: 'INFO' })).detail).toMatchObject({ shape: 'monitor', severity: 'info' })
  })

  it('reviewIn_notEvaluated_namesTheAnswerAndTheFailure', () => {
    const row = reviewIn(wire({ kind: 'notEvaluated', failure: 'watcher', message: { source: 'nphies', id: 'CR-901' } }))
    expect(row.detail).toEqual({ shape: 'notEvaluated', failure: 'watcher', message: { source: 'nphies', id: 'CR-901' } })
    expect(reviewIn(wire({ kind: 'notEvaluated', failure: 'gremlin' })).detail).toMatchObject({ failure: null, message: null })
  })

  it('reviewIn_unknownKind_readsAsAGenericRow', () => {
    const row = reviewIn(wire({ kind: 'somethingNew', text: { en: 'Look at this', ar: '' }, message: { source: 'nphies', id: 'X-1' } }))
    expect(row.kind).toBe('somethingNew')
    expect(row.detail).toEqual({ shape: 'generic', text: { en: 'Look at this', ar: '' }, message: { source: 'nphies', id: 'X-1' } })
    expect(reviewIn(wire({ kind: 'bare' })).detail).toEqual({ shape: 'generic', text: { en: '', ar: '' }, message: null })
  })

  it('reviewIn_existingKinds_stayDecisionsWithTheirMark', () => {
    const row = reviewIn(wire({ kind: 'override', ruleId: 'G-002', severity: 'OVERRIDE', item: '100234', mark: { mark: 'ok', note: 'fine', by: 'rev', at: '2026-10-27T10:00:00' } }))
    expect(row.detail).toEqual({ shape: 'decision' })
    expect(row.mark).toBe('ok')
    expect(row.item).toEqual({ code: '100234', name: '' })
  })

  it('reviewIn_cleared_readsTheNoteAndWho', () => {
    expect(reviewIn(wire({ cleared: { note: 'Called the payer', by: 'ins.huda', at: '2026-10-27T11:00:00' } })).cleared).toEqual({ note: 'Called the payer', by: 'ins.huda', at: '2026-10-27T11:00:00' })
  })
})

describe('reviewIn — the label and package items (708)', () => {
  it('reviewIn_labelsChanged_readsTheRulesetAndItsDraft', () => {
    expect(reviewIn(wire({ kind: 'labelsChanged', ruleset: { id: 'guards', name: 'Guards', version: 7 }, draftId: 'D-9' })).detail).toEqual({ shape: 'labelsChanged', ruleset: { id: 'guards', name: 'Guards', version: 7 }, draftId: 'D-9' })
    expect(reviewIn(wire({ kind: 'labelsChanged' })).detail).toEqual({ shape: 'labelsChanged', ruleset: null, draftId: null })
  })

  it('reviewIn_uploadDue_readsWhy_andAnUnheardWhyIsUnstated', () => {
    expect(reviewIn(wire({ kind: 'uploadDue', due: { why: 'newPackage', version: '5.1.0', system: null, code: null } })).detail).toEqual({ shape: 'uploadDue', why: 'newPackage', version: '5.1.0', code: null })
    expect(reviewIn(wire({ kind: 'uploadDue', due: { why: 'unlistedCode', version: null, system: 'benefit-category', code: '99' } })).detail).toEqual({ shape: 'uploadDue', why: 'unlistedCode', version: null, code: { system: 'benefit-category', code: '99' } })
    expect(reviewIn(wire({ kind: 'uploadDue', due: { why: 'gremlin' } })).detail).toMatchObject({ why: null })
    expect(reviewIn(wire({ kind: 'uploadDue' })).detail).toEqual({ shape: 'uploadDue', why: null, version: null, code: null })
  })

  it('reviewIn_package_readsTheVersionsAndTheDiff_aMissingListBeingEmpty', () => {
    const row = reviewIn(wire({ kind: 'package', package: { version: '5.1.0', previousVersion: '5.0.0', profiles: { added: ['P-new'] }, extensions: { renamed: [{ from: 'E-old', to: 'E-new' }] } } }))
    expect(row.detail).toEqual({
      shape: 'package',
      version: '5.1.0',
      previousVersion: '5.0.0',
      diff: {
        profiles: { added: ['P-new'], removed: [], renamed: [] },
        extensions: { added: [], removed: [], renamed: [{ from: 'E-old', to: 'E-new' }] },
        codeSystems: { added: [], removed: [], renamed: [] },
      },
    })
  })
})

describe('packageDiffGroups', () => {
  const none = { added: [], removed: [], renamed: [] }
  it('only the groups that moved, profiles then extensions then CodeSystems, each with its count', () => {
    expect(
      packageDiffGroups({
        profiles: { added: ['P-1'], removed: ['P-2'], renamed: [] },
        extensions: none,
        codeSystems: { added: [], removed: [], renamed: [{ from: 'CS-a', to: 'CS-b' }] },
      }),
    ).toEqual([
      { group: 'profiles', count: 2, lines: [{ change: 'added', name: 'P-1', renamedTo: null }, { change: 'removed', name: 'P-2', renamedTo: null }] },
      { group: 'codeSystems', count: 1, lines: [{ change: 'renamed', name: 'CS-a', renamedTo: 'CS-b' }] },
    ])
  })
  it('an empty diff has no groups', () => {
    expect(packageDiffGroups({ profiles: none, extensions: none, codeSystems: none })).toEqual([])
  })
})

describe('reviewFromParams', () => {
  it('reviewFromParams_keepsTheLabelAndPackageKinds', () => {
    for (const kind of ['labelsChanged', 'uploadDue', 'package']) expect(reviewFromParams(new URLSearchParams(`kind=${kind}`)).kind).toBe(kind)
  })
  it('reviewFromParams_keepsTheNewKinds_andDropsOneItCannotOffer', () => {
    expect(reviewFromParams(new URLSearchParams('kind=monitor')).kind).toBe('monitor')
    expect(reviewFromParams(new URLSearchParams('kind=notEvaluated')).kind).toBe('notEvaluated')
    expect(reviewFromParams(new URLSearchParams('kind=somethingNew')).kind).toBe('')
  })
})

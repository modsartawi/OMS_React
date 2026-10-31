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
    const row = reviewIn(wire({ ruleId: 'M-004', severity: 'action', en: 'Pre-auth denied', ar: 'رُفض الإذن', messageSource: 'nphies', messageId: 'CR-778' }))
    expect(row.ruleId).toBe('M-004')
    expect(row.detail).toEqual({ shape: 'monitor', severity: 'action', text: { en: 'Pre-auth denied', ar: 'رُفض الإذن' }, message: { source: 'nphies', id: 'CR-778' } })
    expect(row.cleared).toBeNull()
  })

  it('reviewIn_monitor_anUnheardSeverityHasNoBadgeRatherThanAWrongOne', () => {
    expect(reviewIn(wire({ severity: 'OVERRIDE' })).detail).toMatchObject({ shape: 'monitor', severity: null })
    expect(reviewIn(wire({ severity: 'INFO' })).detail).toMatchObject({ shape: 'monitor', severity: 'info' })
  })

  it('reviewIn_notEvaluated_namesTheAnswerAndTheError', () => {
    const row = reviewIn(wire({ kind: 'not-evaluated', error: 'gave up', messageSource: 'nphies', messageId: 'CR-901' }))
    expect(row.detail).toEqual({ shape: 'notEvaluated', error: 'gave up', message: { source: 'nphies', id: 'CR-901' } })
    expect(reviewIn(wire({ kind: 'not-evaluated', messageId: '' })).detail).toEqual({ shape: 'notEvaluated', error: null, message: null })
  })

  it('reviewIn_unknownKind_readsAsAGenericRow', () => {
    const row = reviewIn(wire({ kind: 'somethingNew', en: 'Look at this', messageSource: 'nphies', messageId: 'X-1' }))
    expect(row.kind).toBe('somethingNew')
    expect(row.detail).toEqual({ shape: 'generic', text: { en: 'Look at this', ar: '' }, message: { source: 'nphies', id: 'X-1' } })
    expect(reviewIn(wire({ kind: 'bare' })).detail).toEqual({ shape: 'generic', text: { en: '', ar: '' }, message: null })
  })

  it('reviewIn_existingKinds_stayDecisionsWithTheirMark', () => {
    const row = reviewIn(wire({ kind: 'override', ruleId: 'G-002', severity: 'OVERRIDE', item: '100234', mark: { mark: 'ok', note: 'fine', by: 'rev', at: '2026-10-27T10:00:00' } }))
    expect(row.detail).toEqual({ shape: 'decision' })
    expect(row.mark).toBe('ok')
    expect(row.cleared).toBeNull()
    expect(row.item).toEqual({ code: '100234', name: '' })
  })

  it('reviewIn_clearedDrift_readsTheClearingNotAMark', () => {
    const row = reviewIn(wire({ kind: 'drift', mark: { mark: 'cleared', note: 'Called the payer', by: 'ins.huda', at: '2026-10-27T11:00:00' } }))
    expect(row.cleared).toEqual({ note: 'Called the payer', by: 'ins.huda', at: '2026-10-27T11:00:00' })
    expect(row.mark).toBeNull()
  })

  it('reviewIn_drift_readsTheDoorsFields', () => {
    const row = reviewIn(wire({ kind: 'drift', payer: 'waseel', signal: 'answer-rate', subject: 'line.claimResponse.copay', trailingRate: 0.125, baselineRate: 0.5, sampleSource: 'nphies', sampleId: 'A-1' }))
    expect(row.detail).toEqual({
      shape: 'drift',
      payer: 'waseel',
      signal: { type: 'rateFell', measure: 'answer', field: '$line.claimResponse.copay', rate: 0.125, baseline: 0.5 },
      sample: { source: 'nphies', id: 'A-1' },
    })
  })
})

describe('reviewIn — the upload and package items (708)', () => {
  it('reviewIn_uploadDue_codesMeanAnUnlistedCode_noneMeanANewPackage', () => {
    expect(reviewIn(wire({ kind: 'upload-due', uploadDue: { packageVersion: '5.1.0', codeCount: 0, codes: [], isOpen: true, closedByVersion: 0 } })).detail).toEqual({ shape: 'uploadDue', why: 'newPackage', version: '5.1.0', codeCount: 0, codes: [], closedBy: null })
    expect(reviewIn(wire({ kind: 'upload-due', uploadDue: { packageVersion: '', codeCount: 7, codes: [{ system: 'benefit-category', code: '99' }], isOpen: false, closedByVersion: 4 } })).detail).toEqual({ shape: 'uploadDue', why: 'unlistedCode', version: null, codeCount: 7, codes: [{ system: 'benefit-category', code: '99' }], closedBy: 4 })
    expect(reviewIn(wire({ kind: 'upload-due' })).detail).toEqual({ shape: 'uploadDue', why: 'newPackage', version: null, codeCount: 0, codes: [], closedBy: null })
  })

  it('reviewIn_package_readsTheVersionAndDiff_aMissingListBeingEmpty_andOnlyTheFieldsToCheck', () => {
    const row = reviewIn(wire({
      kind: 'ig-package',
      igPackage: {
        version: '5.1.0',
        diff: { profiles: { added: ['P-new'] }, extensions: { renamed: [{ from: 'E-old', to: 'E-new' }] } },
        revalidation: [{ key: 'ok.field', status: 'ok' }, { key: 'bad.field', status: 'badPath', why: 'No compile' }, { key: 'new.status', status: 'gremlin' }],
      },
    }))
    expect(row.detail).toEqual({
      shape: 'package',
      version: '5.1.0',
      diff: {
        profiles: { added: ['P-new'], removed: [], renamed: [] },
        extensions: { added: [], removed: [], renamed: [{ from: 'E-old', to: 'E-new' }] },
        codeSystems: { added: [], removed: [], renamed: [] },
      },
      revalidation: [{ key: 'bad.field', status: 'badPath', why: 'No compile' }],
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
  it('reviewFromParams_keepsTheDoorsSpellings', () => {
    for (const kind of ['monitor', 'not-evaluated', 'drift', 'upload-due', 'ig-package']) expect(reviewFromParams(new URLSearchParams(`kind=${kind}`)).kind).toBe(kind)
  })
  it('reviewFromParams_dropsOneTheDoorWouldRefuse', () => {
    for (const kind of ['notEvaluated', 'labelsChanged', 'somethingNew']) expect(reviewFromParams(new URLSearchParams(`kind=${kind}`)).kind).toBe('')
  })
})

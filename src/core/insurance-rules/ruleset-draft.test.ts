/** Ticket 617 — approval of the category / coverage draft on the guard doors as built (3139 / 3145 / 3146): no back-test, publishes live. */
import { describe, expect, it } from 'vitest'
import { draftDocument, rulesetActions, type RulesetDraft } from './ruleset-draft'

const draft = (over: Partial<RulesetDraft<{ revision: number }>> = {}): RulesetDraft<{ revision: number }> => ({
  revision: 5,
  state: 'editing',
  origin: null,
  baseVersionNo: 3,
  updatedBy: 'ins.huda',
  updatedAt: '2026-10-27T09:00:00',
  requestedBy: null,
  requestedAt: null,
  requestNote: null,
  reviewedBy: null,
  reviewNote: null,
  document: { revision: 5 },
  ...over,
})
const clean = { errors: 0, warnings: 0, blocked: false }

describe('rulesetActions', () => {
  it('rulesetActions_asksForTheSavedDraft_withNoBacktest — submit once saved and HQ’s checks show no error', () => {
    expect(rulesetActions({ draft: draft(), userId: 'ins.huda', checks: clean })).toEqual([{ kind: 'submit', enabled: true, why: null }])
    expect(rulesetActions({ draft: draft({ state: 'sentBack' }), userId: 'ins.huda', checks: clean })).toEqual([{ kind: 'submit', enabled: true, why: null }])
    expect(rulesetActions({ draft: draft(), userId: 'ins.huda', checks: clean, dirty: true })[0].why).toBe('unsaved')
    expect(rulesetActions({ draft: draft(), userId: 'ins.huda', checks: null })[0].why).toBe('checking')
    expect(rulesetActions({ draft: draft(), userId: 'ins.huda', checks: { errors: 1, warnings: 0, blocked: true } })[0].why).toBe('checks')
  })

  it('no draft (state none): nothing to ask for', () => {
    expect(rulesetActions({ draft: draft({ state: 'none', revision: 0 }), userId: 'ins.huda', checks: clean })).toEqual([])
  })

  it('pending: whoever asked or last edited never approves it', () => {
    const pending = draft({ state: 'pending', requestedBy: 'ins.huda', updatedBy: 'ins.huda' })
    expect(rulesetActions({ draft: pending, userId: 'rev.salem', checks: clean })).toEqual([
      { kind: 'approve', enabled: true, why: null },
      { kind: 'sendBack', enabled: true, why: null },
    ])
    expect(rulesetActions({ draft: pending, userId: 'INS.HUDA', checks: clean })[0]).toEqual({ kind: 'approve', enabled: false, why: 'ownSubmission' })
    expect(rulesetActions({ draft: { ...pending, requestedBy: 'ins.omar' }, userId: 'ins.huda', checks: clean })[0].why).toBe('ownSubmission')
  })

  it('draftDocument_carriesTheDraftRevision — the document the editor holds is stamped with the draft’s revision', () => {
    expect(draftDocument(draft({ revision: 0, state: 'none', document: { revision: 9 } }))).toEqual({ revision: 0 })
  })
})

import { describe, expect, it } from 'vitest'
import type { RuleCampaign, RuleCampaignRoles, RuleCampaignStatus, RuleDraft, RuleDraftState } from '@/core/models/rule-campaign'
import { actionGate, actionsFor, draftGate, preActivationSteps, showsSteps, type ApprovalAction } from './approval'

const AUTHOR: RuleCampaignRoles = { author: true, approver: false }
const APPROVER: RuleCampaignRoles = { author: false, approver: true }
const BOTH: RuleCampaignRoles = { author: true, approver: true }
const NEITHER: RuleCampaignRoles = { author: false, approver: false }

type Life = Pick<RuleDraft, 'source' | 'state' | 'campaignStatus'>
/** A loaded draft: `state` null = Load answered the newest version (no draft). */
const of = (state: RuleDraftState | null, campaignStatus: RuleCampaignStatus = ''): Life => ({
  source: state === null ? 'published' : 'draft',
  state: state ?? 'editing',
  campaignStatus,
})
const STATES: (RuleDraftState | null)[] = ['editing', 'pending', 'sentBack', null]
const STATUSES: RuleCampaignStatus[] = ['', 'Published', 'Disabled']

describe('actionsFor_authorNeverActivates_approverCan', () => {
  it('every draft state × role, never published', () => {
    const table: Record<string, Record<string, ApprovalAction[]>> = {
      editing: { author: ['askForApproval', 'deleteDraft'], approver: [], both: ['askForApproval', 'deleteDraft'], neither: [] },
      sentBack: { author: ['askForApproval', 'deleteDraft'], approver: [], both: ['askForApproval', 'deleteDraft'], neither: [] },
      pending: { author: [], approver: ['activate', 'sendBack'], both: ['activate', 'sendBack'], neither: [] },
    }
    for (const s of ['editing', 'sentBack', 'pending'] as RuleDraftState[]) {
      expect(actionsFor(of(s), AUTHOR), `${s} author`).toEqual(table[s].author)
      expect(actionsFor(of(s), APPROVER), `${s} approver`).toEqual(table[s].approver)
      expect(actionsFor(of(s), BOTH), `${s} both`).toEqual(table[s].both)
      expect(actionsFor(of(s), NEITHER), `${s} neither`).toEqual(table[s].neither)
    }
  })

  it('a published campaign with no draft: the approver may disable it, the author has no draft to ask for', () => {
    expect(actionsFor(of(null, 'Published'), APPROVER)).toEqual(['disable'])
    expect(actionsFor(of(null, 'Published'), AUTHOR)).toEqual([])
    expect(actionsFor(of(null, 'Disabled'), BOTH)).toEqual([])
  })

  it('an author is never offered Activate, Send back or Disable, in any state', () => {
    for (const s of STATES)
      for (const st of STATUSES) {
        const acts = actionsFor(of(s, st), AUTHOR)
        expect(acts).not.toContain('activate')
        expect(acts).not.toContain('sendBack')
        expect(acts).not.toContain('disable')
      }
  })

  it('an approver is never offered Ask for approval or Delete draft', () => {
    for (const s of STATES)
      for (const st of STATUSES) {
        const acts = actionsFor(of(s, st), APPROVER)
        expect(acts).not.toContain('askForApproval')
        expect(acts).not.toContain('deleteDraft')
      }
  })

  it('the draft of a live campaign may be deleted: the live campaign stays live (Drafts/Delete)', () => {
    expect(actionsFor(of('editing', 'Published'), AUTHOR)).toEqual(['askForApproval', 'deleteDraft'])
  })

  it('changes waiting over a live version are activated or sent back, never disabled from there', () => {
    expect(actionsFor(of('pending', 'Published'), APPROVER)).toEqual(['activate', 'sendBack'])
  })
})

describe('draftGate', () => {
  it('no rule holds the draft back before anything HQ says', () => {
    expect(draftGate(0, { failed: false, blocked: false })).toBe('noRules')
    expect(draftGate(0, { failed: true, blocked: null })).toBe('noRules')
  })

  it('then the checks: unreadable, not read yet, an error — or nothing', () => {
    expect(draftGate(1, { failed: true, blocked: null })).toBe('unavailable')
    expect(draftGate(1, { failed: false, blocked: null })).toBe('checking')
    expect(draftGate(1, { failed: false, blocked: true })).toBe('errors')
    expect(draftGate(2, { failed: false, blocked: false })).toBeNull()
  })
})

describe('actionGate', () => {
  it('Ask for approval and Activate wait for the checks, and an error blocks them', () => {
    for (const a of ['askForApproval', 'activate'] as const) {
      expect(actionGate(a, null)).toBeNull()
      expect(actionGate(a, 'errors')).toBe('errors')
      expect(actionGate(a, 'checking')).toBe('checking')
      expect(actionGate(a, 'unavailable')).toBe('unavailable')
    }
  })

  it('the other acts never depend on the rules', () => {
    for (const a of ['sendBack', 'disable', 'deleteDraft'] as const) expect(actionGate(a, 'errors')).toBeNull()
  })
})

const draft = (o: Partial<RuleCampaign> = {}) =>
  ({
    name: { en: 'Spring skincare', ar: 'العناية بالبشرة' },
    rules: [{ id: 'r1' }],
    window: { from: '2026-10-19' },
    budgets: [{ id: 'b1' }],
    ...o,
  }) as RuleCampaign

const ticks = (steps: { key: string; done: boolean }[]) => Object.fromEntries(steps.map((s) => [s.key, s.done]))

describe('preActivationSteps_tickFromTheDraft', () => {
  it('a complete draft with clean checks ticks every step, in order, each pointing at its page', () => {
    const steps = preActivationSteps(draft(), false)
    expect(steps.map((s) => [s.key, s.done, s.page])).toEqual([
      ['named', true, 'settings/details'],
      ['rules', true, 'rules'],
      ['schedule', true, 'settings/schedule'],
      ['budgets', true, 'settings/budgets'],
    ])
  })

  it('named wants BOTH languages, and blank is not a name', () => {
    expect(ticks(preActivationSteps(draft({ name: { en: 'Spring', ar: '' } }), false)).named).toBe(false)
    expect(ticks(preActivationSteps(draft({ name: { en: '  ', ar: 'ربيع' } }), false)).named).toBe(false)
  })

  it('rules tick only with a rule AND checks that hold no error', () => {
    expect(ticks(preActivationSteps(draft({ rules: [] }), false)).rules).toBe(false)
    expect(ticks(preActivationSteps(draft(), true)).rules).toBe(false)
    // Not read yet, or could not be read: not ticked.
    expect(ticks(preActivationSteps(draft(), null)).rules).toBe(false)
  })

  it('a schedule is set by either bound; none is not set', () => {
    expect(ticks(preActivationSteps(draft({ window: { until: '2026-12-31' } }), false)).schedule).toBe(true)
    expect(ticks(preActivationSteps(draft({ window: {} }), false)).schedule).toBe(false)
    expect(ticks(preActivationSteps(draft({ window: undefined }), false)).schedule).toBe(false)
  })

  it('budgets are considered once one exists', () => {
    expect(ticks(preActivationSteps(draft({ budgets: [] }), false)).budgets).toBe(false)
  })

  it('the steps show until the campaign is first published', () => {
    expect(showsSteps({ publishedVersionNo: 0, campaignStatus: '' })).toBe(true)
    expect(showsSteps({ publishedVersionNo: 1, campaignStatus: 'Published' })).toBe(false)
    expect(showsSteps({ publishedVersionNo: 2, campaignStatus: 'Disabled' })).toBe(false)
  })
})

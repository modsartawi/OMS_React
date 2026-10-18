import { describe, expect, it } from 'vitest'
import type { RuleCampaign, RuleCampaignStatus, RuleDraft, RuleDraftState } from '@/core/models/rule-campaign'
import { actionGate, actionsFor, approvalRefusal, dialogBodyKey, draftGate, grantOf, noteReady, preActivationSteps, showsSteps, type ApprovalAction } from './approval'

type Life = Pick<RuleDraft, 'source' | 'state' | 'campaignStatus'>
/** A loaded draft: `state` null = Load answered the newest version (no draft). */
const of = (state: RuleDraftState | null, campaignStatus: RuleCampaignStatus = ''): Life => ({
  source: state === null ? 'published' : 'draft',
  state: state ?? 'editing',
  campaignStatus,
})

describe('actionsFor_followsTheState', () => {
  it('every draft state, never published: an editing or sent-back draft is asked for or deleted; a pending one waits for an approver', () => {
    expect(actionsFor(of('editing'))).toEqual(['askForApproval', 'deleteDraft'])
    expect(actionsFor(of('sentBack'))).toEqual(['askForApproval', 'deleteDraft'])
    expect(actionsFor(of('pending'))).toEqual(['activate', 'sendBack'])
  })

  it('a published campaign with no draft may be disabled; a disabled one with no draft offers nothing', () => {
    expect(actionsFor(of(null, 'Published'))).toEqual(['disable'])
    expect(actionsFor(of(null, 'Disabled'))).toEqual([])
  })

  it('the draft of a live campaign may be asked for, deleted (the live campaign stays live) or the campaign disabled', () => {
    expect(actionsFor(of('editing', 'Published'))).toEqual(['askForApproval', 'disable', 'deleteDraft'])
  })

  it('changes waiting over a live version are activated or sent back, never disabled from there', () => {
    expect(actionsFor(of('pending', 'Published'))).toEqual(['activate', 'sendBack'])
  })

  it('a draft state this client does not know offers nothing of the draft', () => {
    expect(actionsFor(of('archived' as RuleDraftState))).toEqual([])
  })
})

describe('the approval notes', () => {
  it('asking, sending back and disabling need a note; activating may have one; deleting takes none', () => {
    for (const a of ['askForApproval', 'sendBack', 'disable'] as ApprovalAction[]) {
      expect(noteReady(a, ''), a).toBe(false)
      expect(noteReady(a, '   '), a).toBe(false)
      expect(noteReady(a, 'Ready'), a).toBe(true)
    }
    expect(noteReady('activate', '')).toBe(true)
    expect(noteReady('deleteDraft', '')).toBe(true)
  })
})

describe('dialogBodyKey', () => {
  it('Delete draft says what it leaves: a live campaign live, a disabled one gone from the list, a new one nothing', () => {
    expect(dialogBodyKey('deleteDraft', 'Published')).toBe('bodyLive')
    expect(dialogBodyKey('deleteDraft', 'Disabled')).toBe('bodyDisabled')
    expect(dialogBodyKey('deleteDraft', '')).toBe('body')
    expect(dialogBodyKey('disable', 'Published')).toBe('body')
  })
})

describe('approval_branchesOnRefusalCode', () => {
  it('a bare 403 is a missing grant: the author’s for asking and deleting, the approver’s for the rest', () => {
    expect(approvalRefusal('activate', null, true)).toEqual({ reason: 'denied', offer: null })
    expect(grantOf('askForApproval')).toBe('author')
    expect(grantOf('deleteDraft')).toBe('author')
    for (const a of ['activate', 'sendBack', 'disable'] as ApprovalAction[]) expect(grantOf(a)).toBe('approver')
  })

  it('RULES_SELF_APPROVAL: another approver activates — nothing to offer', () => {
    expect(approvalRefusal('activate', 'RULES_SELF_APPROVAL', false)).toEqual({ reason: 'selfApproval', offer: null })
  })

  it('RULES_NOT_PENDING and RULES_NOT_LIVE: the campaign moved since it was read — read it again', () => {
    expect(approvalRefusal('activate', 'RULES_NOT_PENDING', false)).toEqual({ reason: 'notPending', offer: 'reload' })
    expect(approvalRefusal('sendBack', 'RULES_NOT_PENDING', false)).toEqual({ reason: 'notPending', offer: 'reload' })
    expect(approvalRefusal('disable', 'RULES_NOT_LIVE', false)).toEqual({ reason: 'notLive', offer: 'reload' })
  })

  it('RULES_ORDER_STALE at Activate: the draft stays pending and is sent back', () => {
    expect(approvalRefusal('activate', 'RULES_ORDER_STALE', false)).toEqual({ reason: 'orderStale', offer: 'sendBack' })
  })

  it('RULES_INVALID_CAMPAIGN: at Activate the live ruleset moved under it (send it back); at the ask, fix the draft', () => {
    expect(approvalRefusal('activate', 'RULES_INVALID_CAMPAIGN', false)).toEqual({ reason: 'invalidCampaign', offer: 'sendBack' })
    expect(approvalRefusal('askForApproval', 'RULES_INVALID_CAMPAIGN', false)).toEqual({ reason: 'invalidCampaign', offer: null })
  })

  it('a stale or frozen draft is read again; a missing note is said', () => {
    expect(approvalRefusal('askForApproval', 'RULES_DRAFT_STALE', false)).toEqual({ reason: 'draftStale', offer: 'reload' })
    expect(approvalRefusal('askForApproval', 'RULES_DRAFT_PENDING', false)).toEqual({ reason: 'draftPending', offer: 'reload' })
    expect(approvalRefusal('sendBack', 'RULES_REASON_REQUIRED', false)).toEqual({ reason: 'reasonRequired', offer: null })
  })

  it('a code the dashboard has no words for is shown as HQ said it', () => {
    expect(approvalRefusal('activate', 'RULES_SOMETHING_NEW', false)).toBeNull()
    expect(approvalRefusal('activate', null, false)).toBeNull()
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

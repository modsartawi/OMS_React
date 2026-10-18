import { describe, expect, it } from 'vitest'
import type { RuleCampaign } from '@/core/models/rule-campaign'
import type { RuleUploadCampaignItem, RuleUploadSummary } from '@/core/models/rule-upload'
import {
  campaignChanges,
  compareCampaign,
  sameJson,
  stateFilterFromParams,
  stateFilterToParams,
  uploadListFilter,
  uploadRefusalView,
} from './review'

const json = (value: unknown) => value as RuleCampaign
const item = (campaign: unknown, live: unknown, id = 'D-OF1'): RuleUploadCampaignItem => ({
  id,
  competes: true,
  campaign: campaign === null ? null : json(campaign),
  live: live === null ? null : json(live),
})

describe('compareCampaign', () => {
  const uploaded = { schema: 1, id: 'D-OF1', name: { en: 'Sun', ar: 'شمس' }, rules: [{ id: 'r1', mechanic: 'percentOff' }] }

  it('is new when nothing of that id is live', () => {
    expect(compareCampaign(item(uploaded, null))).toBe('new')
  })

  it('is unchanged when the JSON is equal, whatever order its keys come in', () => {
    const reordered = { rules: [{ mechanic: 'percentOff', id: 'r1' }], name: { ar: 'شمس', en: 'Sun' }, id: 'D-OF1', schema: 1 }
    expect(compareCampaign(item(uploaded, reordered))).toBe('unchanged')
  })

  it('is changed when a value differs', () => {
    expect(compareCampaign(item(uploaded, { ...uploaded, name: { en: 'Sun', ar: 'الشمس' } }))).toBe('changed')
  })

  it('is changed when an array is in another order: rules and items are ordered', () => {
    const two = { ...uploaded, rules: [{ id: 'r1' }, { id: 'r2' }] }
    expect(compareCampaign(item(two, { ...uploaded, rules: [{ id: 'r2' }, { id: 'r1' }] }))).toBe('changed')
  })

  it('is disabled on a disabling row: the upload no longer holds it', () => {
    expect(compareCampaign(item(null, uploaded))).toBe('disabled')
  })

  it('counts the campaigns by change', () => {
    expect(campaignChanges([item(uploaded, null), item(uploaded, uploaded), item(uploaded, { ...uploaded, schema: 2 }), item(uploaded, null)])).toEqual({
      new: 2,
      changed: 1,
      unchanged: 1,
    })
  })

  it('sameJson tells a missing key from a null one', () => {
    expect(sameJson({ a: 1 }, { a: 1, b: null })).toBe(false)
    expect(sameJson({ a: [1, { b: 2, c: 3 }] }, { a: [1, { c: 3, b: 2 }] })).toBe(true)
  })
})

const summary = (dealCode: string, state: string): RuleUploadSummary => ({
  dealCode,
  state,
  revision: 1,
  stacking: 'compete',
  note: '',
  fileName: `${dealCode}.xlsx`,
  uploadedBy: 'author',
  uploadedAt: '2026-10-18T10:00:00',
  campaignCount: 1,
  skuCount: 1,
  windowFrom: '2026-10-09T00:00:00',
  windowUntil: '2026-10-15T00:00:00',
  summary: null,
  reviewedBy: '',
  reviewedAt: '0001-01-01T00:00:00',
  reviewNote: '',
  versionNo: 0,
})

describe('uploadListFilter', () => {
  // HQ's order: newest upload first.
  const rows = [summary('D4', 'pending'), summary('D3', 'archived'), summary('D2', 'activated'), summary('D1', 'pending'), summary('D0', 'sentBack')]

  it('defaults to pending, in the URL and in the rows', () => {
    expect(stateFilterFromParams(new URLSearchParams())).toBe('pending')
    expect(stateFilterToParams('pending').toString()).toBe('')
    expect(uploadListFilter(rows, 'pending').map((r) => r.dealCode)).toEqual(['D4', 'D1'])
  })

  it('reads every listed state and "all" from the URL; anything else is the default', () => {
    expect(stateFilterFromParams(new URLSearchParams('state=sentBack'))).toBe('sentBack')
    expect(stateFilterFromParams(new URLSearchParams('state=activated'))).toBe('activated')
    expect(stateFilterFromParams(new URLSearchParams('state=all'))).toBe('all')
    expect(stateFilterFromParams(new URLSearchParams('state=nonsense'))).toBe('pending')
    expect(stateFilterToParams('all').toString()).toBe('state=all')
    expect(stateFilterToParams('sentBack').toString()).toBe('state=sentBack')
  })

  it('lists an unlisted state under "all", and keeps the newest upload first', () => {
    expect(uploadListFilter(rows, 'all').map((r) => r.dealCode)).toEqual(['D4', 'D3', 'D2', 'D1', 'D0'])
    expect(uploadListFilter(rows, 'activated').map((r) => r.dealCode)).toEqual(['D2'])
  })
})

describe('uploadRefusalView', () => {
  const refused = (code: string | null, details: string[] = [], bareDenial = false) => ({ code, bareDenial, details })

  it('a bare 403 is the missing grant, with no next step', () => {
    expect(uploadRefusalView('activate', refused(null, [], true))).toEqual({ reason: 'denied', next: null, details: [] })
  })

  it.each([
    ['RULES_SELF_APPROVAL', 'selfApproval', null],
    ['RULES_UPLOAD_STALE', 'uploadStale', 'reload'],
    ['RULES_NOT_PENDING', 'notPending', 'reload'],
    ['RULES_ORDER_STALE', 'orderStale', 'sendBack'],
    ['RULES_INVALID_CAMPAIGN', 'invalidCampaign', 'sendBack'],
    ['RULES_REASON_REQUIRED', 'reasonRequired', null],
    ['RULES_UPLOAD_NOT_FOUND', 'notFound', 'list'],
    ['RULES_BAD_REQUEST', 'badRequest', null],
  ] as const)('%s at Activate → %s, next step %s', (code, reason, next) => {
    expect(uploadRefusalView('activate', refused(code))).toMatchObject({ reason, next })
  })

  it('never names Send back as the next step inside a Send back', () => {
    expect(uploadRefusalView('sendBack', refused('RULES_ORDER_STALE')).next).toBeNull()
    expect(uploadRefusalView('sendBack', refused('RULES_INVALID_CAMPAIGN')).next).toBeNull()
    expect(uploadRefusalView('sendBack', refused('RULES_UPLOAD_STALE')).next).toBe('reload')
  })

  it('carries the details through, one line each', () => {
    const lines = ['D-OF1: rules[0]: the Value is missing (rules[0].effects[0].value)', 'D-OF2: an id differs only in case from a live one']
    expect(uploadRefusalView('activate', refused('RULES_INVALID_CAMPAIGN', lines)).details).toEqual(lines)
  })

  it('is unknown for a code it has no words for, and still carries the details', () => {
    expect(uploadRefusalView('activate', refused('RULES_SOMETHING_NEW', ['a line']))).toEqual({ reason: null, next: null, details: ['a line'] })
  })
})

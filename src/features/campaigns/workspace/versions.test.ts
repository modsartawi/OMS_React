import { describe, expect, it } from 'vitest'
import type { RuleCampaignStatus, RuleDraft, RuleDraftState, RuleVersionSummary } from '@/core/models/rule-campaign'
import { holdsCampaign, newestFirst, restoreGuard, restoreHeld, restoreRevision, versionMark } from './versions'

type Life = Pick<RuleDraft, 'source' | 'state' | 'campaignStatus' | 'publishedVersionNo'>
/** A loaded draft: `state` null = Load answered the newest version (no draft). */
const of = (state: RuleDraftState | null, campaignStatus: RuleCampaignStatus = 'Published', publishedVersionNo = 3): Life => ({
  source: state === null ? 'published' : 'draft',
  state: state ?? 'editing',
  campaignStatus,
  publishedVersionNo,
})
const v = (versionNo: number, action: RuleVersionSummary['action'] = 'publish'): RuleVersionSummary => ({
  versionNo,
  campaign: 'WKND20',
  action,
  schemaVersion: 1,
  publishedAt: '2026-10-03T10:00:00',
  publishedBy: 'Reem (approver)',
  requestedBy: 'Omar (marketing)',
  note: '',
})

describe('restoreGuard_asksWhenTheDraftMayHoldWork', () => {
  it('a draft holds work not published yet — a sent-back request, or changes over the live version — so restoring asks first', () => {
    expect(restoreGuard(of('editing'))).toBe('ask')
    expect(restoreGuard(of('sentBack'))).toBe('ask')
  })

  it('a live campaign with no draft (Load answered `source: published`) restores at once: it replaces nothing', () => {
    expect(restoreGuard(of(null))).toBe('now')
  })

  it('a disabled campaign’s draft asks too: activating a restored draft brings it back (2759)', () => {
    expect(restoreGuard(of('editing', 'Disabled'))).toBe('ask')
  })

  it('a pending draft is held: it is frozen until it is sent back (RULES_DRAFT_PENDING)', () => {
    expect(restoreGuard(of('pending'))).toBe('waiting')
  })

  it('a draft state this client does not know is held as waiting — never restored blind', () => {
    expect(restoreGuard(of('archived' as RuleDraftState))).toBe('waiting')
  })

  it('restoreHeld says why for the whole campaign, so the page can say so', () => {
    expect(restoreHeld(of('pending'))).toBe('waiting')
    for (const s of ['editing', 'sentBack', null] as (RuleDraftState | null)[]) expect(restoreHeld(of(s)), String(s)).toBeNull()
  })

  it('the restore is sent at the draft’s revision, or 0 without a draft', () => {
    expect(restoreRevision({ source: 'draft', revision: 7 })).toBe(7)
    expect(restoreRevision({ source: 'published', revision: 0 })).toBe(0)
  })
})

describe('versionMark_marksTheLiveOne', () => {
  it('the live version is marked live while tills run it — over a draft or a waiting request too', () => {
    for (const s of [null, 'editing', 'pending'] as (RuleDraftState | null)[]) {
      expect(versionMark(of(s), v(3)), String(s)).toBe('live')
      expect(versionMark(of(s), v(2)), String(s)).toBeNull()
    }
  })

  it('a disabled campaign’s last published version is marked as such, never live; the disable itself is not', () => {
    expect(versionMark(of('editing', 'Disabled'), v(3))).toBe('disabled')
    expect(versionMark(of('editing', 'Disabled', 3), v(4, 'disable'))).toBeNull()
  })

  it('a campaign never published marks nothing', () => {
    expect(versionMark(of('editing', '', 0), v(1))).toBeNull()
  })

  it('a disable version holds nothing of the campaign to read or restore', () => {
    expect(holdsCampaign(v(4, 'disable'))).toBe(false)
    expect(holdsCampaign(v(3))).toBe(true)
  })
})

describe('newestFirst', () => {
  it('orders by version number, newest first, whatever order HQ answers in', () => {
    expect(newestFirst([v(1), v(3), v(2)]).map((x) => x.versionNo)).toEqual([3, 2, 1])
  })

  it('leaves its input alone', () => {
    const list = [v(1), v(2)]
    newestFirst(list)
    expect(list.map((x) => x.versionNo)).toEqual([1, 2])
  })
})

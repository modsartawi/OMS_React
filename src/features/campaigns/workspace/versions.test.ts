import { describe, expect, it } from 'vitest'
import type { RuleCampaignStatus, RuleCampaignVersion, RuleDraft, RuleDraftState } from '@/core/models/rule-campaign'
import { newestFirst, restoreGuard, restoreHeld, versionMark } from './versions'

type Life = Pick<RuleDraft, 'source' | 'state' | 'campaignStatus' | 'publishedVersionNo'>
/** A loaded draft: `state` null = Load answered the newest version (no draft). */
const of = (state: RuleDraftState | null, campaignStatus: RuleCampaignStatus = 'Published', publishedVersionNo = 3): Life => ({
  source: state === null ? 'published' : 'draft',
  state: state ?? 'editing',
  campaignStatus,
  publishedVersionNo,
})
const v = (version: number): RuleCampaignVersion => ({ version, at: `2026-10-0${version}T10:00:00`, by: 'Omar (marketing)', note: '' })

describe('restoreGuard_asksWhenTheDraftMayHoldWork', () => {
  it('a draft holds work not published yet — a sent-back request, or changes over the live version — so restoring asks first', () => {
    expect(restoreGuard(of('editing'))).toBe('ask')
    expect(restoreGuard(of('sentBack'))).toBe('ask')
  })

  it('a live campaign asks too: there is still no draft-changed flag (512 stands)', () => {
    expect(restoreGuard(of(null))).toBe('ask')
  })

  it('a disabled campaign is held: the approval life has no way back from disabled', () => {
    expect(restoreGuard(of(null, 'Disabled'))).toBe('disabled')
  })

  it('a pending draft is held: it is frozen until it is sent back (RULES_DRAFT_PENDING)', () => {
    expect(restoreGuard(of('pending'))).toBe('waiting')
  })

  it('a draft state this client does not know is held as waiting — never restored blind', () => {
    expect(restoreGuard(of('archived' as RuleDraftState))).toBe('waiting')
  })

  it('restoreHeld says why for the whole campaign, so the page can say so', () => {
    expect(restoreHeld(of('pending'))).toBe('waiting')
    expect(restoreHeld(of(null, 'Disabled'))).toBe('disabled')
    for (const s of ['editing', 'sentBack', null] as (RuleDraftState | null)[]) expect(restoreHeld(of(s)), String(s)).toBeNull()
  })
})

describe('versionMark_marksTheLiveOne', () => {
  it('the live version is marked live while tills run it — over a draft or a waiting request too', () => {
    for (const s of [null, 'editing', 'pending'] as (RuleDraftState | null)[]) {
      expect(versionMark(of(s), 3), String(s)).toBe('live')
      expect(versionMark(of(s), 2), String(s)).toBeNull()
    }
  })

  it('a disabled campaign’s last version is marked as such, never live', () => {
    expect(versionMark(of(null, 'Disabled'), 3)).toBe('disabled')
  })

  it('a campaign never published marks nothing', () => {
    expect(versionMark(of('editing', '', 0), 1)).toBeNull()
  })
})

describe('newestFirst', () => {
  it('orders by version number, newest first, whatever order HQ answers in', () => {
    expect(newestFirst([v(1), v(3), v(2)]).map((x) => x.version)).toEqual([3, 2, 1])
  })

  it('leaves its input alone', () => {
    const list = [v(1), v(2)]
    newestFirst(list)
    expect(list.map((x) => x.version)).toEqual([1, 2])
  })
})

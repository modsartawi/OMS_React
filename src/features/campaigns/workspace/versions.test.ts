import { describe, expect, it } from 'vitest'
import type { RuleCampaign, RuleCampaignStatus, RuleCampaignVersion } from '@/core/models/rule-campaign'
import { newestFirst, restoreGuard, restoreHeld, versionMark } from './versions'

const LIVE3 = { version: 3, at: '2026-10-10T15:00:00', by: 'Omar (marketing)' }
const of = (status: RuleCampaignStatus, live: RuleCampaign['live'] = LIVE3) => ({ status, live })
const v = (version: number): RuleCampaignVersion => ({ version, at: `2026-10-0${version}T10:00:00`, by: 'Omar (marketing)', note: '' })

describe('restoreGuard_asksWhenTheDraftMayHoldWork', () => {
  it('a draft holds work not published yet — a sent-back request, or changes over the live version — so restoring asks first', () => {
    expect(restoreGuard(of('draft'))).toBe('ask')
  })

  it('a live campaign asks too: saving rule edits keeps it live, so its draft may hold work the status does not show (512 review)', () => {
    expect(restoreGuard(of('live'))).toBe('ask')
  })

  it('a disabled campaign is held: the approval life has no way back from disabled', () => {
    expect(restoreGuard(of('disabled'))).toBe('disabled')
  })

  it('a campaign waiting for approval is held: the request is sent back before its draft changes', () => {
    expect(restoreGuard(of('waitingForApproval'))).toBe('waiting')
  })

  it('a status this client does not know is held as waiting — never restored blind', () => {
    expect(restoreGuard(of('archived' as RuleCampaignStatus))).toBe('waiting')
  })

  it('restoreHeld says why for the whole campaign, so the page can say so', () => {
    expect(restoreHeld(of('waitingForApproval'))).toBe('waiting')
    expect(restoreHeld(of('archived' as RuleCampaignStatus))).toBe('waiting')
    expect(restoreHeld(of('disabled'))).toBe('disabled')
    for (const s of ['draft', 'live'] as RuleCampaignStatus[]) expect(restoreHeld(of(s)), s).toBeNull()
  })
})

describe('versionMark_marksTheLiveOne', () => {
  it('the live version is marked live while tills run it — over a draft or a waiting request too', () => {
    for (const s of ['live', 'draft', 'waitingForApproval'] as RuleCampaignStatus[]) {
      expect(versionMark(of(s), 3), s).toBe('live')
      expect(versionMark(of(s), 2), s).toBeNull()
    }
  })

  it('a disabled campaign’s last version is marked as such, never live', () => {
    expect(versionMark(of('disabled'), 3)).toBe('disabled')
  })

  it('a campaign never published marks nothing', () => {
    expect(versionMark(of('draft', null), 1)).toBeNull()
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

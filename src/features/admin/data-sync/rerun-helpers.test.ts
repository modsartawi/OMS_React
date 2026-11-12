import { describe, expect, it } from 'vitest'
import type { Campaign, RerunOffer } from '@/core/models/data-sync'
import { buildCreateRequest } from './create-helpers'
import { rerunCodesForMode, rerunCount, rerunDraft } from './rerun-helpers'

const ORIGINAL = '01JB2C9X4E6F8G0H1J3K5M7N9P'
const PROFILE = ['dbo.Category', 'dbo.Product', 'dbo.PriceList', 'dbo.Supplier']

const offer = (over: Partial<RerunOffer> = {}): RerunOffer => ({
  campaignId: ORIGINAL,
  profileId: 'P1',
  mode: 'Apply',
  tables: ['dbo.Product', 'dbo.PriceList'],
  targets: [
    { client: '000', code: 'P003', failureReason: 'TableFailures', unfinishedTables: ['dbo.PriceList'] },
    { client: '000', code: 'P007', failureReason: 'StoreWpfHosted', unfinishedTables: ['dbo.Product', 'dbo.PriceList'] },
    { client: '000', code: 'P001', failureReason: 'Error', unfinishedTables: ['dbo.Product'] },
  ],
  excluded: [],
  ...over,
})

describe('rerunDraft', () => {
  it('keeps the union of the unfinished tables, locks the profile, starts in the original mode with an empty reason', () => {
    const d = rerunDraft(offer(), PROFILE)
    expect(d.profileId).toBe('P1')
    expect(d.pickedTables).toEqual(['dbo.Product', 'dbo.PriceList'])
    expect(d.mode).toBe('Apply')
    expect(d.reason).toBe('')
    expect(d.rerunOf).toBe(ORIGINAL)
  })

  it('leaves the WPF-hosted stores out of an Apply re-run and keeps them for a note', () => {
    const d = rerunDraft(offer(), PROFILE)
    expect(d.codes).toEqual(['P003', 'P001'])
    expect(d.wpfHosted).toEqual(['P007'])
  })

  it('keeps every store in a report-only re-run', () => {
    const d = rerunDraft(offer({ mode: 'ReportOnly' }), PROFILE)
    expect(d.mode).toBe('ReportOnly')
    expect(d.codes).toEqual(['P003', 'P007', 'P001'])
    expect(d.wpfHosted).toEqual(['P007'])
  })

  it('names the stores a live re-run holds in notes (865); the door already left them out of targets', () => {
    const RERUN = '01JE4F6G8H0J2K4M6N8P0Q2R4S'
    const excluded = [{ client: '000', code: 'P014', rerunCampaignId: RERUN }]
    const d = rerunDraft(offer({ mode: 'ReportOnly', excluded }), PROFILE)
    expect(d.codes).toEqual(['P003', 'P007', 'P001'])
    expect(d.excluded).toEqual(excluded)
  })

  it('never ticks a table beyond the profile', () => {
    const d = rerunDraft(offer({ tables: ['dbo.Product', 'dbo.Gone'] }), PROFILE)
    expect(d.pickedTables).toEqual(['dbo.Product'])
  })

  it('carries rerunOf onto the create request, with the stores and the narrowed tables', () => {
    const d = rerunDraft(offer(), PROFILE)
    const body = buildCreateRequest({
      profileId: d.profileId,
      profileTables: PROFILE,
      pickedTables: d.pickedTables,
      mode: 'Apply',
      targets: { kind: 'stores', codes: d.codes },
      name: '',
      reason: 'Fixed the PriceList key',
      rerunOf: d.rerunOf,
    })
    expect(body).toEqual({
      profileId: 'P1',
      mode: 'Apply',
      targets: { storeCodes: [{ code: 'P003' }, { code: 'P001' }] },
      tables: ['dbo.Product', 'dbo.PriceList'],
      reason: 'Fixed the PriceList key',
      rerunOf: ORIGINAL,
    })
  })
})

describe('rerunCodesForMode', () => {
  it('drops the WPF-hosted stores when the dialog is Apply, whatever their case', () => {
    expect(rerunCodesForMode(['P003', 'p007', 'P001'], ['P007'], 'Apply')).toEqual(['P003', 'P001'])
  })

  it('puts them back, after the others, when the dialog is (or falls back to) report only', () => {
    expect(rerunCodesForMode(['P003', 'P001'], ['P007', 'P009'], 'ReportOnly')).toEqual(['P003', 'P001', 'P007', 'P009'])
  })

  it('never doubles a WPF-hosted store already there, and keeps what the technician typed', () => {
    expect(rerunCodesForMode(['P003', 'p007', 'P042'], ['P007'], 'ReportOnly')).toEqual(['P003', 'p007', 'P042'])
  })

  it('round-trips: Apply then report only gives the stores back', () => {
    const start = ['P003', 'P007', 'P001']
    const back = rerunCodesForMode(rerunCodesForMode(start, ['P007'], 'Apply'), ['P007'], 'ReportOnly')
    expect(back).toEqual(['P003', 'P001', 'P007'])
  })
})

describe('rerunCount', () => {
  const campaign = (over: Partial<Campaign>): Campaign => ({ mode: 'ReportOnly', rerunnableJobs: 3, rerunnableWpfHostedJobs: 1, ...over }) as Campaign

  it('is the read model count in a report-only campaign', () => {
    expect(rerunCount(campaign({}))).toBe(3)
  })

  it('leaves the WPF-hosted stores out of an Apply campaign, as the dialog does', () => {
    expect(rerunCount(campaign({ mode: 'Apply' }))).toBe(2)
    // Every failure WPF-hosted: nothing an Apply re-run could take, so no button.
    expect(rerunCount(campaign({ mode: 'Apply', rerunnableJobs: 2, rerunnableWpfHostedJobs: 2 }))).toBe(0)
  })

  it('is zero without a campaign, or from a service that sends no count', () => {
    expect(rerunCount(undefined)).toBe(0)
    expect(rerunCount(campaign({ rerunnableJobs: undefined, rerunnableWpfHostedJobs: undefined }))).toBe(0)
    expect(rerunCount(campaign({ mode: 'Apply', rerunnableWpfHostedJobs: undefined }))).toBe(3)
  })
})

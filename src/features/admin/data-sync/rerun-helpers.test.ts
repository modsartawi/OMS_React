import { describe, expect, it } from 'vitest'
import type { RerunOffer } from '@/core/models/data-sync'
import { buildCreateRequest } from './create-helpers'
import { rerunCount, rerunDraft } from './rerun-helpers'

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

  it('leaves the WPF-hosted stores out of an Apply re-run and names them in a note', () => {
    const d = rerunDraft(offer(), PROFILE)
    expect(d.codes).toEqual(['P003', 'P001'])
    expect(d.leftOutWpf).toEqual(['P007'])
  })

  it('keeps every store in a report-only re-run', () => {
    const d = rerunDraft(offer({ mode: 'ReportOnly' }), PROFILE)
    expect(d.mode).toBe('ReportOnly')
    expect(d.codes).toEqual(['P003', 'P007', 'P001'])
    expect(d.leftOutWpf).toEqual([])
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

  it('counts the offer for the button, zero when there is nothing to re-run', () => {
    expect(rerunCount(offer())).toBe(3)
    expect(rerunCount(offer({ targets: [] }))).toBe(0)
    expect(rerunCount(undefined)).toBe(0)
  })
})

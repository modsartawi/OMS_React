import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/core/api'
import { dataSyncApi } from './api'
import {
  CREATE_REFUSAL_CODES,
  buildCreateRequest,
  createRefusalWords,
  parseStoreCodes,
  startRefusalWords,
  type CreateDraft,
} from './create-helpers'
import en from '@/locales/en/data-sync.json'

afterEach(() => vi.unstubAllGlobals())

const ALL = ['dbo.Product', 'dbo.PriceList', 'dbo.Customer']
const draft = (over: Partial<CreateDraft> = {}): CreateDraft => ({
  profileId: 'P1',
  profileTables: ALL,
  pickedTables: ALL,
  mode: 'ReportOnly',
  targets: { kind: 'fleet' },
  name: '',
  reason: '',
  ...over,
})

describe('buildCreateRequest', () => {
  it('sends a report-only run of the whole profile against the whole fleet, with no tables, name or reason', () => {
    expect(buildCreateRequest(draft())).toEqual({ profileId: 'P1', mode: 'ReportOnly', targets: { fleet: 'all' } })
  })

  it('sends the picked tables, in the profile order, only when some are left out', () => {
    const body = buildCreateRequest(draft({ pickedTables: ['dbo.Customer', 'dbo.Product'] }))
    expect(body.tables).toEqual(['dbo.Product', 'dbo.Customer'])
  })

  it('treats every table picked as the whole profile, whatever order they were ticked in', () => {
    expect('tables' in buildCreateRequest(draft({ pickedTables: ['dbo.Customer', 'dbo.Product', 'dbo.PriceList'] }))).toBe(false)
  })

  it('sends pasted stores by code alone (DataSync ask A: client omitted)', () => {
    const body = buildCreateRequest(draft({ targets: { kind: 'stores', codes: ['P001', 'P002'] } }))
    expect(body.targets).toEqual({ storeCodes: [{ code: 'P001' }, { code: 'P002' }] })
  })

  it('trims the name and drops a blank one', () => {
    expect(buildCreateRequest(draft({ name: '  Weekly drift check  ' })).name).toBe('Weekly drift check')
    expect('name' in buildCreateRequest(draft({ name: '   ' }))).toBe(false)
  })

  it('never sends a reason on a report-only run, even one typed', () => {
    expect('reason' in buildCreateRequest(draft({ reason: 'Because the store was reformatted' }))).toBe(false)
  })

  it('sends an Apply run with its reason trimmed (564 adds the mode to the dialog)', () => {
    const body = buildCreateRequest(draft({ mode: 'Apply', reason: '  Store reformatted on Monday  ' }))
    expect(body.mode).toBe('Apply')
    expect(body.reason).toBe('Store reformatted on Monday')
  })
})

describe('parseStoreCodes', () => {
  it('reads one code per line, and comma- or tab-separated codes on a line', () => {
    expect(parseStoreCodes('P001\nP002, P003\tP004\r\nP005').codes).toEqual(['P001', 'P002', 'P003', 'P004', 'P005'])
  })

  it('skips blank lines and empty pieces', () => {
    expect(parseStoreCodes('\n P001 ,, \n\n\tP002\t\n').codes).toEqual(['P001', 'P002'])
  })

  it('collapses duplicates (case-insensitively), keeps the first spelling, and counts them', () => {
    const parsed = parseStoreCodes('P001\np001, P002\nP001')
    expect(parsed.codes).toEqual(['P001', 'P002'])
    expect(parsed.duplicates).toBe(2)
  })

  it('reports a malformed code with its 1-based line, and keeps it out of the codes', () => {
    const parsed = parseStoreCodes('P001\nP 002, P003\nP#4\nTHISCODEISFARTOOLONGFORASTORE')
    expect(parsed.codes).toEqual(['P001', 'P003'])
    expect(parsed.malformed).toEqual([
      { line: 2, value: 'P 002' },
      { line: 3, value: 'P#4' },
      { line: 4, value: 'THISCODEISFARTOOLONGFORASTORE' },
    ])
  })

  it('reads an empty box as no codes and nothing wrong', () => {
    expect(parseStoreCodes('  \n ')).toEqual({ codes: [], malformed: [], duplicates: 0 })
  })
})

const refusal = (status: number, errorCode: string, errorMessage = '') =>
  new ApiError('business', 'summary', status, [{ errorCode, internalErrorCode: 'DS', errorMessage }])

describe('createRefusalWords', () => {
  it('maps every create code to a sentence key that exists', () => {
    const create = en.create.refusal as Record<string, string>
    for (const code of CREATE_REFUSAL_CODES) {
      const words = createRefusalWords(refusal(422, code, 'X1/P001 is not in DistributionLocation.'))
      expect(words?.key).toBe(`create.refusal.${code}`)
      expect(create[code]).toBeTruthy()
    }
    expect(CREATE_REFUSAL_CODES).toEqual(
      expect.arrayContaining([
        'DATASYNC_PROFILE_NOT_FOUND',
        'DATASYNC_TABLE_NOT_IN_PROFILE',
        'DATASYNC_UNKNOWN_STORE',
        'DATASYNC_SOURCE_UNAVAILABLE',
        'DATASYNC_INVALID_REQUEST',
      ]),
    )
  })

  it('names the unknown store from the detail', () => {
    expect(createRefusalWords(refusal(422, 'DATASYNC_UNKNOWN_STORE', '000/P009 is not in DistributionLocation.'))).toEqual({
      key: 'create.refusal.DATASYNC_UNKNOWN_STORE',
      store: '000/P009',
    })
  })

  it('names the table that is not in the profile', () => {
    expect(
      createRefusalWords(refusal(422, 'DATASYNC_TABLE_NOT_IN_PROFILE', "dbo.Ghost is not in profile 'Prices'; ask an admin to add it.")),
    ).toEqual({ key: 'create.refusal.DATASYNC_TABLE_NOT_IN_PROFILE', table: 'dbo.Ghost' })
  })

  it('has no words for a code it does not know, a bare denial or a crash', () => {
    expect(createRefusalWords(refusal(409, 'SOMETHING_NEW'))).toBeNull()
    expect(createRefusalWords(new ApiError('unknown', 'HTTP 403', 403))).toBeNull()
    expect(createRefusalWords(new Error('boom'))).toBeNull()
  })
})

describe('startRefusalWords', () => {
  it('words a Start refused because the campaign is no longer Ready, or gone', () => {
    expect(startRefusalWords(refusal(409, 'DATASYNC_INVALID_STATE'))).toBe('start.refusal.DATASYNC_INVALID_STATE')
    expect(startRefusalWords(refusal(404, 'DATASYNC_CAMPAIGN_NOT_FOUND'))).toBe('start.refusal.DATASYNC_CAMPAIGN_NOT_FOUND')
    expect((en.start.refusal as Record<string, string>).DATASYNC_INVALID_STATE).toBeTruthy()
    expect(startRefusalWords(refusal(409, 'OTHER'))).toBeNull()
  })
})

describe('the create and start writes', () => {
  const posted = async (call: () => Promise<unknown>, data: unknown) => {
    const fetch = vi.fn().mockResolvedValue({
      status: 201,
      ok: true,
      json: async () => ({ statusCode: 201, success: true, message: 'Campaign created.', errors: [], data }),
    } as unknown as Response)
    vi.stubGlobal('fetch', fetch)
    const answer = await call()
    const [url, init] = fetch.mock.calls[0] as [string, RequestInit]
    return { path: url.slice(url.indexOf('DataSync/')), method: init.method, body: JSON.parse(String(init.body)), answer }
  }

  it('posts the create body to DataSync/Campaigns and hands back the whole envelope (warnings ride in errors[])', async () => {
    const body = buildCreateRequest(draft())
    const r = await posted(() => dataSyncApi.createCampaign(body), { campaignId: 'C1' })
    expect(r.path).toBe('DataSync/Campaigns')
    expect(r.method).toBe('POST')
    expect(r.body).toEqual({ profileId: 'P1', mode: 'ReportOnly', targets: { fleet: 'all' } })
    expect(r.answer).toMatchObject({ data: { campaignId: 'C1' }, errors: [] })
  })

  it('posts Start to DataSync/Campaigns/{id}/Start', async () => {
    const r = await posted(() => dataSyncApi.startCampaign('C 1'), { campaignId: 'C 1' })
    expect(r.path).toBe('DataSync/Campaigns/C%201/Start')
    expect(r.method).toBe('POST')
  })
})

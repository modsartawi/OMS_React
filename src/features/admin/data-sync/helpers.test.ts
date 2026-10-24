import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/core/api'
import { CAMPAIGN_STATUSES, type DataSyncHealth } from '@/core/models/data-sync'
import { dataSyncApi } from './api'
import {
  campaignStatusBadge,
  campaignsFilterFromParams,
  campaignsFilterToParams,
  campaignsQuery,
  nextEnabledOnFullPage,
  serviceBanner,
  type CampaignsFilter,
} from './helpers'
import en from '@/locales/en/data-sync.json'

afterEach(() => vi.unstubAllGlobals())

describe('campaignStatusBadge', () => {
  it('maps every CampaignStatus to a label key that exists, and a severity', () => {
    for (const status of CAMPAIGN_STATUSES) {
      const badge = campaignStatusBadge(status)
      expect(badge.labelKey).toBe(`campaignStatus.${status}`)
      expect((en.campaignStatus as Record<string, string>)[status]).toBeTruthy()
      expect(['ok', 'go', 'warn', 'bad', 'mute']).toContain(badge.sev)
    }
  })

  it('reads in-flight as in motion, Paused as needing a human, Completed as done, Cancelled as ended badly', () => {
    expect(campaignStatusBadge('Running').sev).toBe('go')
    expect(campaignStatusBadge('Pausing').sev).toBe('go')
    expect(campaignStatusBadge('Cancelling').sev).toBe('go')
    expect(campaignStatusBadge('Paused').sev).toBe('warn')
    expect(campaignStatusBadge('Completed').sev).toBe('ok')
    expect(campaignStatusBadge('Cancelled').sev).toBe('bad')
    expect(campaignStatusBadge('Ready').sev).toBe('mute')
  })

  it('leaves an unknown status neutral and unlabelled, so the raw code shows', () => {
    expect(campaignStatusBadge('Archived')).toEqual({ labelKey: null, sev: 'mute' })
    expect(campaignStatusBadge('toString')).toEqual({ labelKey: null, sev: 'mute' })
  })
})

describe('campaignsQuery', () => {
  const urlFor = async (filter: CampaignsFilter): Promise<string> => {
    const fetch = vi.fn().mockResolvedValue({
      status: 200,
      ok: true,
      json: async () => ({ statusCode: 200, success: true, message: '', errors: [], data: [] }),
    } as unknown as Response)
    vi.stubGlobal('fetch', fetch)
    await dataSyncApi.campaigns(filter)
    const url = String(fetch.mock.calls[0][0])
    return url.slice(url.indexOf('DataSync/'))
  }

  it('asks for page 1 of 50 with no status when unfiltered', async () => {
    expect(await urlFor({ status: null, page: 1 })).toBe('DataSync/Campaigns?page=1&pageSize=50')
  })

  it('sends the status as its exact enum name, and the page asked for', async () => {
    expect(await urlFor({ status: 'Running', page: 3 })).toBe('DataSync/Campaigns?status=Running&page=3&pageSize=50')
  })

  it('builds the query object the door reads', () => {
    expect(campaignsQuery({ status: 'Paused', page: 2 })).toEqual({ status: 'Paused', page: 2, pageSize: 50 })
  })
})

describe('the campaigns filter in the URL', () => {
  it('reads a known status and a page, and defaults the rest', () => {
    expect(campaignsFilterFromParams(new URLSearchParams('status=Completed&page=4'))).toEqual({
      status: 'Completed',
      page: 4,
    })
    expect(campaignsFilterFromParams(new URLSearchParams(''))).toEqual({ status: null, page: 1 })
  })

  it('drops an unknown status (the door refuses one) and a page that is not a positive whole number', () => {
    expect(campaignsFilterFromParams(new URLSearchParams('status=running&page=0'))).toEqual({ status: null, page: 1 })
    expect(campaignsFilterFromParams(new URLSearchParams('status=toString&page=2.5'))).toEqual({ status: null, page: 1 })
  })

  it('writes only what differs from the default', () => {
    expect(campaignsFilterToParams({ status: null, page: 1 }).toString()).toBe('')
    expect(campaignsFilterToParams({ status: 'Running', page: 2 }).toString()).toBe('status=Running&page=2')
  })
})

describe('serviceBanner', () => {
  const NOW = Date.parse('2026-10-24T09:06:00Z')
  const healthy: DataSyncHealth = { stateDb: 'Ok', workerEnabled: true, lastWorkerTick: '2026-10-24T09:05:30Z' }

  it('shows nothing for a healthy service whose worker ticked within the minute', () => {
    expect(serviceBanner({ health: healthy, error: null }, NOW)).toBeNull()
  })

  it('shows nothing before the first answer', () => {
    expect(serviceBanner({ health: undefined, error: null }, NOW)).toBeNull()
  })

  it('names a worker that is turned off', () => {
    expect(serviceBanner({ health: { ...healthy, workerEnabled: false }, error: null }, NOW)).toEqual({
      kind: 'workerDisabled',
    })
  })

  it('names a worker whose last tick is over a minute old, with that tick', () => {
    const stale = { ...healthy, lastWorkerTick: '2026-10-24T09:04:59Z' }
    expect(serviceBanner({ health: stale, error: null }, NOW)).toEqual({
      kind: 'workerStale',
      lastTick: '2026-10-24T09:04:59Z',
    })
    // Exactly a minute is not yet stale.
    expect(serviceBanner({ health: { ...healthy, lastWorkerTick: '2026-10-24T09:05:00Z' }, error: null }, NOW)).toBeNull()
  })

  it('names an enabled worker that has never ticked', () => {
    expect(serviceBanner({ health: { ...healthy, lastWorkerTick: null }, error: null }, NOW)).toEqual({
      kind: 'workerStale',
      lastTick: null,
    })
  })

  it('reads a 503 from the Health door as the state DB unreachable', () => {
    const err = new ApiError('server', 'The state database is unreachable.', 503)
    expect(serviceBanner({ health: undefined, error: err }, NOW)).toEqual({ kind: 'stateDbUnreachable' })
    // …even while an older, healthy answer is still cached.
    expect(serviceBanner({ health: healthy, error: err }, NOW)).toEqual({ kind: 'stateDbUnreachable' })
  })

  it('reads a state DB reported Unreachable on a 200 the same way', () => {
    expect(serviceBanner({ health: { ...healthy, stateDb: 'Unreachable' }, error: null }, NOW)).toEqual({
      kind: 'stateDbUnreachable',
    })
  })

  it('does not guess from any other failure', () => {
    expect(serviceBanner({ health: undefined, error: new ApiError('network', 'offline', 0) }, NOW)).toBeNull()
    expect(serviceBanner({ health: undefined, error: new ApiError('server', 'boom', 500) }, NOW)).toBeNull()
  })
})

describe('nextEnabledOnFullPage', () => {
  it('enables Next only when the page came back full, since the door sends no total', () => {
    expect(nextEnabledOnFullPage(50, 50)).toBe(true)
    expect(nextEnabledOnFullPage(49, 50)).toBe(false)
    expect(nextEnabledOnFullPage(0, 50)).toBe(false)
  })
})

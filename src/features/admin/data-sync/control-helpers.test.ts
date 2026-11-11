import { afterEach, describe, expect, it, vi } from 'vitest'
import { CAMPAIGN_STATUSES, JOB_STATUSES } from '@/core/models/data-sync'
import { ApiError } from '@/core/api'
import { dataSyncApi } from './api'
import { campaignControls, controlBody, controlRefusalWords, controlTakesNote, isOperateDenied, jobControls } from './control-helpers'
import en from '@/locales/en/data-sync.json'

const word = (key: string): unknown => key.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown>)?.[k], en)

afterEach(() => vi.unstubAllGlobals())

describe('campaignControls', () => {
  // The legal moves, from DataSync's CampaignStateMachine (engine spec §2; wire.md §5). Start is 561's.
  const LEGAL: Record<string, string[]> = {
    Ready: ['Cancel'],
    Running: ['Pause', 'Cancel'],
    Pausing: ['Cancel'],
    Paused: ['Resume', 'Cancel'],
    Cancelling: [],
    Cancelled: [],
    Completed: [],
  }

  it('offers exactly the moves each status allows to an operator', () => {
    for (const s of CAMPAIGN_STATUSES) expect(campaignControls(s, true)).toEqual(LEGAL[s])
  })

  it('offers nothing without canOperate', () => {
    for (const s of CAMPAIGN_STATUSES) expect(campaignControls(s, false)).toEqual([])
  })

  it('offers nothing for a status this bundle does not know', () => {
    expect(campaignControls('Archived', true)).toEqual([])
    expect(campaignControls('toString', true)).toEqual([])
  })
})

describe('jobControls', () => {
  // DataSync's JobTransitions (operator moves). The campaign's status is NOT consulted:
  // a queued job may be paused while its campaign is still Ready.
  const LEGAL: Record<string, string[]> = {
    Queued: ['Pause', 'Cancel'],
    Running: ['Pause', 'Cancel'],
    Pausing: ['Cancel'],
    Paused: ['Resume', 'Cancel'],
    Cancelling: [],
    Succeeded: [],
    Failed: [],
    Cancelled: [],
  }

  it('offers exactly the moves each status allows to an operator', () => {
    for (const s of JOB_STATUSES) expect(jobControls(s, true)).toEqual(LEGAL[s])
  })

  it('offers nothing without canOperate', () => {
    for (const s of JOB_STATUSES) expect(jobControls(s, false)).toEqual([])
  })

  it('offers nothing for a status this bundle does not know', () => {
    expect(jobControls('Skipped', true)).toEqual([])
  })

  // Retry (ticket 866, engine spec §2.6): the server decides retryability (`Job.retryable` —
  // StoreUnreachable / TargetUnresolved, campaign not cancelling); the page only reads it.
  it('offers Retry exactly when the job is retryable and the user can operate', () => {
    expect(jobControls('Failed', true, true)).toEqual(['Retry'])
    expect(jobControls('Failed', true, false)).toEqual([])
    expect(jobControls('Failed', false, true)).toEqual([])
    expect(jobControls('Failed', true)).toEqual([])
  })

  it('never offers Retry on a status this bundle does not know, even if flagged', () => {
    expect(jobControls('Skipped', true, true)).toEqual([])
  })
})

describe('campaignControls — Retry N retryable', () => {
  it('adds Retry after the status moves exactly when retryableJobs > 0 and the user can operate', () => {
    expect(campaignControls('Completed', true, 3)).toEqual(['Retry'])
    expect(campaignControls('Running', true, 1)).toEqual(['Pause', 'Cancel', 'Retry'])
    expect(campaignControls('Paused', true, 30)).toEqual(['Resume', 'Cancel', 'Retry'])
    expect(campaignControls('Completed', true, 0)).toEqual([])
    expect(campaignControls('Running', true)).toEqual(['Pause', 'Cancel'])
    expect(campaignControls('Completed', false, 3)).toEqual([])
    expect(campaignControls('Running', false, 3)).toEqual([])
  })

  it('never offers Retry on a status this bundle does not know', () => {
    expect(campaignControls('Archived', true, 2)).toEqual([])
  })
})

describe('controlRefusalWords', () => {
  it('maps each control refusal code to its own sentence, which exists', () => {
    const keys = {
      DATASYNC_INVALID_STATE: 'controls.refusal.DATASYNC_INVALID_STATE',
      DATASYNC_STORE_BUSY: 'controls.refusal.DATASYNC_STORE_BUSY',
      DATASYNC_STORE_WPF_HOSTED: 'controls.refusal.DATASYNC_STORE_WPF_HOSTED',
      DATASYNC_CAMPAIGN_NOT_FOUND: 'controls.refusal.DATASYNC_CAMPAIGN_NOT_FOUND',
      DATASYNC_JOB_NOT_FOUND: 'controls.refusal.DATASYNC_JOB_NOT_FOUND',
    }
    for (const [code, key] of Object.entries(keys)) {
      expect(controlRefusalWords(code)).toBe(key)
      expect(typeof word(key)).toBe('string')
    }
    // Three different sentences: busy says pause ActionSync, WPF says never.
    expect(word(keys.DATASYNC_STORE_BUSY)).toMatch(/ActionSync/)
    expect(word(keys.DATASYNC_STORE_WPF_HOSTED)).toMatch(/never/)
  })

  it('has no words for a code it does not handle, or none', () => {
    expect(controlRefusalWords('DATASYNC_REASON_REQUIRED')).toBeNull()
    expect(controlRefusalWords('toString')).toBeNull()
    expect(controlRefusalWords(null)).toBeNull()
  })
})

describe('controlRefusalWords — Retry (ticket 866)', () => {
  it('maps the Retry refusals to their own Retry sentences, which exist', () => {
    const keys = {
      DATASYNC_INVALID_STATE: 'controls.retryRefusal.DATASYNC_INVALID_STATE',
      DATASYNC_STORE_BUSY: 'controls.retryRefusal.DATASYNC_STORE_BUSY',
      DATASYNC_STORE_WPF_HOSTED: 'controls.retryRefusal.DATASYNC_STORE_WPF_HOSTED',
    }
    for (const [code, key] of Object.entries(keys)) {
      expect(controlRefusalWords(code, 'Retry')).toBe(key)
      expect(typeof word(key)).toBe('string')
    }
    // Nothing retryable any more, or the campaign is cancelling / cancelled.
    expect(word(keys.DATASYNC_INVALID_STATE)).toMatch(/retr/i)
    expect(word(keys.DATASYNC_INVALID_STATE)).toMatch(/cancel/i)
    // Busy: pause ActionSync for the store first, then retry — not "resume".
    expect(word(keys.DATASYNC_STORE_BUSY)).toMatch(/Pause the store on ActionSync first/)
    expect(word(keys.DATASYNC_STORE_BUSY)).toMatch(/retry/i)
    expect(word(keys.DATASYNC_STORE_WPF_HOSTED)).toMatch(/never/)
  })

  it('keeps the shared sentences for the not-founds, and the control sentences for the other moves', () => {
    expect(controlRefusalWords('DATASYNC_JOB_NOT_FOUND', 'Retry')).toBe('controls.refusal.DATASYNC_JOB_NOT_FOUND')
    expect(controlRefusalWords('DATASYNC_CAMPAIGN_NOT_FOUND', 'Retry')).toBe('controls.refusal.DATASYNC_CAMPAIGN_NOT_FOUND')
    expect(controlRefusalWords('DATASYNC_STORE_BUSY', 'Resume')).toBe('controls.refusal.DATASYNC_STORE_BUSY')
    expect(controlRefusalWords('DATASYNC_REASON_REQUIRED', 'Retry')).toBeNull()
    expect(controlRefusalWords(null, 'Retry')).toBeNull()
  })
})

describe('isOperateDenied', () => {
  it('is a bare 403 only', () => {
    expect(isOperateDenied(new ApiError('unknown', 'Unexpected API error (HTTP 403)', 403))).toBe(true)
    const coded = new ApiError('business', 'Resume is not valid from status Running.', 409, [
      { errorCode: 'DATASYNC_INVALID_STATE', internalErrorCode: 'DS-0409-01', errorMessage: 'Campaign X is Running.' },
    ])
    expect(isOperateDenied(coded)).toBe(false)
    expect(isOperateDenied(new Error('boom'))).toBe(false)
  })
})

describe('controlBody', () => {
  it('takes a note on Pause and Cancel only', () => {
    expect(controlTakesNote('Pause')).toBe(true)
    expect(controlTakesNote('Cancel')).toBe(true)
    expect(controlTakesNote('Resume')).toBe(false)
  })

  it('takes a note on Retry (the last control note says why it was retried)', () => {
    expect(controlTakesNote('Retry')).toBe(true)
    expect(controlBody('Retry', '  link to P014 is back  ')).toEqual({ reason: 'link to P014 is back' })
    expect(controlBody('Retry', ' ')).toEqual({})
  })

  it('sends the note trimmed, and nothing for a blank note or a Resume', () => {
    expect(controlBody('Pause', '  store 0123 is reindexing  ')).toEqual({ reason: 'store 0123 is reindexing' })
    expect(controlBody('Cancel', '   ')).toEqual({})
    expect(controlBody('Cancel', '')).toEqual({})
    expect(controlBody('Resume', 'ignored')).toEqual({})
  })
})

describe('the control doors', () => {
  const sent = async (call: () => Promise<unknown>) => {
    const fetch = vi.fn().mockResolvedValue({
      status: 200,
      ok: true,
      json: async () => ({ statusCode: 200, success: true, message: '', errors: [], data: {} }),
    } as unknown as Response)
    vi.stubGlobal('fetch', fetch)
    await call()
    const url = String(fetch.mock.calls[0][0])
    const init = fetch.mock.calls[0][1] as RequestInit
    return { path: url.slice(url.indexOf('DataSync/')), method: init.method, body: JSON.parse(String(init.body)) }
  }

  it('posts a campaign control to Campaigns/{id}/{action} with the note', async () => {
    expect(await sent(() => dataSyncApi.controlCampaign('01JB2C9X4E6F8G0H1J3K5M7N9P', 'Pause', { reason: 'too slow' }))).toEqual({
      path: 'DataSync/Campaigns/01JB2C9X4E6F8G0H1J3K5M7N9P/Pause',
      method: 'POST',
      body: { reason: 'too slow' },
    })
    expect((await sent(() => dataSyncApi.controlCampaign('C1', 'Resume', {}))).path).toBe('DataSync/Campaigns/C1/Resume')
    expect((await sent(() => dataSyncApi.controlCampaign('C1', 'Cancel', {}))).path).toBe('DataSync/Campaigns/C1/Cancel')
  })

  it('posts a job control to Jobs/{id}/{action} with the note', async () => {
    expect(await sent(() => dataSyncApi.controlJob('01JB2CA2R4S6T8V0W1X3Y5Z7AB', 'Cancel', { reason: 'wrong store' }))).toEqual({
      path: 'DataSync/Jobs/01JB2CA2R4S6T8V0W1X3Y5Z7AB/Cancel',
      method: 'POST',
      body: { reason: 'wrong store' },
    })
    expect((await sent(() => dataSyncApi.controlJob('J1', 'Resume', {}))).body).toEqual({})
    expect((await sent(() => dataSyncApi.controlJob('J1', 'Pause', {}))).path).toBe('DataSync/Jobs/J1/Pause')
  })

  it('posts a Retry to Jobs/{id}/Retry and Campaigns/{id}/Retry with the note (ticket 866)', async () => {
    expect(await sent(() => dataSyncApi.controlJob('J1', 'Retry', { reason: 'link is back' }))).toEqual({
      path: 'DataSync/Jobs/J1/Retry',
      method: 'POST',
      body: { reason: 'link is back' },
    })
    expect(await sent(() => dataSyncApi.controlCampaign('C1', 'Retry', {}))).toEqual({
      path: 'DataSync/Campaigns/C1/Retry',
      method: 'POST',
      body: {},
    })
  })
})

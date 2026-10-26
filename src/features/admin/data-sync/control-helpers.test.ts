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

  it('adds Retry before Cancel only while the door counts retryable jobs', () => {
    expect(campaignControls('Running', true, 2)).toEqual(['Pause', 'Retry', 'Cancel'])
    expect(campaignControls('Paused', true, 1)).toEqual(['Resume', 'Retry', 'Cancel'])
    // A Completed campaign with retryable failures offers Retry alone (it goes back to Running).
    expect(campaignControls('Completed', true, 3)).toEqual(['Retry'])
    expect(campaignControls('Completed', true, 0)).toEqual([])
    expect(campaignControls('Running', true)).toEqual(['Pause', 'Cancel'])
  })

  it('offers no Retry without canOperate', () => {
    for (const s of CAMPAIGN_STATUSES) expect(campaignControls(s, false, 5)).toEqual([])
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

  it('offers Retry only when the door marks the job retryable', () => {
    expect(jobControls('Failed', true, true)).toEqual(['Retry'])
    expect(jobControls('Failed', true, false)).toEqual([])
    expect(jobControls('Failed', true)).toEqual([])
    // The flag is the door's: the page does not second-guess it against the status.
    expect(jobControls('Paused', true, true)).toEqual(['Resume', 'Retry', 'Cancel'])
  })

  it('offers no Retry without canOperate', () => {
    for (const s of JOB_STATUSES) expect(jobControls(s, false, true)).toEqual([])
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

  it('gives Retry its own sentence where the shared one would mislead, and the shared one otherwise', () => {
    for (const code of ['DATASYNC_INVALID_STATE', 'DATASYNC_STORE_BUSY', 'DATASYNC_STORE_WPF_HOSTED']) {
      const key = controlRefusalWords(code, 'Retry')
      expect(key).toBe(`controls.refusal.Retry.${code}`)
      expect(typeof word(key as string)).toBe('string')
    }
    expect(word('controls.refusal.Retry.DATASYNC_STORE_BUSY')).toMatch(/ActionSync/)
    expect(word('controls.refusal.Retry.DATASYNC_STORE_BUSY')).toMatch(/retry/)
    expect(controlRefusalWords('DATASYNC_JOB_NOT_FOUND', 'Retry')).toBe('controls.refusal.DATASYNC_JOB_NOT_FOUND')
    expect(controlRefusalWords('DATASYNC_CAMPAIGN_NOT_FOUND', 'Retry')).toBe('controls.refusal.DATASYNC_CAMPAIGN_NOT_FOUND')
    // Every other control keeps the shared words.
    expect(controlRefusalWords('DATASYNC_STORE_BUSY', 'Resume')).toBe('controls.refusal.DATASYNC_STORE_BUSY')
    expect(controlRefusalWords('DATASYNC_REASON_REQUIRED', 'Retry')).toBeNull()
  })

  it('has no words for a code it does not handle, or none', () => {
    expect(controlRefusalWords('DATASYNC_REASON_REQUIRED')).toBeNull()
    expect(controlRefusalWords('toString')).toBeNull()
    expect(controlRefusalWords(null)).toBeNull()
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
  it('takes a note on Pause, Cancel and Retry only', () => {
    expect(controlTakesNote('Pause')).toBe(true)
    expect(controlTakesNote('Cancel')).toBe(true)
    expect(controlTakesNote('Retry')).toBe(true)
    expect(controlTakesNote('Resume')).toBe(false)
  })

  it('sends the note trimmed, and nothing for a blank note or a Resume', () => {
    expect(controlBody('Pause', '  store 0123 is reindexing  ')).toEqual({ reason: 'store 0123 is reindexing' })
    expect(controlBody('Cancel', '   ')).toEqual({})
    expect(controlBody('Cancel', '')).toEqual({})
    expect(controlBody('Resume', 'ignored')).toEqual({})
    expect(controlBody('Retry', ' store back online ')).toEqual({ reason: 'store back online' })
    expect(controlBody('Retry', '')).toEqual({})
  })

  it('has every word a Retry control draws', () => {
    for (const key of [
      'controls.action.Retry',
      'controls.retryFailed_one',
      'controls.retryFailed_other',
      'controls.title.campaign.Retry',
      'controls.title.job.Retry',
      'controls.note.campaign.Retry',
      'controls.note.job.Retry',
      'controls.done.campaignRetry',
    ])
      expect(typeof word(key)).toBe('string')
    // The semantics the dialog must state: checkpoint, a fresh 3 attempts, the apply store's pause.
    for (const scope of ['campaign', 'job']) {
      const note = word(`controls.note.${scope}.Retry`) as string
      expect(note).toMatch(/checkpoint/)
      expect(note).toMatch(/3 automatic attempts/)
      expect(note).toMatch(/paused on ActionSync/)
    }
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
    expect(await sent(() => dataSyncApi.controlCampaign('C1', 'Retry', { reason: 'VPN back' }))).toEqual({
      path: 'DataSync/Campaigns/C1/Retry',
      method: 'POST',
      body: { reason: 'VPN back' },
    })
  })

  it('posts a job control to Jobs/{id}/{action} with the note', async () => {
    expect(await sent(() => dataSyncApi.controlJob('01JB2CA2R4S6T8V0W1X3Y5Z7AB', 'Cancel', { reason: 'wrong store' }))).toEqual({
      path: 'DataSync/Jobs/01JB2CA2R4S6T8V0W1X3Y5Z7AB/Cancel',
      method: 'POST',
      body: { reason: 'wrong store' },
    })
    expect((await sent(() => dataSyncApi.controlJob('J1', 'Resume', {}))).body).toEqual({})
    expect((await sent(() => dataSyncApi.controlJob('J1', 'Pause', {}))).path).toBe('DataSync/Jobs/J1/Pause')
    expect(await sent(() => dataSyncApi.controlJob('J1', 'Retry', {}))).toEqual({ path: 'DataSync/Jobs/J1/Retry', method: 'POST', body: {} })
  })
})

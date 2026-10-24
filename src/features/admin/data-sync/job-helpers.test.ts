import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/core/api'
import {
  HOLD_REASONS,
  JOB_FAILURE_REASONS,
  JOB_PHASES,
  JOB_STATUSES,
  TABLE_FAILURE_CODES,
  TABLE_TASK_STATUSES,
  WAIT_REASONS,
  type Campaign,
  type Job,
  type JobStatus,
  type TableTask,
} from '@/core/models/data-sync'
import { dataSyncApi } from './api'
import {
  CAMPAIGN_POLL_MS,
  campaignJobsFromParams,
  campaignJobsToParams,
  failureWords,
  isDataSyncNotFound,
  jobStateWords,
  pollInterval,
  storeLabel,
  tableProgress,
  tableTaskStatusBadge,
} from './job-helpers'
import en from '@/locales/en/data-sync.json'

afterEach(() => vi.unstubAllGlobals())

/** Reads a dotted key out of the English bundle — the key must exist and be a sentence. */
const word = (key: string): unknown => key.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown>)?.[k], en)

const SEVERITIES = ['ok', 'go', 'warn', 'bad', 'mute']

describe('jobStateWords', () => {
  it('maps every JobStatus × phase × wait reason × hold reason to a label that exists and a severity', () => {
    for (const status of JOB_STATUSES)
      for (const phase of [null, ...JOB_PHASES])
        for (const waitReason of [null, ...WAIT_REASONS])
          for (const holdReason of [null, ...HOLD_REASONS]) {
            const notBefore = waitReason === 'BackingOff' ? '2026-10-24T09:10:00Z' : null
            const w = jobStateWords({ status, phase, waitReason, holdReason, notBefore })
            expect(w.labelKey).toBe(`jobStatus.${status}`)
            expect(word(w.labelKey as string)).toBeTruthy()
            expect(SEVERITIES).toContain(w.sev)
            if (w.phaseKey) expect(word(w.phaseKey)).toBeTruthy()
            if (w.reasonKey) expect(word(w.reasonKey)).toBeTruthy()
          }
  })

  it('names the phase only while Running', () => {
    expect(jobStateWords({ status: 'Running', phase: 'Comparing', waitReason: null, holdReason: null, notBefore: null }).phaseKey).toBe(
      'jobPhase.Comparing',
    )
    expect(jobStateWords({ status: 'Succeeded', phase: 'Comparing', waitReason: null, holdReason: null, notBefore: null }).phaseKey).toBeNull()
  })

  it('says why a queued job waits, and BackingOff carries notBefore', () => {
    const pause = jobStateWords({ status: 'Queued', phase: null, waitReason: 'WaitingForPause', holdReason: null, notBefore: null })
    expect(pause).toMatchObject({ reasonKey: 'waitReason.WaitingForPause', sev: 'warn', notBefore: null })
    const back = jobStateWords({
      status: 'Queued',
      phase: null,
      waitReason: 'BackingOff',
      holdReason: null,
      notBefore: '2026-10-24T09:10:00Z',
    })
    expect(back).toMatchObject({ reasonKey: 'waitReason.BackingOff', sev: 'warn', notBefore: '2026-10-24T09:10:00Z' })
    // A BackingOff with no time still has a sentence (no "until").
    const noTime = jobStateWords({ status: 'Queued', phase: null, waitReason: 'BackingOff', holdReason: null, notBefore: null })
    expect(noTime.reasonKey).toBe('waitReason.BackingOffNoTime')
    // A plain queued job is waiting for a slot: neutral, nothing to say.
    expect(jobStateWords({ status: 'Queued', phase: null, waitReason: null, holdReason: null, notBefore: null })).toMatchObject({
      sev: 'mute',
      reasonKey: null,
    })
  })

  it('says who holds a paused job; a wait reason outside Queued is ignored', () => {
    expect(jobStateWords({ status: 'Paused', phase: null, waitReason: null, holdReason: 'Operator', notBefore: null })).toMatchObject({
      reasonKey: 'holdReason.Operator',
      sev: 'warn',
    })
    expect(jobStateWords({ status: 'Paused', phase: null, waitReason: null, holdReason: 'StoreBusy', notBefore: null }).reasonKey).toBe(
      'holdReason.StoreBusy',
    )
    expect(
      jobStateWords({ status: 'Running', phase: 'Reconciling', waitReason: 'BackingOff', holdReason: 'Operator', notBefore: 'x' }),
    ).toMatchObject({ reasonKey: null, notBefore: null, sev: 'go' })
  })

  it('reads ends: Succeeded done, Failed and Cancelled ended badly; in-flight in motion', () => {
    const sev = (status: JobStatus) => jobStateWords({ status, phase: null, waitReason: null, holdReason: null, notBefore: null }).sev
    expect(sev('Succeeded')).toBe('ok')
    expect(sev('Failed')).toBe('bad')
    expect(sev('Cancelled')).toBe('bad')
    expect(sev('Running')).toBe('go')
    expect(sev('Pausing')).toBe('go')
    expect(sev('Cancelling')).toBe('go')
  })

  it('leaves an unknown status unlabelled and neutral, so the raw code shows', () => {
    expect(jobStateWords({ status: 'Archived' as JobStatus, phase: null, waitReason: null, holdReason: null, notBefore: null })).toMatchObject({
      labelKey: null,
      sev: 'mute',
    })
  })
})

describe('tableTaskStatusBadge', () => {
  it('maps every TableTaskStatus to a label that exists', () => {
    for (const s of TABLE_TASK_STATUSES) {
      const b = tableTaskStatusBadge(s)
      expect(b.labelKey).toBe(`tableStatus.${s}`)
      expect(word(b.labelKey as string)).toBeTruthy()
    }
    expect(tableTaskStatusBadge('Skipped')).toEqual({ labelKey: null, sev: 'mute' })
  })
})

describe('failureWords', () => {
  it('maps every job failure reason to a sentence that exists', () => {
    for (const code of JOB_FAILURE_REASONS) {
      const w = failureWords('job', code)
      expect(w).toEqual({ sentenceKey: `failure.job.${code}`, code, detail: null, raw: code })
      expect(word(w!.sentenceKey as string)).toBeTruthy()
    }
  })

  it('maps every table failure code to a sentence, keeping the detail that follows it', () => {
    for (const code of TABLE_FAILURE_CODES) {
      const w = failureWords('table', code)
      expect(w?.sentenceKey).toBe(`failure.table.${code}`)
      expect(word(w!.sentenceKey as string)).toBeTruthy()
    }
    expect(failureWords('table', 'ConstraintViolation: FK_DemoProduct_Category failed WITH CHECK')).toEqual({
      sentenceKey: 'failure.table.ConstraintViolation',
      code: 'ConstraintViolation',
      detail: 'FK_DemoProduct_Category failed WITH CHECK',
      raw: 'ConstraintViolation: FK_DemoProduct_Category failed WITH CHECK',
    })
    expect(failureWords('table', 'SchemaMismatch - column Price missing at target')?.detail).toBe('column Price missing at target')
    expect(failureWords('table', 'InvalidKey (no primary key)')?.detail).toBe('(no primary key)')
  })

  it('falls back to the raw text for an unknown code, and a table code is not a job reason', () => {
    expect(failureWords('job', 'DiskFull')).toEqual({ sentenceKey: null, code: null, detail: null, raw: 'DiskFull' })
    expect(failureWords('job', 'SchemaMismatch')?.sentenceKey).toBeNull()
    expect(failureWords('table', 'toString')?.sentenceKey).toBeNull()
    // A code is a whole word: "ErrorProne" is not "Error".
    expect(failureWords('table', 'ErrorProne thing')?.sentenceKey).toBeNull()
  })

  it('is nothing when there is no failure', () => {
    expect(failureWords('job', null)).toBeNull()
    expect(failureWords('table', '  ')).toBeNull()
  })
})

// ── Polling and progress ──────────────────────────────────────────────────────

const campaign = (over: Partial<Campaign> = {}): Campaign => ({
  campaignId: 'C1',
  profileId: 'P1',
  name: null,
  mode: 'ReportOnly',
  source: { server: 's', database: 'd' },
  tableSet: [],
  status: 'Running',
  totalJobs: 2,
  jobsByState: { queued: 0, running: 1, paused: 0, succeeded: 1, failed: 0, cancelled: 0 },
  reason: null,
  createdAt: '2026-10-24T09:00:00Z',
  startedAt: null,
  finishedAt: null,
  asOf: '2026-10-24T09:00:00Z',
  ...over,
})
const job = (status: JobStatus): Pick<Job, 'status'> => ({ status })

describe('pollInterval', () => {
  it('polls every 5 s while any job is non-terminal', () => {
    expect(CAMPAIGN_POLL_MS).toBe(5000)
    expect(pollInterval(campaign(), [job('Running'), job('Succeeded')])).toBe(5000)
    // The rollup counts the jobs on other pages too.
    const allDoneHere = campaign({ jobsByState: { queued: 3, running: 0, paused: 0, succeeded: 50, failed: 0, cancelled: 0 } })
    expect(pollInterval(allDoneHere, [job('Succeeded')])).toBe(5000)
  })

  it('stops when every job is terminal', () => {
    const done = campaign({ jobsByState: { queued: 0, running: 0, paused: 0, succeeded: 1, failed: 1, cancelled: 0 } })
    expect(pollInterval(done, [job('Succeeded'), job('Failed'), job('Cancelled')])).toBe(false)
    expect(pollInterval(done, undefined)).toBe(false)
  })

  it('stops once the campaign is Completed or Cancelled, whatever a stale job row says', () => {
    expect(pollInterval(campaign({ status: 'Completed' }), [job('Running')])).toBe(false)
    expect(pollInterval(campaign({ status: 'Cancelled' }), [job('Queued')])).toBe(false)
  })

  it('does not poll before the campaign is read (or after it was not found)', () => {
    expect(pollInterval(undefined, [job('Running')])).toBe(false)
  })
})

const task = (over: Partial<TableTask>): Pick<TableTask, 'chunksDone' | 'chunksTotal'> => ({ chunksDone: 0, chunksTotal: null, ...over })

describe('tableProgress', () => {
  it('is indeterminate while chunksTotal is null', () => {
    expect(tableProgress(task({ chunksDone: 3, chunksTotal: null }))).toEqual({ kind: 'indeterminate', done: 3 })
  })

  it('is chunksDone / chunksTotal as a percentage, capped at 100', () => {
    expect(tableProgress(task({ chunksDone: 118, chunksTotal: 120 }))).toEqual({ kind: 'determinate', done: 118, total: 120, percent: 98 })
    expect(tableProgress(task({ chunksDone: 120, chunksTotal: 120 }))).toEqual({ kind: 'determinate', done: 120, total: 120, percent: 100 })
    expect(tableProgress(task({ chunksDone: 5, chunksTotal: 4 }))).toMatchObject({ percent: 100 })
  })

  it('reads a sized table with no chunks as complete', () => {
    expect(tableProgress(task({ chunksDone: 0, chunksTotal: 0 }))).toEqual({ kind: 'determinate', done: 0, total: 0, percent: 100 })
  })
})

// ── The rest of the page's pure pieces ─────────────────────────────────────────

describe('the campaign page URL', () => {
  it('reads the job status, page and drawer job, defaulting the rest', () => {
    expect(campaignJobsFromParams(new URLSearchParams('status=Failed&page=3&job=01JB2CA2R4S6T8V0W1X3Y5Z7AB'))).toEqual({
      status: 'Failed',
      page: 3,
      job: '01JB2CA2R4S6T8V0W1X3Y5Z7AB',
    })
    expect(campaignJobsFromParams(new URLSearchParams(''))).toEqual({ status: null, page: 1, job: null })
    expect(campaignJobsFromParams(new URLSearchParams('status=failed&page=-1&job='))).toEqual({ status: null, page: 1, job: null })
  })

  it('writes only what differs, so the drawer and the filter never clobber each other', () => {
    expect(campaignJobsToParams({ status: null, page: 1, job: null }).toString()).toBe('')
    expect(campaignJobsToParams({ status: 'Running', page: 2, job: 'J1' }).toString()).toBe('status=Running&page=2&job=J1')
  })
})

describe('storeLabel', () => {
  it('is client/code, the way DataSync names a store', () => {
    expect(storeLabel({ client: '000', code: 'DEMO01' })).toBe('000/DEMO01')
  })
})

describe('isDataSyncNotFound', () => {
  it('is true for the campaign and job not-found codes only', () => {
    const nf = (code: string) => new ApiError('business', 'x', 404, [{ errorCode: code, errorMessage: '', internalErrorCode: '' }])
    expect(isDataSyncNotFound(nf('DATASYNC_CAMPAIGN_NOT_FOUND'))).toBe(true)
    expect(isDataSyncNotFound(nf('DATASYNC_JOB_NOT_FOUND'))).toBe(true)
    expect(isDataSyncNotFound(nf('DATASYNC_PROFILE_NOT_FOUND'))).toBe(false)
    expect(isDataSyncNotFound(new ApiError('network', 'x', 0))).toBe(false)
  })
})

describe('the campaign page reads', () => {
  const fetched = async (call: () => Promise<unknown>, data: unknown): Promise<string> => {
    const fetch = vi.fn().mockResolvedValue({
      status: 200,
      ok: true,
      json: async () => ({ statusCode: 200, success: true, message: '', errors: [], data }),
    } as unknown as Response)
    vi.stubGlobal('fetch', fetch)
    await call()
    const url = String(fetch.mock.calls[0][0])
    return url.slice(url.indexOf('DataSync/'))
  }

  it('reads one campaign by id', async () => {
    expect(await fetched(() => dataSyncApi.campaign('C 1'), campaign())).toBe('DataSync/Campaigns/C%201')
  })

  it('reads its jobs a page of 50 at a time, the status by its exact name', async () => {
    expect(await fetched(() => dataSyncApi.campaignJobs('C1', { status: null, page: 1 }), [])).toBe(
      'DataSync/Campaigns/C1/Jobs?page=1&pageSize=50',
    )
    expect(await fetched(() => dataSyncApi.campaignJobs('C1', { status: 'Failed', page: 2 }), [])).toBe(
      'DataSync/Campaigns/C1/Jobs?status=Failed&page=2&pageSize=50',
    )
  })

  it('reads one job by id', async () => {
    expect(await fetched(() => dataSyncApi.job('J1'), {})).toBe('DataSync/Jobs/J1')
  })
})

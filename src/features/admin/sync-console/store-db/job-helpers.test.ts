import { describe, expect, it } from 'vitest'
import type { StoreDbJob } from '@/core/models/store-database'
import jobsFixture from './__fixtures__/jobs.json'
import { jobDoor, jobFailure, jobRequest, jobStateBadge, refusalKey, runsTonightByDefault } from './job-helpers'

/** Oms 918 (BackOffice 4034–4037): the store database write rail, as the Space / Backup / Jobs panels read it. */
describe('a refused job', () => {
  // The request-time refusal is drawn by the console's ReasonDialog through `apiErrorMessage` (the drive's check 6);
  // these pin the words beside its code and the run-time error from the jobs list.
  it('names a refusal code this bundle knows, beside the server’s own text', () => {
    expect(refusalKey('SHRINK_FREE_LOW')).toBe('storeDb.jobs.refusals.SHRINK_FREE_LOW')
    expect(refusalKey('JOB_OPEN')).toBe('storeDb.jobs.refusals.JOB_OPEN')
  })

  it('has words for every code the server’s store database doors refuse with (pricing2 fa2759e8f)', () => {
    for (const code of [
      'BAD_REQUEST', 'REASON_REQUIRED', 'UNKNOWN_KIND', 'NO_STORE', 'NO_READING', 'JOB_OPEN', 'STORE_UNREACHABLE',
      'RESTORE_GRANT_REQUIRED', 'NOT_A_RESTORE_KIND', 'SHRINK_FREE_LOW', 'DISK_LOW', 'CLEANUP_OFF', 'NEWER_ENGINE',
      'NOT_A_SIDE_COPY', 'BACKUP_UNREADABLE', 'NOT_A_FULL_BACKUP', 'BACKUP_FOLDER', 'BAD_SCHEDULE',
      'BLITZ_NOT_INSTALLED', 'BLITZ_FAILED', 'NO_BLITZ_BUILD',
    ])
      expect(refusalKey(code), code).toBe(`storeDb.jobs.refusals.${code}`)
  })

  it('the guessed spellings the server never sends have no words', () => {
    for (const code of ['NOT_WORKER_STORE', 'TOO_LITTLE_FREE', 'DISK_TOO_LOW']) expect(refusalKey(code), code).toBeNull()
  })

  it('a code this bundle does not know has no words of its own (the server’s text shows alone)', () => {
    expect(refusalKey('SOMETHING_NEW')).toBeNull()
    expect(refusalKey(null)).toBeNull()
  })

  it('a job the runner refused or failed shows its error text from the jobs list', () => {
    const jobs = jobsFixture as StoreDbJob[]
    const failed = jobs.find((j) => j.state === 'Failed')!
    expect(jobFailure(failed)).toBe('Free space on D: is 3.1 GB, below 1.5 × the data used (4.5 GB). The backup was not started.')
    expect(jobFailure(jobs.find((j) => j.state === 'Done')!)).toBeNull()
  })
})

describe('the night window (owner ruling: follow the server)', () => {
  // The server holds every kind for its store's window unless runNow (StoreDatabaseJobWindow.NotBefore, pricing2).
  it('every kind defaults to tonight', () => {
    for (const k of ['ShrinkLog', 'ShrinkData', 'Backup', 'RestoreSideCopy', 'DropSideCopy', 'Cleanup', 'InstallBlitz', 'RemoveBlitz'] as const)
      expect(runsTonightByDefault(k), k).toBe(true)
  })

  it('a kind is sent for tonight unless Run now is chosen — never forced to run now', () => {
    expect(jobRequest('P104', 'ShrinkData', 'Log grew after the cleanup', false)).toEqual({ code: 'P104', kind: 'ShrinkData', reason: 'Log grew after the cleanup', runNow: false })
    expect(jobRequest('P104', 'ShrinkLog', 'Log is 4 GB', false).runNow).toBe(false)
    expect(jobRequest('P104', 'ShrinkData', 'Store is closed', true).runNow).toBe(true)
  })

  it('a side-copy kind names what it acts on as the server’s `target`', () => {
    expect(jobRequest('P104', 'DropSideCopy', 'Done with it', false, 'POS_Restore_20261110')).toEqual({
      code: 'P104',
      kind: 'DropSideCopy',
      reason: 'Done with it',
      runNow: false,
      target: 'POS_Restore_20261110',
    })
  })
})

describe('the door a job is asked at', () => {
  it('restore and drop go to the Restore door; every other kind to the Act door', () => {
    expect(jobDoor('RestoreSideCopy')).toBe('StoreDatabase/RestoreJobs')
    expect(jobDoor('DropSideCopy')).toBe('StoreDatabase/RestoreJobs')
    for (const k of ['ShrinkLog', 'ShrinkData', 'Backup', 'Cleanup', 'InstallBlitz', 'RemoveBlitz'] as const) expect(jobDoor(k), k).toBe('StoreDatabase/Jobs')
  })
})

describe('a job’s state badge', () => {
  it('reads each state the door is known to send with its severity', () => {
    // StoreDatabaseJobState (pricing2): Waiting, Running, Retrying, Done, Failed.
    expect(jobStateBadge('Waiting')).toEqual({ labelKey: 'storeDb.jobs.states.Waiting', sev: 'mute' })
    expect(jobStateBadge('Running')).toEqual({ labelKey: 'storeDb.jobs.states.Running', sev: 'go' })
    expect(jobStateBadge('Retrying')).toEqual({ labelKey: 'storeDb.jobs.states.Retrying', sev: 'warn' })
    expect(jobStateBadge('Done')).toEqual({ labelKey: 'storeDb.jobs.states.Done', sev: 'ok' })
    expect(jobStateBadge('Failed')).toEqual({ labelKey: 'storeDb.jobs.states.Failed', sev: 'bad' })
  })

  it('an unknown state is neutral with no word of its own', () => {
    expect(jobStateBadge('Queued')).toEqual({ labelKey: null, sev: 'mute' })
    expect(jobStateBadge('Paused')).toEqual({ labelKey: null, sev: 'mute' })
  })
})

import { describe, expect, it } from 'vitest'
import { permissionsOf } from '@/core/permissions'
import type { StoreDbJob } from '@/core/models/store-database'
import jobsFixture from './__fixtures__/jobs.json'
import { jobActionsVisible, jobFailure, jobRequest, jobStateBadge, refusalKey, runsTonightByDefault } from './job-helpers'

/** Oms 918 (BackOffice 4034–4037): the store database write rail, as the Space / Backup / Jobs panels read it. */
describe('a refused job', () => {
  // The request-time refusal is drawn by the console's ReasonDialog through `apiErrorMessage` (the drive's check 6);
  // these pin the words beside its code and the run-time error from the jobs list.
  it('names a refusal code this bundle knows, beside the server’s own text', () => {
    expect(refusalKey('TOO_LITTLE_FREE')).toBe('storeDb.jobs.refusals.TOO_LITTLE_FREE')
    expect(refusalKey('JOB_OPEN')).toBe('storeDb.jobs.refusals.JOB_OPEN')
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

describe('the job buttons', () => {
  it('are hidden without the Act key', () => {
    expect(jobActionsVisible(permissionsOf({ screens: ['ActionSyncConsole:03', 'StoreDatabase:03'] }))).toBe(false)
    expect(jobActionsVisible(permissionsOf({ screens: ['ActionSyncConsole:06', 'StoreDatabaseRestore:06', 'StoreDatabase:03'] }))).toBe(false)
  })

  it('show with the Act key beside View', () => {
    expect(jobActionsVisible(permissionsOf({ screens: ['StoreDatabase:03', 'StoreDatabase:06'] }))).toBe(true)
  })

  it('stay hidden with Act alone (the page needs View)', () => {
    expect(jobActionsVisible(permissionsOf({ screens: ['StoreDatabase:06'] }))).toBe(false)
  })
})

describe('the night window', () => {
  it('the heavy kinds default to tonight; the rest run now', () => {
    expect(runsTonightByDefault('ShrinkData')).toBe(true)
    expect(runsTonightByDefault('RestoreSideCopy')).toBe(true)
    expect(runsTonightByDefault('DropSideCopy')).toBe(true)
    for (const k of ['ShrinkLog', 'Backup', 'Cleanup', 'InstallBlitz', 'RemoveBlitz'] as const) expect(runsTonightByDefault(k), k).toBe(false)
  })

  it('a heavy kind is sent for tonight unless Run now is chosen', () => {
    expect(jobRequest('P104', 'ShrinkData', 'Log grew after the cleanup', false)).toEqual({ code: 'P104', kind: 'ShrinkData', reason: 'Log grew after the cleanup', runNow: false })
    expect(jobRequest('P104', 'ShrinkData', 'Store is closed', true).runNow).toBe(true)
  })

  it('a light kind always runs now, and carries the extra fields a kind needs', () => {
    expect(jobRequest('P104', 'ShrinkLog', 'Log is 4 GB', false).runNow).toBe(true)
    expect(jobRequest('P104', 'DropSideCopy', 'Done with it', false, { database: 'POS_Restore_20261110' })).toEqual({
      code: 'P104',
      kind: 'DropSideCopy',
      reason: 'Done with it',
      runNow: false,
      database: 'POS_Restore_20261110',
    })
  })
})

describe('a job’s state badge', () => {
  it('reads each state the door is known to send with its severity', () => {
    expect(jobStateBadge('Queued')).toEqual({ labelKey: 'storeDb.jobs.states.Queued', sev: 'mute' })
    expect(jobStateBadge('Running')).toEqual({ labelKey: 'storeDb.jobs.states.Running', sev: 'go' })
    expect(jobStateBadge('Done')).toEqual({ labelKey: 'storeDb.jobs.states.Done', sev: 'ok' })
    expect(jobStateBadge('Failed')).toEqual({ labelKey: 'storeDb.jobs.states.Failed', sev: 'bad' })
    expect(jobStateBadge('Deferred')).toEqual({ labelKey: 'storeDb.jobs.states.Deferred', sev: 'warn' })
  })

  it('an unknown state is neutral with no word of its own', () => {
    expect(jobStateBadge('Paused')).toEqual({ labelKey: null, sev: 'mute' })
  })
})

/**
 * The failed-line model (ticket 434, spec 430 D12): the job label, the action sentence per case,
 * the `canReRun` truth table with the grant, and blank unset times.
 */
import { describe, expect, it } from 'vitest'
import type { FailedDonorTransferRow } from '@/core/models/failed-donor-transfer'
import { failedLine, jobLabel, requestState, whenSet } from './failed-line'

const UNSET = '0001-01-01T00:00:00'

const row = (over: Partial<FailedDonorTransferRow> = {}): FailedDonorTransferRow => ({
  requestNo: 'DR-1001',
  deliveryNo: '8000000501',
  donorStore: 'P019',
  orderStore: 'P001',
  requestState: 'FULFILLED',
  transferStoNo: null,
  outboxId: 'OB-77',
  outboxStatus: 'F',
  attemptCount: 3,
  lastAttemptTime: '2026-10-07T09:41:00',
  retryDeadline: '2026-10-08T09:00:00',
  errorMessage: 'DRS: material blocked',
  reverseByHand: false,
  ...over,
})

describe('jobLabel', () => {
  it('reads the WPF letters and the D12 words alike', () => {
    expect(jobLabel('F')).toEqual({ kind: 'failed' })
    expect(jobLabel('FAILED')).toEqual({ kind: 'failed' })
    expect(jobLabel('P')).toEqual({ kind: 'retrying' })
    expect(jobLabel('PENDING')).toEqual({ kind: 'retrying' })
    expect(jobLabel('C')).toEqual({ kind: 'completed' })
    expect(jobLabel('COMPLETED')).toEqual({ kind: 'completed' })
    expect(jobLabel(' f ')).toEqual({ kind: 'failed' })
  })

  it('keeps anything else as the raw status, and absent as blank', () => {
    expect(jobLabel('X')).toEqual({ kind: 'raw', status: 'X' })
    expect(jobLabel('PROCESSING')).toEqual({ kind: 'raw', status: 'PROCESSING' })
    expect(jobLabel(null)).toEqual({ kind: 'raw', status: '' })
  })
})

describe('failedLine — the action sentence', () => {
  it('a reverse-by-hand line names its STO', () => {
    expect(failedLine(row({ reverseByHand: true, transferStoNo: ' 4500012345 ', outboxStatus: 'C' }), true).action).toEqual({
      kind: 'reverse',
      sto: '4500012345',
    })
  })

  it('a re-runnable line asks for a re-run once the cause is fixed', () => {
    expect(failedLine(row(), true).action).toEqual({ kind: 'reRun' })
  })

  it('the sentence does not hang on the grant: a failed line asks for a re-run of a reader without it too', () => {
    expect(failedLine(row(), false).action).toEqual({ kind: 'reRun' })
  })

  it('a retrying line, or a failed one with no job to run, is retrying on its own (as WPF)', () => {
    expect(failedLine(row({ outboxStatus: 'P' }), true).action).toEqual({ kind: 'retrying' })
    expect(failedLine(row({ outboxId: '' }), true).action).toEqual({ kind: 'retrying' })
  })
})

describe('failedLine — canReRun, the D12 truth table', () => {
  it('a FAILED job with an outbox ID, not reverse-by-hand, for a grant holder → true', () => {
    expect(failedLine(row(), true).canReRun).toBe(true)
  })

  it.each([
    ['reverse-by-hand', row({ reverseByHand: true, transferStoNo: '4500012345' }), true],
    ['a retrying job', row({ outboxStatus: 'P' }), true],
    ['a completed job', row({ outboxStatus: 'C' }), true],
    ['an unknown status', row({ outboxStatus: 'X' }), true],
    ['no outbox ID', row({ outboxId: '' }), true],
    ['a blank outbox ID', row({ outboxId: '  ' }), true],
    ['a null outbox ID', row({ outboxId: null }), true],
    ['no grant', row(), false],
  ])('%s → false', (_name, r, grant) => {
    expect(failedLine(r, grant).canReRun).toBe(false)
  })
})

describe('failedLine — times', () => {
  it('a set time is kept as sent', () => {
    const l = failedLine(row(), true)
    expect(l.lastAttemptAt).toBe('2026-10-07T09:41:00')
    expect(l.deadlineAt).toBe('2026-10-08T09:00:00')
  })

  it('an unset (0001-…) time is blank', () => {
    const l = failedLine(row({ lastAttemptTime: UNSET, retryDeadline: UNSET, reverseByHand: true, outboxId: '' }), true)
    expect(l.lastAttemptAt).toBeNull()
    expect(l.deadlineAt).toBeNull()
  })

  it('an absent or unreadable time is blank too', () => {
    expect(whenSet('')).toBeNull()
    expect(whenSet(null)).toBeNull()
    expect(whenSet('not a date')).toBeNull()
  })

  it('the job label rides along', () => {
    expect(failedLine(row({ outboxStatus: 'P' }), true).job).toEqual({ kind: 'retrying' })
  })
})

describe('requestState', () => {
  it('reads the three states 2371 sends, trimmed and in any case', () => {
    expect(requestState('FULFILLED')).toEqual({ kind: 'known', state: 'FULFILLED' })
    expect(requestState(' cancelled ')).toEqual({ kind: 'known', state: 'CANCELLED' })
    expect(requestState('TRANSFERRED')).toEqual({ kind: 'known', state: 'TRANSFERRED' })
  })

  it('keeps anything else as sent', () => {
    expect(requestState('OPEN')).toEqual({ kind: 'raw', state: 'OPEN' })
    expect(requestState(null)).toEqual({ kind: 'raw', state: '' })
  })
})

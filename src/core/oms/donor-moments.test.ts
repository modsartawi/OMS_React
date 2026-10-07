/**
 * A delivery's donor moments on its Delivery timeline (ticket 429): each request's own times as
 * point rows, merged into the spine's past, the "Waiting on donor" lines, and the DRTR job named
 * after its donor. Pure.
 */
import { describe, expect, it } from 'vitest'

import type {
  DonorRequestModel,
  SdDocumentHeaderModel,
  SdDocumentLogModel,
  SdDocumentOutboxModel,
} from '@/core/models/sd-document'
import { donorMoments, donorOfJob, donorOutcome, elapsedSince, waitingOnDonor } from './donor-moments'
import { timeline, timelineInputFromHeader } from './timeline'
import { spine, type SpineEntry } from './timeline-feed'

const UNSET = '0001-01-01T00:00:00'
const T = '2026-10-07T'

const request = (requestNo: string, over: Partial<DonorRequestModel> = {}): DonorRequestModel => ({
  requestNo,
  deliveryNo: '8000000500',
  orderStore: 'P019',
  donorStore: 'D012',
  state: 'OPEN',
  outcome: '',
  outcomeReason: '',
  outcomeBy: '',
  outcomeAt: UNSET,
  raisedBy: 'store.p019',
  raisedAt: `${T}09:00:00`,
  changedBy: '',
  changedAt: UNSET,
  fulfilledAt: UNSET,
  lockedBy: '',
  lockedAt: UNSET,
  transferStoNo: '',
  transferSapDocumentNo: '',
  transferredAt: UNSET,
  picked: 0,
  required: 3,
  ...over,
})

/** Every moment set: edited, picked, stamped, transferred, then reversed by hand. */
const reversed = request('DR1', {
  state: 'CANCELLED',
  outcome: 'CANCELLED',
  outcomeReason: 'Wrong store',
  outcomeBy: 'ops.lead',
  outcomeAt: `${T}12:00:00`,
  changedBy: 'store.p019',
  changedAt: `${T}09:10:00`,
  fulfilledAt: `${T}09:40:00`,
  lockedBy: 'store.d012',
  lockedAt: `${T}09:45:00`,
  transferStoNo: '4500001234',
  transferredAt: `${T}10:30:00`,
  picked: 2,
})

const log = (logNo: number, entryTime: string, actionType: string): SdDocumentLogModel => ({
  logNo: String(logNo),
  documentNo: '8000000500',
  entryTime,
  entryUser: 'store.p019',
  actionType,
  actionTypeDescription: actionType,
  actionData: '',
  actionOldData: '',
  note: '',
  staffId: '',
  storeCode: '',
})

const job = (outboxId: number, entryTime: string, over: Partial<SdDocumentOutboxModel> = {}): SdDocumentOutboxModel => ({
  outboxId: String(outboxId),
  actionType: 'LMCO',
  actionTypeDescription: 'LastMile — create order',
  documentNo: '8000000500',
  documentCategory: 'D',
  userId: 'system',
  entryTime,
  attemptCount: 1,
  lastAttemptTime: entryTime,
  nextAttemptTime: '',
  outboxStatus: 'C',
  errorMessage: '',
  ...over,
})

const header = (status: Record<string, string>): SdDocumentHeaderModel =>
  ({
    documentNo: '8000000500',
    deliveryType: 'D',
    status: { readyStatus: '', deliveryStatus: '', closeStatus: '', lastAction: '', ...status },
  }) as SdDocumentHeaderModel

const shape = (e: SpineEntry): string => {
  switch (e.kind) {
    case 'milestone':
      return `milestone:${e.step.key}`
    case 'job':
      return `job:${e.job.outboxId}${e.donor ? `:${e.donor.donorStore}` : ''}`
    case 'donor':
      return `donor:${e.request.requestNo}:${e.moment}`
    default:
      return e.kind
  }
}

describe('each donor request gives one row per time it has set', () => {
  it('every moment in the table becomes one row at its own time', () => {
    expect(donorMoments([reversed]).map((m) => [m.kind, m.at])).toEqual([
      ['raised', `${T}09:00:00`],
      ['edited', `${T}09:10:00`],
      ['picked', `${T}09:40:00`],
      ['stamped', `${T}09:45:00`],
      ['transferred', `${T}10:30:00`],
      ['ended', `${T}12:00:00`],
    ])
  })

  it('an unset time gives no row: a fresh request is Raised alone', () => {
    expect(donorMoments([request('DR2')]).map((m) => m.kind)).toEqual(['raised'])
    expect(donorMoments([request('DR2', { changedAt: '', lockedAt: '  ' })]).map((m) => m.kind)).toEqual(['raised'])
    expect(donorMoments(null)).toEqual([])
  })

  it('a cancelled request that was transferred gives both Transferred and Ended', () => {
    const kinds = donorMoments([reversed]).map((m) => m.kind)
    expect(kinds).toContain('transferred')
    expect(kinds).toContain('ended')
  })

  it("an Ended row reads its outcome: cancelled, refused, expired, or none the server didn't send", () => {
    expect(donorOutcome(reversed)).toBe('cancelled')
    expect(donorOutcome(request('X', { outcome: 'REFUSED' }))).toBe('refused')
    expect(donorOutcome(request('X', { outcome: 'EXPIRED' }))).toBe('expired')
    expect(donorOutcome(request('X'))).toBeNull()
  })
})

describe('donor rows merge into the past on their time', () => {
  // Ready at 09:45:00 — the same instant the donor stamped its pick.
  const logs = [log(1, `${T}08:55:00`, 'DCRT'), log(2, `${T}09:45:00`, 'DRDY')]
  const jobs = [
    job(9100, `${T}08:55:01`),
    job(9101, `${T}09:45:00`, { actionType: 'DRTR', actionTypeDescription: 'Donor transfer', documentNo: 'DR1' }),
  ]
  const steps = timeline(timelineInputFromHeader(header({ readyStatus: 'R', lastAction: 'DRDY' }), logs))

  it('a donor row interleaves with Log and job rows on `at`; Stamped lands directly under Ready at a tie', () => {
    const s = spine(steps, logs, jobs, [reversed])
    expect(s.past.map(shape)).toEqual([
      'donor:DR1:ended',
      'donor:DR1:transferred',
      'milestone:ready',
      'donor:DR1:stamped',
      'job:9101:D012',
      'donor:DR1:picked',
      'donor:DR1:edited',
      'donor:DR1:raised',
      'job:9100',
      'milestone:created',
    ])
  })

  it('within donor rows a tie falls back to the moment order, the later moment first', () => {
    const tied = request('DR3', { fulfilledAt: `${T}09:00:00`, lockedAt: `${T}09:00:00`, lockedBy: 'store.d012' })
    expect(spine(steps, [], [], [tied]).past.map(shape).filter((e) => e.startsWith('donor'))).toEqual([
      'donor:DR3:stamped',
      'donor:DR3:picked',
      'donor:DR3:raised',
    ])
  })

  it('a failing (null) donor read leaves the rest of the spine as it was', () => {
    const without = spine(steps, logs, jobs)
    const failed = spine(steps, logs, jobs, null)
    expect(failed.past.map(shape)).toEqual(without.past.map(shape))
    expect(failed.past.map(shape)).toEqual(['milestone:ready', 'job:9101', 'job:9100', 'milestone:created'])
    expect(failed.waiting).toEqual([])
    expect(failed.future).toEqual(without.future)
  })
})

describe('the waiting line', () => {
  it('shows for an OPEN, unpicked request only, one line per request, oldest raised first', () => {
    const late = request('DR5', { raisedAt: `${T}10:00:00`, donorStore: 'D044' })
    const early = request('DR4')
    expect(waitingOnDonor([late, early, reversed]).map((r) => r.requestNo)).toEqual(['DR4', 'DR5'])
    expect(spine([], [], [], [late]).waiting.map((r) => r.requestNo)).toEqual(['DR5'])
  })

  it('is gone once the request is picked or ended, or no longer OPEN', () => {
    expect(waitingOnDonor([request('DR4', { fulfilledAt: `${T}09:30:00` })])).toEqual([])
    expect(waitingOnDonor([request('DR4', { outcome: 'EXPIRED', outcomeAt: `${T}11:00:00` })])).toEqual([])
    expect(waitingOnDonor([request('DR4', { state: 'FULFILLED' })])).toEqual([])
    expect(waitingOnDonor(null)).toEqual([])
  })

  it('counts whole minutes since the request was raised', () => {
    const now = Date.parse(`${T}10:20:59`)
    expect(elapsedSince(`${T}09:00:00`, now)).toEqual({ days: 0, hours: 1, minutes: 20 })
    expect(elapsedSince('2026-10-05T09:00:00', now)).toEqual({ days: 2, hours: 1, minutes: 20 })
    expect(elapsedSince(`${T}11:00:00`, now)).toEqual({ days: 0, hours: 0, minutes: 0 })
    expect(elapsedSince(UNSET, now)).toBeNull()
  })
})

describe('the DRTR job row names its donor', () => {
  it('only when its documentNo matches one of the delivery’s requests', () => {
    const drtr = job(1, `${T}10:30:00`, { actionType: 'DRTR', documentNo: 'DR1' })
    expect(donorOfJob(drtr, [request('DR9'), reversed])?.donorStore).toBe('D012')
    expect(donorOfJob(drtr, [request('DR9')])).toBeNull()
    expect(donorOfJob(job(2, `${T}10:30:00`), [reversed])).toBeNull()
    expect(donorOfJob(drtr, null)).toBeNull()
    expect(spine([], [], [drtr], null).past.map(shape)).toEqual(['job:1'])
  })
})

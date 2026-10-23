/**
 * A delivery's callout moments (BackOffice spec 2952, oms ticket 542): points on the Delivery
 * details spine taken from the callout history door's raw event log and its bids. Pure.
 */
import { describe, expect, it } from 'vitest'

import type { DeliveryCalloutRecord, DispatchCalloutEvent } from '@/core/models/delivery-callout'
import type { DispatchBid } from '@/core/models/dispatch-board'
import type { DonorRequestModel, SdDocumentLogModel, SdDocumentOutboxModel } from '@/core/models/sd-document'
import { feed, spine, type SpineEntry } from './timeline-feed'
import {
  calloutLog,
  calloutMoments,
  calloutsOf,
  compareCalloutMoments,
  lockedCallout,
  onCallout,
} from './callout-moments'

const T = '2026-10-23T'

const bid = (bidId: string, store: string, over: Partial<DispatchBid> = {}): DispatchBid => ({
  bidId,
  store,
  status: 'OPEN',
  offeredAt: `${T}10:00:00`,
  distanceKm: 2.4,
  atpKnown: true,
  atpCoversBasket: true,
  atpShortLines: 0,
  onlineTills: 2,
  signedInTills: 1,
  dark: false,
  deliveredAt: null,
  deliveredRegister: '',
  shownAt: null,
  shownStaff: '',
  shownRegister: '',
  openedAt: null,
  openedStaff: '',
  openedRegister: '',
  answeredAt: null,
  answeredStaff: '',
  answeredRegister: '',
  closedAt: null,
  ignoreReason: '',
  ...over,
})

let n = 0
const ev = (at: string, kind: string, over: Partial<DispatchCalloutEvent> = {}): DispatchCalloutEvent => ({
  eventId: `E${++n}`,
  at: `${T}${at}`,
  kind,
  bidId: '',
  party: '',
  staff: '',
  register: '',
  detail: '',
  ...over,
})

const callout = (over: Partial<DeliveryCalloutRecord> = {}): DeliveryCalloutRecord => ({
  calloutId: 'C1',
  deliveryNumber: '8000000600',
  status: 'TAKEN',
  outcome: 'Taken',
  endReason: '',
  openedAt: `${T}10:00:00`,
  expiresAt: `${T}10:05:00`,
  endedAt: `${T}10:02:00`,
  secondsLeft: null,
  candidateCount: 3,
  locksDelivery: true,
  locked: true,
  awardedParty: 'R047',
  awardedAt: `${T}10:02:00`,
  takenByStaff: 'Huda',
  takenByDevice: '01',
  fallbackParty: 'R001',
  fallbackAt: null,
  releasedAt: null,
  releasedBy: '',
  releaseReason: '',
  releaseNote: '',
  channel: 'WEB',
  deliveryType: 'EXPRESS',
  city: 'Riyadh',
  cityCode: 'RUH',
  district: 'Olaya',
  value: 120,
  lineCount: 3,
  bids: [],
  events: [],
  ...over,
})

const kinds = (record: DeliveryCalloutRecord) => calloutMoments([record]).map((m) => m.kind)

describe('calloutMoments — each event kind gives its moment', () => {
  it('maps the callout-level kinds', () => {
    const record = callout({
      status: 'UNANSWERED',
      outcome: 'FellBack',
      events: [
        ev('10:00:00', 'Opened', { detail: 'parties=3;fallback=R001' }),
        ev('10:05:00', 'Unanswered', { party: 'R001', detail: 'Expired' }),
        ev('10:05:01', 'FallbackDelivered', { party: 'R001', register: '02' }),
        ev('10:05:10', 'FallbackShown', {
          party: 'R001',
          staff: 'Sami',
          register: '02',
        }),
        ev('10:05:20', 'FallbackOpened', {
          party: 'R001',
          staff: 'Sami',
          register: '02',
        }),
        ev('10:05:30', 'FallbackDismissed', {
          party: 'R001',
          staff: 'Sami',
          register: '02',
        }),
        ev('10:06:00', 'FallbackFailed', {
          party: 'R001',
          detail: 'Sd guard said no',
        }),
        ev('10:07:00', 'Withdraw', { detail: 'Withdrawn' }),
        ev('10:20:00', 'LockReleased', {
          party: 'R001',
          staff: 'hq.ops',
          detail: 'NoStock: shelf empty',
        }),
      ],
    })
    expect(kinds(record)).toEqual([
      'opened',
      'fellBack',
      'fallbackDelivered',
      'fallbackShown',
      'fallbackOpened',
      'fallbackDismissed',
      'fallbackFailed',
      'withdrawn',
      'lockReleased',
    ])
  })

  it("maps the bid-level kinds, telling the callout's Opened from the till's BidOpened", () => {
    const record = callout({
      bids: [bid('B1', 'R047', { status: 'TAKEN' })],
      events: [
        ev('10:00:00', 'Opened'),
        ev('10:00:05', 'Delivered', {
          bidId: 'B1',
          party: 'R047',
          register: '01',
        }),
        ev('10:00:09', 'Shown', {
          bidId: 'B1',
          party: 'R047',
          staff: 'Huda',
          register: '01',
        }),
        ev('10:00:20', 'BidOpened', {
          bidId: 'B1',
          party: 'R047',
          staff: 'Huda',
          register: '01',
        }),
        ev('10:00:40', 'Dismissed', {
          bidId: 'B1',
          party: 'R047',
          staff: 'Huda',
          register: '01',
        }),
      ],
    })
    expect(kinds(record)).toEqual(['opened', 'delivered', 'shown', 'bidOpened', 'dismissed'])
    const opened = calloutMoments([record]).find((m) => m.kind === 'bidOpened')!
    expect(opened.bid?.store).toBe('R047')
    expect(opened.staff).toBe('Huda')
    expect(opened.register).toBe('01')
  })

  it('keeps took, awarded elsewhere, passed, expired, withdrawn and lock released distinct', () => {
    const record = callout({
      status: 'TAKEN',
      bids: [
        bid('B1', 'R047', { status: 'TAKEN' }),
        bid('B2', 'R012', { status: 'LOST' }),
        bid('B3', 'R030', { status: 'PASSED' }),
        bid('B4', 'R090', {
          status: 'EXPIRED',
          closedAt: `${T}10:02:00`,
          ignoreReason: 'ShownNotOpened',
        }),
      ],
      events: [
        ev('10:01:00', 'Pass', {
          bidId: 'B3',
          party: 'R030',
          staff: 'Omar',
          register: '03',
          detail: 'YouPassed',
        }),
        ev('10:02:00', 'Take', {
          bidId: 'B1',
          party: 'R047',
          staff: 'Huda',
          register: '01',
          detail: 'Won',
        }),
        ev('10:02:03', 'Take', {
          bidId: 'B2',
          party: 'R012',
          staff: 'Ali',
          register: '02',
          detail: 'AwardedElsewhere',
        }),
        ev('10:03:00', 'Withdraw', { detail: 'AlreadyTaken' }),
        ev('10:30:00', 'LockReleased', {
          party: 'R047',
          staff: 'hq.ops',
          detail: 'CustomerChange',
        }),
      ],
    })
    const all = calloutMoments([record])
    expect(all.map((m) => m.kind)).toEqual([
      'passed',
      'took',
      'bidExpired',
      'awardedElsewhere',
      'withdrawn',
      'lockReleased',
    ])
    expect(new Set(all.map((m) => m.kind)).size).toBe(all.length)
    const expired = all.find((m) => m.kind === 'bidExpired')!
    expect(expired.reason).toBe('ShownNotOpened')
    expect(expired.party).toBe('R090')
    expect(expired.at).toBe(`${T}10:02:00`)
    expect(all.find((m) => m.kind === 'took')!.reason).toBe('Won')
  })

  it('reads a late answer (the callout already closed) as its own moment', () => {
    const record = callout({
      bids: [bid('B1', 'R047')],
      events: [
        ev('10:06:00', 'Take', {
          bidId: 'B1',
          party: 'R047',
          detail: 'Expired',
        }),
      ],
    })
    const [late] = calloutMoments([record])
    expect(late.kind).toBe('answeredLate')
    expect(late.reason).toBe('Expired')
    expect(late.raw).toBe('Take')
  })

  it('splits a released lock into its reason and its note', () => {
    const withNote = calloutMoments([
      callout({
        events: [
          ev('10:30:00', 'LockReleased', {
            staff: 'hq.ops',
            detail: 'Other: customer moved: flat 4',
          }),
        ],
      }),
    ])[0]
    expect(withNote.reason).toBe('Other')
    expect(withNote.note).toBe('customer moved: flat 4')
    expect(withNote.staff).toBe('hq.ops')
    const bare = calloutMoments([
      callout({
        events: [ev('10:30:00', 'LockReleased', { detail: 'NoStock' })],
      }),
    ])[0]
    expect(bare.reason).toBe('NoStock')
    expect(bare.note).toBe('')
  })

  it('still renders a kind it does not know, as itself', () => {
    const [m] = calloutMoments([
      callout({
        events: [ev('10:10:00', 'Escalated', { party: 'R001', detail: 'phone' })],
      }),
    ])
    expect(m.kind).toBe('other')
    expect(m.raw).toBe('Escalated')
    expect(m.reason).toBe('phone')
  })

  it('gives a not-competed callout ONE moment with its reason', () => {
    const record = callout({
      status: 'NOT_OPENED',
      outcome: 'NotCompeted',
      endReason: 'OneCandidate',
      candidateCount: 1,
      openedAt: `${T}09:00:00`,
      bids: [],
      events: [ev('09:00:00', 'Opened')],
    })
    const all = calloutMoments([record])
    expect(all).toHaveLength(1)
    expect(all[0].kind).toBe('notCompeted')
    expect(all[0].reason).toBe('OneCandidate')
    expect(all[0].at).toBe(`${T}09:00:00`)
  })

  it('has no moment for no callout', () => {
    expect(calloutMoments([])).toEqual([])
    expect(calloutMoments(null)).toEqual([])
  })
})

describe('compareCalloutMoments', () => {
  it('orders newest first, and at one instant the later event first', () => {
    const record = callout({
      bids: [bid('B1', 'R047')],
      events: [
        ev('10:00:00', 'Opened'),
        ev('10:00:00', 'Delivered', { bidId: 'B1', party: 'R047' }),
        ev('10:00:30', 'Shown', { bidId: 'B1', party: 'R047' }),
      ],
    })
    const sorted = [...calloutMoments([record])].sort(compareCalloutMoments).map((m) => m.kind)
    expect(sorted).toEqual(['shown', 'delivered', 'opened'])
  })
})

describe('onCallout, lockedCallout, calloutsOf', () => {
  it('lists the callouts still open, for the Now line', () => {
    const open = callout({
      calloutId: 'C2',
      status: 'OPEN',
      outcome: 'Open',
      secondsLeft: 140,
      endedAt: null,
    })
    expect(onCallout([callout(), open]).map((c) => c.calloutId)).toEqual(['C2'])
  })

  it('finds the callout that locks the delivery now', () => {
    expect(lockedCallout([callout({ locked: false }), callout({ calloutId: 'C9', locked: true })])?.calloutId).toBe(
      'C9',
    )
    expect(lockedCallout([callout({ locked: false })])).toBeNull()
    expect(lockedCallout(null)).toBeNull()
  })

  it('reads a history with missing lists as empty ones', () => {
    expect(calloutsOf(null)).toEqual([])
    expect(calloutsOf({} as never)).toEqual([])
    const [c] = calloutsOf({
      asOf: '',
      deliveryNumber: '1',
      callouts: [{ ...callout(), bids: undefined, events: undefined } as never],
    })
    expect(c.bids).toEqual([])
    expect(c.events).toEqual([])
  })
})

describe('calloutLog — the raw event log', () => {
  it('keeps server order and gives each event its offset from the callout opening', () => {
    const record = callout({
      events: [ev('10:00:00', 'Opened'), ev('10:01:05', 'Pass', { party: 'R030' }), ev('10:00:30', 'Shown')],
    })
    expect(calloutLog(record).map((r) => [r.event.kind, r.seconds])).toEqual([
      ['Opened', 0],
      ['Pass', 65],
      ['Shown', 30],
    ])
  })
})

describe('the spine merges callout moments with the Log, the jobs and the donor moments by time', () => {
  const UNSET = '0001-01-01T00:00:00'
  const donor = {
    requestNo: 'DR1',
    deliveryNo: '8000000600',
    orderStore: 'R047',
    donorStore: 'D012',
    state: 'OPEN',
    outcome: '',
    outcomeReason: '',
    outcomeBy: '',
    outcomeAt: UNSET,
    raisedBy: 'store.r047',
    raisedAt: `${T}10:03:00`,
    changedBy: '',
    changedAt: UNSET,
    fulfilledAt: UNSET,
    lockedBy: '',
    lockedAt: UNSET,
    transferStoNo: '',
    transferSapDocumentNo: '',
    transferredAt: UNSET,
    picked: 0,
    required: 1,
  } as DonorRequestModel
  const logRow = (logNo: string, entryTime: string, actionType: string) =>
    ({
      logNo,
      documentNo: '',
      entryTime,
      entryUser: 'web',
      actionType,
      actionTypeDescription: actionType,
      actionData: '',
      actionOldData: '',
      note: '',
      staffId: '',
      storeCode: '',
    }) as SdDocumentLogModel
  const logs = [logRow('1', `${T}09:59:00`, 'DCRT'), logRow('2', `${T}10:02:00`, 'DTXC')]
  const jobs = [
    {
      outboxId: '9100',
      actionType: 'OTCO',
      actionTypeDescription: 'Courier',
      documentNo: '8000000600',
      documentCategory: 'D',
      userId: 'system',
      entryTime: `${T}10:02:01`,
      attemptCount: 1,
      lastAttemptTime: '',
      nextAttemptTime: '',
      outboxStatus: 'C',
      errorMessage: '',
    },
  ] as SdDocumentOutboxModel[]
  const record = callout({
    bids: [bid('B1', 'R047', { status: 'TAKEN' })],
    events: [
      ev('10:00:00', 'Opened'),
      ev('10:00:30', 'Shown', { bidId: 'B1', party: 'R047' }),
      ev('10:02:00', 'Take', {
        bidId: 'B1',
        party: 'R047',
        staff: 'Huda',
        detail: 'Won',
      }),
    ],
  })

  const shape = (e: SpineEntry): string => {
    if (e.kind === 'callout') return `callout:${e.moment.kind}`
    if (e.kind === 'donor') return `donor:${e.moment}`
    if (e.kind === 'job') return `job:${e.job.outboxId}`
    if (e.kind === 'milestone') return `milestone:${e.step.key}`
    return `${e.kind}:${e.log.actionType}`
  }

  it('interleaves newest first; at one instant the Log row, then the donor moment, then the callout moment, then the job', () => {
    expect(feed(logs, jobs, [donor], [record]).map((i) => `${i.source}@${i.at?.slice(11)}`)).toEqual([
      'donor@10:03:00',
      'job@10:02:01',
      'log@10:02:00',
      'callout@10:02:00',
      'callout@10:00:30',
      'callout@10:00:00',
      'log@09:59:00',
    ])
  })

  it('draws each callout moment in the past, and leaves the spine as it was without callouts', () => {
    const s = spine([], logs, jobs, [donor], [record])
    expect(s.past.map(shape)).toEqual([
      'donor:raised',
      'job:9100',
      'event:DTXC',
      'callout:took',
      'callout:shown',
      'callout:opened',
      'event:DCRT',
    ])
    const without = spine([], logs, jobs, [donor]).past.map(shape)
    expect(without).toEqual(s.past.map(shape).filter((e) => !e.startsWith('callout')))
    expect(spine([], logs, jobs, [donor], null).past.map(shape)).toEqual(without)
  })

  it('puts an open callout on its own line above Now', () => {
    const open = callout({
      calloutId: 'C2',
      status: 'OPEN',
      outcome: 'Open',
      secondsLeft: 90,
      endedAt: null,
      events: [ev('10:00:00', 'Opened')],
    })
    expect(spine([], [], [], [], [open]).onCallout.map((c) => c.calloutId)).toEqual(['C2'])
    expect(spine([], [], [], [], [record]).onCallout).toEqual([])
  })
})

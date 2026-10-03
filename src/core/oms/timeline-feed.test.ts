/**
 * Delivery details' spine (spec 380 D4–D7, ticket 403; ruling 371 §3–4): the Log and the outbox
 * jobs merged into one newest-first feed, and the spine drawn from it and the timeline. Pure.
 */
import { describe, expect, it } from 'vitest'

import type { SdDocumentHeaderModel, SdDocumentLogModel, SdDocumentOutboxModel } from '@/core/models/sd-document'
import { timeline, timelineInputFromHeader } from './timeline'
import { feed, jobState, spine, type SpineEntry } from './timeline-feed'

const log = (logNo: number, entryTime: string, actionType: string, over: Partial<SdDocumentLogModel> = {}): SdDocumentLogModel => ({
  logNo: String(logNo),
  documentNo: '8000000121',
  entryTime,
  entryUser: 'store.p019',
  actionType,
  actionTypeDescription: actionType,
  actionData: '',
  actionOldData: '',
  note: '',
  staffId: '',
  storeCode: '',
  ...over,
})

const job = (outboxId: number, entryTime: string, outboxStatus: string, over: Partial<SdDocumentOutboxModel> = {}): SdDocumentOutboxModel => ({
  outboxId: String(outboxId),
  actionType: 'LMCO',
  actionTypeDescription: 'LastMile — create order',
  documentNo: '8000000121',
  documentCategory: 'D',
  userId: 'system',
  entryTime,
  attemptCount: 1,
  lastAttemptTime: entryTime,
  nextAttemptTime: '',
  outboxStatus,
  errorMessage: '',
  ...over,
})

const header = (status: Record<string, string>, over: Partial<SdDocumentHeaderModel> = {}): SdDocumentHeaderModel =>
  ({
    documentNo: '8000000121',
    deliveryType: 'D',
    status: { readyStatus: '', deliveryStatus: '', closeStatus: '', lastAction: '', ...status },
    ...over,
  }) as SdDocumentHeaderModel

const ids = (items: ReturnType<typeof feed>) => items.map((i) => (i.source === 'log' ? `L${i.log.logNo}` : `J${i.job.outboxId}`))

/** One spine entry as a short string, so a whole past reads as one array. */
const shape = (e: SpineEntry): string => {
  switch (e.kind) {
    case 'milestone':
      return `milestone:${e.step.key}:${e.step.state}${e.log ? '' : ':untimed'}`
    case 'superseded':
      return `superseded:${e.step}`
    case 'rewind':
      return `rewind:${e.rewind}`
    case 'note':
      return 'note'
    case 'event':
      return `event:${e.log.actionType}`
    case 'job':
      return `job:${e.job.outboxId}:${e.state}`
  }
}

/** The returned-then-rescheduled delivery (the 371 D capture's 8000000121 case). */
const T = '2025-03-06T'
const rescheduledLogs = [
  log(1, `${T}02:46:26`, 'DCRT'),
  log(2, `${T}03:10:02`, 'DRDY'),
  log(3, `${T}03:40:51`, 'DOFD'),
  log(4, `${T}05:12:09`, 'DRBK', { note: 'Customer not answering' }),
  log(5, `${T}05:30:44`, 'DRSC', { note: 'Customer asked for evening' }),
]
const rescheduledJobs = [job(9100, `${T}02:46:27`, 'C'), job(9101, `${T}05:30:45`, 'C')]

describe('feed merges Log and jobs newest first with the Log row first on a tie; only lifecycle steps are struck as earlier passes', () => {
  it('merges both sources on entryTime, newest first', () => {
    const items = feed(rescheduledLogs, rescheduledJobs)
    expect(ids(items)).toEqual(['J9101', 'L5', 'L4', 'L3', 'L2', 'J9100', 'L1'])
    expect(items.map((i) => i.at)).toEqual([
      `${T}05:30:45`,
      `${T}05:30:44`,
      `${T}05:12:09`,
      `${T}03:40:51`,
      `${T}03:10:02`,
      `${T}02:46:27`,
      `${T}02:46:26`,
    ])
  })

  it('on a tie the Log row comes first', () => {
    const at = `${T}05:30:44`
    expect(ids(feed([log(5, at, 'DRSC')], [job(9101, at, 'C')]))).toEqual(['L5', 'J9101'])
    expect(ids(feed([log(5, `${at}.000`, 'DRSC')], [job(9101, at, 'C'), job(9102, at, 'F')]))).toEqual(['L5', 'J9102', 'J9101'])
  })

  it('orders by time, not by arrival; two rows at one time put the higher number first', () => {
    const items = feed([log(2, `${T}03:00:00`, 'DRDY'), log(10, `${T}04:00:00`, 'DADN'), log(3, `${T}03:00:00`, 'DTXC')], [])
    expect(ids(items)).toEqual(['L10', 'L3', 'L2'])
  })

  it('a row with no real time sinks to the oldest end; no rows is an empty feed', () => {
    expect(ids(feed([log(1, '0001-01-01T00:00:00', 'DADN'), log(2, `${T}03:00:00`, 'DRDY')], [job(1, '', 'C')]))).toEqual([
      'L2',
      'L1',
      'J1',
    ])
    expect(feed(null, null)).toEqual([])
  })

  it('reads a job by its status: F failed, C done, P with an error retrying, P without one queued', () => {
    expect(jobState(job(1, '', 'F'))).toBe('failed')
    expect(jobState(job(1, '', ' f '))).toBe('failed')
    expect(jobState(job(1, '', 'C'))).toBe('done')
    expect(jobState(job(1, '', 'P', { errorMessage: 'HTTP 503' }))).toBe('retrying')
    expect(jobState(job(1, '', 'P', { errorMessage: '  ' }))).toBe('queued')
    expect(jobState(job(1, '', 'P'))).toBe('queued')
  })

  it('a rewind strikes the earlier passes of Ready and Out, and is an amber rewind node', () => {
    // After DRSC the delivery is back at Created: Ready and Out are no longer reached.
    const doc = header({ lastAction: 'DRSC' })
    const steps = timeline(timelineInputFromHeader(doc, rescheduledLogs))
    const s = spine(steps, rescheduledLogs, rescheduledJobs)
    expect(s.past.map(shape)).toEqual([
      'job:9101:done',
      'rewind:rescheduled',
      'rewind:returned',
      'superseded:out',
      'superseded:ready',
      'job:9100:done',
      'milestone:created:current',
    ])
  })

  it('the latest pass of a step reached twice is its milestone; the earlier pass is struck', () => {
    const logs = [...rescheduledLogs, log(6, `${T}06:10:00`, 'DRDY')]
    const steps = timeline(timelineInputFromHeader(header({ readyStatus: 'R', lastAction: 'DRDY' }), logs))
    const past = spine(steps, logs, []).past
    expect(past.map(shape)).toEqual([
      'milestone:ready:current',
      'rewind:rescheduled',
      'rewind:returned',
      'superseded:out',
      'superseded:ready',
      'milestone:created:done',
    ])
    const milestone = past[0]
    expect(milestone.kind === 'milestone' && milestone.log?.logNo).toBe('6')
  })

  it('a cancellation request that was then carried out is an ordinary event, never struck', () => {
    const logs = [
      log(1, `${T}02:46:26`, 'DCRT'),
      log(2, `${T}03:10:02`, 'DRDY'),
      log(3, `${T}04:00:00`, 'DRCL'),
      log(4, `${T}05:00:00`, 'DCLS'),
    ]
    const steps = timeline(timelineInputFromHeader(header({ readyStatus: 'R', closeStatus: 'C' }), logs))
    expect(spine(steps, logs, []).past.map(shape)).toEqual([
      'milestone:cancelled:cancelled',
      'event:DRCL',
      'milestone:ready:done',
      'milestone:created:done',
    ])
  })

  it('cancelled after delivery: the delivery is a plain event, not an earlier pass — no rewind superseded it', () => {
    const logs = [
      log(1, `${T}02:46:26`, 'DCRT'),
      log(2, `${T}03:10:02`, 'DRDY'),
      log(3, `${T}03:40:51`, 'DOFD'),
      log(4, `${T}04:30:00`, 'DDLR'),
      log(5, `${T}06:00:00`, 'DCAD'),
    ]
    const steps = timeline(timelineInputFromHeader(header({ readyStatus: 'R', deliveryStatus: 'D', closeStatus: 'X' }), logs))
    expect(spine(steps, logs, []).past.map(shape)).toEqual([
      'milestone:cancelled:cancelled',
      'event:DDLR',
      'milestone:out:done',
      'milestone:ready:done',
      'milestone:created:done',
    ])
  })

  it('a pass is struck only when a rewind came after it: a later row of the same step alone is not one', () => {
    // Ready, then a transfer that is Ready again, with no rewind between: the earlier row is a plain event.
    const logs = [log(1, `${T}02:46:26`, 'DCRT'), log(2, `${T}03:10:02`, 'DRDY'), log(3, `${T}03:20:00`, 'DTXC')]
    const steps = timeline(timelineInputFromHeader(header({ readyStatus: 'R' }), logs))
    expect(spine(steps, logs, []).past.map(shape)).toEqual(['milestone:ready:current', 'event:DRDY', 'milestone:created:done'])
  })

  it('an open cancellation request is the requested milestone', () => {
    const logs = [log(1, `${T}02:46:26`, 'DCRT'), log(2, `${T}03:10:02`, 'DRDY'), log(3, `${T}04:00:00`, 'DRCL')]
    const steps = timeline(timelineInputFromHeader(header({ readyStatus: 'R', closeStatus: 'R' }), logs))
    expect(spine(steps, logs, []).past.map(shape)).toEqual([
      'milestone:requested:requested',
      'milestone:ready:done',
      'milestone:created:done',
    ])
  })

  it('notes are note rows; every other Log row is an event; every job is a small row too', () => {
    const logs = [
      log(1, `${T}02:46:26`, 'DCRT'),
      log(2, `${T}02:50:00`, 'DADN', { note: 'Call first' }),
      log(3, `${T}02:55:00`, 'DCST'),
    ]
    const jobs = [job(1, `${T}02:47:00`, 'F'), job(2, `${T}02:48:00`, 'P', { errorMessage: 'HTTP 503' })]
    const steps = timeline(timelineInputFromHeader(header({}), logs))
    expect(spine(steps, logs, jobs).past.map(shape)).toEqual([
      'event:DCST',
      'note',
      'job:2:retrying',
      'job:1:failed',
      'milestone:created:current',
    ])
  })

  it('a reached step with no Log row is still drawn, untimed, just above the step before it', () => {
    // Delivered with only DCRT and DOFD in the Log: Ready and Delivered have no row.
    const logs = [log(1, `${T}02:46:26`, 'DCRT'), log(2, `${T}03:00:00`, 'DADN'), log(3, `${T}04:00:00`, 'DOFD')]
    const steps = timeline(timelineInputFromHeader(header({ readyStatus: 'R', deliveryStatus: 'D' }), logs))
    const past = spine(steps, logs, []).past
    expect(past.map(shape)).toEqual([
      'milestone:delivered:done:untimed',
      'milestone:out:done',
      'note',
      'milestone:ready:done:untimed',
      'milestone:created:done',
    ])
    expect(past.filter((e) => e.kind === 'milestone' && !e.log).every((e) => e.at === null)).toBe(true)
  })

  it('before the Log loads the past is the reached steps alone, untimed, newest first', () => {
    const steps = timeline(timelineInputFromHeader(header({ readyStatus: 'R', deliveryStatus: 'O' })))
    expect(spine(steps, null, null).past.map(shape)).toEqual([
      'milestone:out:current:untimed',
      'milestone:ready:done:untimed',
      'milestone:created:done:untimed',
    ])
  })
})

describe('the spine around the Now line', () => {
  it('the unreached steps sit above Now, furthest first, the next one carrying its window', () => {
    const doc = header(
      { lastAction: 'DRSC' },
      { timeSlotDay: 'Monday', timeSlotDescription: '8pm - 10 pm', deliveryScheduleFromTime: '2025-03-05T23:56:36', deliveryScheduleToTime: '2025-03-05T23:56:36' },
    )
    const s = spine(timeline(timelineInputFromHeader(doc, rescheduledLogs)), rescheduledLogs, rescheduledJobs)
    expect(s.future.map((f) => [f.key, f.state, f.expectedWindow])).toEqual([
      ['delivered', 'later', null],
      ['out', 'later', null],
      ['ready', 'next', 'Monday, 8pm - 10 pm'],
    ])
  })

  it('a delivered or cancelled delivery has nothing above Now', () => {
    const delivered = timeline(timelineInputFromHeader(header({ readyStatus: 'R', deliveryStatus: 'D' }), []))
    expect(spine(delivered, [], []).future).toEqual([])
    const cancelled = timeline(timelineInputFromHeader(header({ readyStatus: 'R', closeStatus: 'C' }), []))
    expect(spine(cancelled, [], []).future).toEqual([])
  })

  it('one banner per F job, and one quiet line per P job with an error; both newest first', () => {
    const jobs = [
      job(1, `${T}09:15:13`, 'C'),
      job(2, `${T}09:30:06`, 'F', { errorMessage: 'SMS gateway timeout after 30s', attemptCount: 5 }),
      job(3, `${T}09:30:07`, 'F', { errorMessage: 'Customer not found in SGH (404)', attemptCount: 5 }),
      job(4, `${T}09:41:23`, 'P', { errorMessage: 'HTTP 503 Service Unavailable', attemptCount: 2 }),
      job(5, `${T}09:42:00`, 'P'),
    ]
    const s = spine([], [], jobs)
    expect(s.failed.map((j) => j.outboxId)).toEqual(['3', '2'])
    expect(s.retrying.map((j) => j.outboxId)).toEqual(['4'])
    expect(spine([], [], null)).toMatchObject({ failed: [], retrying: [], past: [] })
  })
})

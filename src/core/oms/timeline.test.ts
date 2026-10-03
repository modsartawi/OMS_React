/**
 * The Delivery timeline derivation (spec 380 D1, ticket 396; rulings 369 §1–§4, amended by 368).
 * Pure: a list row or a document header maps to one input, and the input maps to steps.
 */
import { describe, expect, it } from 'vitest'

import type { DeliveryDocumentModel } from '@/core/models/delivery-document'
import type { SdDocumentHeaderModel, SdDocumentHeaderStatusModel } from '@/core/models/sd-document'
import {
  dueTag,
  headerTimelineNow,
  rowTimelineNow,
  timeline,
  timelineInputFromHeader,
  timelineInputFromRow,
  timelineNow,
  type TimelineInput,
  type TimelineStep,
} from './timeline'

const row = (over: Partial<DeliveryDocumentModel> = {}): DeliveryDocumentModel =>
  ({
    deliveryNo: '80001294',
    deliveryType: 'Delivery',
    readyStatus: '',
    deliveryStatus: '',
    closeStatus: '',
    entryTime: '2026-10-02T14:42:00',
    outForDeliveryTime: '',
    actualDeliveryTime: '',
    rescheduled: false,
    rescheduledTime: '',
    amountDue: 0,
    ...over,
  }) as DeliveryDocumentModel

const header = (
  status: Partial<SdDocumentHeaderStatusModel> = {},
  over: Partial<SdDocumentHeaderModel> = {},
): SdDocumentHeaderModel =>
  ({
    documentNo: '1000000435',
    deliveryType: 'D',
    entryTime: '2026-10-02T14:42:00',
    amountDue: 0,
    status: { readyStatus: '', deliveryStatus: '', closeStatus: '', lastAction: '', ...status },
    ...over,
  }) as SdDocumentHeaderModel

const input = (over: Partial<TimelineInput> = {}): TimelineInput => ({
  pickInStore: false,
  readyStatus: '',
  deliveryStatus: '',
  closeStatus: '',
  times: {},
  rewind: null,
  slotWindow: '',
  ...over,
})

/** `key:state` per step — the shape a reader of the timeline sees. */
const shape = (steps: TimelineStep[]) => steps.map((s) => `${s.key}:${s.state}`)

describe('timelineReachedSteps', () => {
  it('a new delivery is Created, with every later step still ahead', () => {
    expect(shape(timeline(input()))).toEqual(['created:current', 'ready:next', 'out:later', 'delivered:later'])
  })

  it('Ready is reached on readyStatus R or C', () => {
    for (const readyStatus of ['R', 'C']) {
      expect(shape(timeline(input({ readyStatus })))).toEqual([
        'created:done',
        'ready:current',
        'out:next',
        'delivered:later',
      ])
    }
    // S (needs reschedule) is not Ready.
    expect(timelineNow(timeline(input({ readyStatus: 'S' }))).key).toBe('created')
  })

  it('Out for delivery is reached on deliveryStatus O', () => {
    expect(shape(timeline(input({ readyStatus: 'R', deliveryStatus: 'O' })))).toEqual([
      'created:done',
      'ready:done',
      'out:current',
      'delivered:next',
    ])
  })

  it('Delivered on deliveryStatus D completes the timeline', () => {
    expect(shape(timeline(input({ readyStatus: 'C', deliveryStatus: 'D' })))).toEqual([
      'created:done',
      'ready:done',
      'out:done',
      'delivered:done',
    ])
    expect(timelineNow(timeline(input({ deliveryStatus: 'D' }))).key).toBe('delivered')
  })

  it('a reached step marks every step before it done, whatever their own columns say', () => {
    expect(shape(timeline(input({ deliveryStatus: 'O' })))).toEqual([
      'created:done',
      'ready:done',
      'out:current',
      'delivered:next',
    ])
  })

  it('returned by driver (delivery status B, ready S) is back at Created', () => {
    expect(timelineNow(timeline(input({ readyStatus: 'S', deliveryStatus: 'B' }))).key).toBe('created')
  })

  it('pick-in-store skips Out for delivery and still ends Delivered', () => {
    expect(shape(timeline(input({ pickInStore: true, readyStatus: 'R' })))).toEqual([
      'created:done',
      'ready:current',
      'delivered:next',
    ])
    expect(shape(timeline(input({ pickInStore: true, readyStatus: 'R', deliveryStatus: 'D' })))).toEqual([
      'created:done',
      'ready:done',
      'delivered:done',
    ])
  })

  it('reads the codes trimmed and case-blind', () => {
    expect(timelineNow(timeline(input({ readyStatus: ' r ', deliveryStatus: 'o ' }))).key).toBe('out')
  })

  it('rowTimelineNow is the list row’s current step', () => {
    expect(rowTimelineNow(row())).toBe('created')
    expect(rowTimelineNow(row({ readyStatus: 'R', closeStatus: 'R' }))).toBe('requested')
    expect(rowTimelineNow(row({ deliveryType: 'PickInStore', readyStatus: 'R', deliveryStatus: 'D' }))).toBe('delivered')
  })

  it('the list row and the document header map to the same input', () => {
    const fromRow = timelineInputFromRow(row({ readyStatus: 'R', deliveryStatus: 'O' }))
    const fromHeader = timelineInputFromHeader(header({ readyStatus: 'R', deliveryStatus: 'O' }))
    expect(shape(timeline(fromRow))).toEqual(shape(timeline(fromHeader)))
    expect(timelineNow(timeline(fromRow)).key).toBe('out')
  })

  it('both mappers see pick-in-store: the header codes it P, the list row describes it', () => {
    expect(timelineInputFromHeader(header({}, { deliveryType: 'P' })).pickInStore).toBe(true)
    expect(timelineInputFromHeader(header({}, { deliveryType: 'D' })).pickInStore).toBe(false)
    expect(timelineInputFromRow(row({ deliveryType: 'PickInStore' })).pickInStore).toBe(true)
    expect(timelineInputFromRow(row({ deliveryType: 'P ' })).pickInStore).toBe(true)
    expect(timelineInputFromRow(row({ deliveryType: 'Delivery  ' })).pickInStore).toBe(false)
  })

  it('a header with no status block reads as Created, never a crash', () => {
    const doc = { deliveryType: 'D' } as SdDocumentHeaderModel
    expect(timelineNow(timeline(timelineInputFromHeader(doc))).key).toBe('created')
  })
})

// Ticket 402's seam: Delivery details' now-step badge and the list's Status word must agree on
// the same delivery. Each case states one delivery's status columns once and feeds them through
// both models' mappers.
describe('details header maps to the same now-step as the list row for the same delivery', () => {
  const cases: { name: string; status: Partial<SdDocumentHeaderStatusModel>; pickInStore?: boolean; now: string }[] = [
    { name: 'Created', status: {}, now: 'created' },
    { name: 'Ready', status: { readyStatus: 'R' }, now: 'ready' },
    { name: 'Ready (collected)', status: { readyStatus: 'C' }, now: 'ready' },
    { name: 'Out for delivery', status: { readyStatus: 'R', deliveryStatus: 'O' }, now: 'out' },
    { name: 'Delivered', status: { readyStatus: 'R', deliveryStatus: 'D' }, now: 'delivered' },
    { name: 'pick-in-store, ready', status: { readyStatus: 'R' }, pickInStore: true, now: 'ready' },
    { name: 'pick-in-store, delivered', status: { readyStatus: 'R', deliveryStatus: 'D' }, pickInStore: true, now: 'delivered' },
    { name: 'close R', status: { readyStatus: 'R', closeStatus: 'R' }, now: 'requested' },
    { name: 'close C', status: { closeStatus: 'C' }, now: 'cancelled' },
    { name: 'close N', status: { readyStatus: 'R', deliveryStatus: 'O', closeStatus: 'N' }, now: 'cancelled' },
    { name: 'close X', status: { readyStatus: 'R', deliveryStatus: 'D', closeStatus: 'X' }, now: 'cancelled' },
  ]

  for (const c of cases) {
    it(`${c.name} → ${c.now} on both surfaces`, () => {
      const doc = header(c.status, { deliveryType: c.pickInStore ? 'P' : 'D' })
      const listRow = row({ ...c.status, deliveryType: c.pickInStore ? 'PickInStore' : 'Delivery' })
      expect(headerTimelineNow(doc)).toBe(c.now)
      expect(rowTimelineNow(listRow)).toBe(c.now)
    })
  }

  it('pick-in-store skips Out on the details header too', () => {
    const doc = header({ readyStatus: 'R' }, { deliveryType: 'P' })
    expect(shape(timeline(timelineInputFromHeader(doc))).map((s) => s.split(':')[0])).toEqual([
      'created',
      'ready',
      'delivered',
    ])
  })

  it('a header with no status block is Created, never a crash', () => {
    expect(headerTimelineNow({ deliveryType: 'D' } as SdDocumentHeaderModel)).toBe('created')
  })
})

describe('cancellationReplacesNextStep', () => {
  it('closeStatus R puts Cancellation requested in place of the next step and drops the later ones', () => {
    expect(shape(timeline(input({ readyStatus: 'R', closeStatus: 'R' })))).toEqual([
      'created:done',
      'ready:done',
      'requested:requested',
    ])
    expect(timelineNow(timeline(input({ closeStatus: 'R' }))).key).toBe('requested')
  })

  it('closeStatus C, N and X give Cancelled', () => {
    for (const closeStatus of ['C', 'N', 'X']) {
      expect(shape(timeline(input({ closeStatus })))).toEqual(['created:done', 'cancelled:cancelled'])
    }
  })

  it('cancelled while out for delivery replaces Delivered', () => {
    expect(shape(timeline(input({ readyStatus: 'R', deliveryStatus: 'O', closeStatus: 'C' })))).toEqual([
      'created:done',
      'ready:done',
      'out:done',
      'cancelled:cancelled',
    ])
  })

  it('X after delivery reads Created → Ready → Out → Cancelled', () => {
    expect(shape(timeline(input({ readyStatus: 'C', deliveryStatus: 'D', closeStatus: 'X' })))).toEqual([
      'created:done',
      'ready:done',
      'out:done',
      'cancelled:cancelled',
    ])
    expect(timelineNow(timeline(input({ deliveryStatus: 'D', closeStatus: 'X' }))).key).toBe('cancelled')
  })

  it('pick-in-store cancelled after delivery reads Created → Ready → Cancelled', () => {
    expect(
      shape(timeline(input({ pickInStore: true, readyStatus: 'R', deliveryStatus: 'D', closeStatus: 'X' }))),
    ).toEqual(['created:done', 'ready:done', 'cancelled:cancelled'])
  })

  it('an unknown close code is not a cancellation', () => {
    expect(timelineNow(timeline(input({ closeStatus: 'Z' }))).key).toBe('created')
  })

  it('the header reads its close from the status block', () => {
    expect(timelineNow(timeline(timelineInputFromHeader(header({ closeStatus: 'R' })))).key).toBe('requested')
    expect(timelineNow(timeline(timelineInputFromRow(row({ closeStatus: 'N' })))).key).toBe('cancelled')
  })
})

describe('rowVariantTimesAndDueTag', () => {
  const delivered = row({
    readyStatus: 'C',
    deliveryStatus: 'D',
    entryTime: '2026-10-02T14:42:00',
    outForDeliveryTime: '2026-10-02T17:12:00',
    actualDeliveryTime: '2026-10-02T18:05:00',
  })

  it('only entryTime, outForDeliveryTime and actualDeliveryTime feed times', () => {
    const steps = timeline(timelineInputFromRow(delivered))
    expect(steps.map((s) => [s.key, s.time])).toEqual([
      ['created', '2026-10-02T14:42:00'],
      ['ready', null],
      ['out', '2026-10-02T17:12:00'],
      ['delivered', '2026-10-02T18:05:00'],
    ])
  })

  it('a step not reached shows no time, even when its row field holds one', () => {
    // DCHC overwrites outForDeliveryTime while it clears the statuses.
    const steps = timeline(timelineInputFromRow(row({ readyStatus: 'R', outForDeliveryTime: '2026-10-02T17:12:00' })))
    expect(steps.find((s) => s.key === 'out')?.time).toBeNull()
  })

  it('a blank or 0001-01-01 field is no time, never a guess', () => {
    const steps = timeline(timelineInputFromRow(row({ entryTime: '0001-01-01T00:00:00' })))
    expect(steps[0].time).toBeNull()
    expect(timeline(timelineInputFromRow(row({ entryTime: '' })))[0].time).toBeNull()
  })

  it('the cancellation step has no time on the row variant', () => {
    const steps = timeline(timelineInputFromRow(row({ closeStatus: 'C' })))
    expect(steps.at(-1)).toMatchObject({ key: 'cancelled', time: null })
  })

  it('X after delivery keeps Out’s time and drops Delivered’s', () => {
    const steps = timeline(timelineInputFromRow({ ...delivered, closeStatus: 'X' }))
    expect(steps.map((s) => [s.key, s.time])).toEqual([
      ['created', '2026-10-02T14:42:00'],
      ['ready', null],
      ['out', '2026-10-02T17:12:00'],
      ['cancelled', null],
    ])
  })

  it('the rewind marker comes from rescheduled, on the step it fell back to: Created', () => {
    const marker = { kind: 'rescheduled', time: '2026-10-02T15:30:00' }
    const steps = timeline(timelineInputFromRow(row({ rescheduled: true, rescheduledTime: '2026-10-02T15:30:00' })))
    expect(steps.map((s) => s.marker)).toEqual([marker, null, null, null])
    // The flag is sticky: once the delivery has moved on, the marker still sits where it fell back.
    const movedOn = timeline(
      timelineInputFromRow({ ...delivered, rescheduled: true, rescheduledTime: '2026-10-02T15:30:00' }),
    )
    expect(movedOn.map((s) => s.marker)).toEqual([marker, null, null, null])
    const cancelled = timeline(
      timelineInputFromRow(row({ readyStatus: 'R', closeStatus: 'C', rescheduled: true, rescheduledTime: '2026-10-02T15:30:00' })),
    )
    expect(cancelled.map((s) => s.marker)).toEqual([marker, null, null])
  })

  it('no rescheduled flag, no marker — whatever lastAction says on the row', () => {
    const steps = timeline(timelineInputFromRow(row({ lastAction: 'DRSC', rescheduledTime: '2026-10-02T15:30:00' })))
    expect(steps.every((s) => s.marker === null)).toBe(true)
  })

  it('a rewind the row cannot date shows no marker — the marker needs the action’s time', () => {
    for (const rescheduledTime of ['', '0001-01-01T00:00:00']) {
      const steps = timeline(timelineInputFromRow(row({ readyStatus: 'R', rescheduled: true, rescheduledTime })))
      expect(steps.every((s) => s.marker === null)).toBe(true)
    }
  })

  it('the header variant names its rewind from lastAction, but has no times — or marker — until the Log feeds it', () => {
    const cases = [
      ['DRBK', 'returned'],
      ['DRSC', 'rescheduled'],
      ['DCHC', 'courierChanged'],
    ] as const
    for (const [lastAction, kind] of cases) {
      const input = timelineInputFromHeader(header({ lastAction }))
      expect(input.rewind).toEqual({ kind, time: null })
      expect(timeline(input).every((s) => s.marker === null)).toBe(true)
    }
    expect(timelineInputFromHeader(header({ lastAction: 'DOFD' })).rewind).toBeNull()
    expect(timeline(timelineInputFromHeader(header())).every((s) => s.time === null)).toBe(true)
  })

  it('the due tag reads Due 72.50 while amountDue > 0, and Paid at 0', () => {
    expect(dueTag(row({ amountDue: 72.5 }).amountDue)).toEqual({ paid: false, amount: '72.50' })
    expect(dueTag(header({}, { amountDue: 72.5 }).amountDue)).toEqual({ paid: false, amount: '72.50' })
    expect(dueTag(0)).toEqual({ paid: true })
  })

  it('a due that rounds to 0.00, a negative due or no amount reads Paid', () => {
    expect(dueTag(0.004)).toEqual({ paid: true })
    expect(dueTag(-5)).toEqual({ paid: true })
    expect(dueTag(null)).toEqual({ paid: true })
    expect(dueTag(undefined)).toEqual({ paid: true })
  })
})

describe('nextStepExpectation', () => {
  const scheduled = {
    deliveryScheduleFromTime: '2026-10-02T10:00:00',
    deliveryScheduleToTime: '2026-10-02T12:00:00',
    timeSlotDay: 'Thursday',
    timeSlotDescription: '10am - 12 pm',
  }

  it('the next step, and only it, carries the window as an expectation', () => {
    const steps = timeline(timelineInputFromRow(row({ readyStatus: 'R', ...scheduled })))
    expect(steps.map((s) => [s.key, s.state, s.expectedWindow])).toEqual([
      ['created', 'done', null],
      ['ready', 'current', null],
      ['out', 'next', '10:00–12:00'],
      ['delivered', 'later', null],
    ])
  })

  it('reads deliveryWindow(), never the raw schedule: From == To falls back to the slot', () => {
    const capture = row({
      deliveryScheduleFromTime: '2025-03-05T23:56:36.389',
      deliveryScheduleToTime: '2025-03-05T23:56:36.389',
      timeSlotDay: 'Monday',
      timeSlotDescription: '8pm - 10 pm',
    })
    const next = timeline(timelineInputFromRow(capture)).find((s) => s.state === 'next')
    expect(next?.expectedWindow).toBe('Monday, 8pm - 10 pm')
  })

  it('no window, no expectation', () => {
    const steps = timeline(timelineInputFromRow(row({ deliveryScheduleFromTime: '0001-01-01T00:00:00' })))
    expect(steps.every((s) => s.expectedWindow === null)).toBe(true)
  })

  it('a delivered or cancelled timeline has no next step, so no expectation', () => {
    for (const over of [{ deliveryStatus: 'D' }, { closeStatus: 'R' }, { closeStatus: 'C' }]) {
      const steps = timeline(timelineInputFromRow(row({ ...scheduled, ...over })))
      expect(steps.every((s) => s.expectedWindow === null)).toBe(true)
    }
  })

  it('the header variant reads the same window', () => {
    expect(timelineInputFromHeader(header({}, scheduled)).slotWindow).toBe('10:00–12:00')
  })
})

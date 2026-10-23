import type {
  DeliveryCalloutHistory,
  DeliveryCalloutRecord,
  DispatchCalloutEvent,
} from '@/core/models/delivery-callout'
import type { DispatchBid } from '@/core/models/dispatch-board'
import { entryTimeValue, realTime } from '@/core/oms/timeline'

// A delivery's callout moments (BackOffice spec 2952, oms ticket 542; 2950 Answer point 2): points on
// the Delivery details spine taken from the callout history door's raw `CalloutEvent` log and its bids,
// beside the donor moments (`./donor-moments`) and merged into the spine's past by `./timeline-feed`.
// Pure: no React, no `t` — each kind's words live in the `document` namespace under `callout.moment.*`.

/**
 * What a moment says. The callout's own opening (`opened`) and the till opening a bid's sheet
 * (`bidOpened`) are two kinds. Took / awarded elsewhere / passed / bid expired / withdrawn / lock
 * released are kept apart: each tells a different story about a store.
 */
export const CALLOUT_MOMENTS = [
  'opened',
  'delivered',
  'shown',
  'bidOpened',
  'dismissed',
  /** A Take that won the award (`Won` / `AlreadyYours`). */
  'took',
  /** A Take that lost the race (`AwardedElsewhere`). */
  'awardedElsewhere',
  'passed',
  /** A Take or Pass that arrived after the callout had closed (`Expired` / `Withdrawn`). */
  'answeredLate',
  /** A Take or Pass with an answer this client does not know. */
  'answered',
  /** `Unanswered`: nobody took it, and it fell back to the fallback store. */
  'fellBack',
  'withdrawn',
  'lockReleased',
  'fallbackFailed',
  'fallbackDelivered',
  'fallbackShown',
  'fallbackOpened',
  'fallbackDismissed',
  /** A bid that closed unanswered, with its `ignoreReason` (from the bid, not an event). */
  'bidExpired',
  /** A competed type's delivery that was never put to a callout (`NOT_OPENED`), with its reason. */
  'notCompeted',
  /** An event kind this client does not know: shown as itself. */
  'other',
] as const
export type CalloutMomentKind = (typeof CALLOUT_MOMENTS)[number]

export interface CalloutMoment {
  kind: CalloutMomentKind
  /** A real time, or `null` when the server sent none (it then sinks to the oldest end). */
  at: string | null
  /** Its place in the callout's own story (server order), to order moments of one instant. */
  seq: number
  callout: DeliveryCalloutRecord
  /** The bid the moment is about, when it is about one. */
  bid: DispatchBid | null
  event: DispatchCalloutEvent | null
  /** The store: the event's party, else its bid's store. */
  party: string
  staff: string
  register: string
  /** The answer, end reason, ignore reason, not-competed reason, release reason or fault. */
  reason: string
  /** A lock release's note. */
  note: string
  /** The raw event kind (or bid status), as it came. */
  raw: string
}

const EVENT_MOMENT: Record<string, CalloutMomentKind> = {
  Opened: 'opened',
  Delivered: 'delivered',
  Shown: 'shown',
  BidOpened: 'bidOpened',
  Dismissed: 'dismissed',
  Unanswered: 'fellBack',
  Withdraw: 'withdrawn',
  LockReleased: 'lockReleased',
  FallbackFailed: 'fallbackFailed',
  FallbackDelivered: 'fallbackDelivered',
  FallbackShown: 'fallbackShown',
  FallbackOpened: 'fallbackOpened',
  FallbackDismissed: 'fallbackDismissed',
}

/** A Take / Pass reads by its answer (`CalloutAnswer`). */
function answerMoment(answer: string): CalloutMomentKind {
  switch (answer) {
    case 'Won':
    case 'AlreadyYours':
      return 'took'
    case 'AwardedElsewhere':
      return 'awardedElsewhere'
    case 'YouPassed':
      return 'passed'
    case 'Expired':
    case 'Withdrawn':
      return 'answeredLate'
    default:
      return 'answered'
  }
}

/** `"reason"` or `"reason: note"` — the note may hold colons of its own. */
function splitRelease(detail: string): { reason: string; note: string } {
  const at = detail.indexOf(':')
  return at === -1
    ? { reason: detail.trim(), note: '' }
    : { reason: detail.slice(0, at).trim(), note: detail.slice(at + 1).trim() }
}

function eventMoment(callout: DeliveryCalloutRecord, event: DispatchCalloutEvent, seq: number): CalloutMoment {
  const raw = event.kind ?? ''
  const bid = event.bidId ? ((callout.bids ?? []).find((b) => b.bidId === event.bidId) ?? null) : null
  const detail = (event.detail ?? '').trim()
  const kind = raw === 'Take' || raw === 'Pass' ? answerMoment(detail) : (EVENT_MOMENT[raw] ?? 'other')
  const release =
    kind === 'lockReleased'
      ? detail
        ? splitRelease(detail)
        : {
            reason: callout.releaseReason ?? '',
            note: callout.releaseNote ?? '',
          }
      : null
  return {
    kind,
    at: realTime(event.at),
    seq,
    callout,
    bid,
    event,
    party: event.party || bid?.store || '',
    staff: event.staff ?? '',
    register: event.register ?? '',
    reason: release ? release.reason : detail,
    note: release ? release.note : '',
    raw,
  }
}

const byTimeThenSeq = (a: CalloutMoment, b: CalloutMoment) =>
  entryTimeValue(a.at) - entryTimeValue(b.at) || a.seq - b.seq

/**
 * Every moment of every callout, oldest first. Each raw event gives one moment; each bid that
 * closed EXPIRED adds one more, with its `ignoreReason`, when it closed (else when the callout
 * ended). A not-competed callout (`NOT_OPENED`) gives exactly one moment, its reason.
 */
export function calloutMoments(callouts: readonly DeliveryCalloutRecord[] | null | undefined): CalloutMoment[] {
  return (callouts ?? []).flatMap((callout) => {
    if (callout.status === 'NOT_OPENED') {
      return [
        {
          kind: 'notCompeted' as const,
          at: realTime(callout.openedAt) ?? realTime(callout.endedAt),
          seq: 0,
          callout,
          bid: null,
          event: null,
          party: callout.fallbackParty ?? '',
          staff: '',
          register: '',
          reason: callout.endReason ?? '',
          note: '',
          raw: callout.status,
        },
      ]
    }
    const events = callout.events ?? []
    const fromEvents = events.map((event, i) => eventMoment(callout, event, i))
    const expired = (callout.bids ?? [])
      .filter((bid) => bid.status === 'EXPIRED')
      .map((bid, i): CalloutMoment => ({
        kind: 'bidExpired',
        at: realTime(bid.closedAt) ?? realTime(callout.endedAt),
        seq: events.length + i,
        callout,
        bid,
        event: null,
        party: bid.store,
        staff: '',
        register: '',
        reason: bid.ignoreReason ?? '',
        note: '',
        raw: bid.status,
      }))
    return [...fromEvents, ...expired].sort(byTimeThenSeq)
  })
}

/** Newest first; at one instant the later in the callout's story first. */
export function compareCalloutMoments(a: CalloutMoment, b: CalloutMoment): number {
  return entryTimeValue(b.at) - entryTimeValue(a.at) || b.seq - a.seq
}

/** The callouts still open: each gets an "On callout" line above Now, with its countdown. */
export function onCallout(callouts: readonly DeliveryCalloutRecord[] | null | undefined): DeliveryCalloutRecord[] {
  return (callouts ?? []).filter((c) => c.status === 'OPEN')
}

/** The callout that locks the delivery now (taken or fell back, never released), or `null`. */
export function lockedCallout(
  callouts: readonly DeliveryCalloutRecord[] | null | undefined,
): DeliveryCalloutRecord | null {
  return (callouts ?? []).find((c) => c.locked === true) ?? null
}

/** The door's answer as a list, a missing list read as an empty one. */
export function calloutsOf(history: DeliveryCalloutHistory | null | undefined): DeliveryCalloutRecord[] {
  return (history?.callouts ?? []).map((c) => ({
    ...c,
    bids: c.bids ?? [],
    events: c.events ?? [],
  }))
}

/** One row of the raw event log: the event as it came, and its seconds from the callout opening. */
export interface CalloutLogRow {
  event: DispatchCalloutEvent
  seconds: number | null
}

/** The raw `CalloutEvent` log, for disputes: server order, untouched, each with its offset. */
export function calloutLog(callout: DeliveryCalloutRecord): CalloutLogRow[] {
  const start = entryTimeValue(callout.openedAt)
  return (callout.events ?? []).map((event) => {
    const at = entryTimeValue(event.at)
    return {
      event,
      seconds: Number.isFinite(start) && Number.isFinite(at) ? Math.round((at - start) / 1000) : null,
    }
  })
}

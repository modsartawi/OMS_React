import type { DonorRequestModel, SdDocumentOutboxModel } from '@/core/models/sd-document'
import { entryTimeValue, realTime } from '@/core/oms/timeline'

// A delivery's donor moments (ticket 429): points on the Delivery timeline taken from a donor
// request's own record, not from the delivery's Log. Beside `timeline-feed.ts`, which merges them
// into the spine's past. Pure: no React, no `t`.

/** The moments a donor request can carry, in the order they happen. */
export const DONOR_MOMENTS = ['raised', 'edited', 'picked', 'stamped', 'transferred', 'ended'] as const
export type DonorMomentKind = (typeof DONOR_MOMENTS)[number]

/** Each moment's time field on the request. */
const MOMENT_TIME: Record<DonorMomentKind, keyof DonorRequestModel> = {
  raised: 'raisedAt',
  edited: 'changedAt',
  picked: 'fulfilledAt',
  stamped: 'lockedAt',
  transferred: 'transferredAt',
  ended: 'outcomeAt',
}

export interface DonorMoment {
  kind: DonorMomentKind
  /** Always a real time: a moment whose time is unset is no moment. */
  at: string
  request: DonorRequestModel
}

/**
 * One point per time a request has set, oldest moment first. Each time is the latest one only
 * (the server keeps no repick or edit history). A cancelled request stays as history, and one
 * cancelled after it was transferred (reversed by hand) gives both Transferred and Ended. There
 * is no "transfer started" moment: the DRTR job row covers it.
 */
export function donorMoments(requests: readonly DonorRequestModel[] | null | undefined): DonorMoment[] {
  return (requests ?? []).flatMap((request) =>
    DONOR_MOMENTS.flatMap((kind): DonorMoment[] => {
      const at = realTime(request[MOMENT_TIME[kind]] as string | null | undefined)
      return at ? [{ kind, at, request }] : []
    }),
  )
}

/** Newest first; at one time the later moment first, then the higher request number. */
export function compareDonorMoments(a: DonorMoment, b: DonorMoment): number {
  return (
    entryTimeValue(b.at) - entryTimeValue(a.at) ||
    DONOR_MOMENTS.indexOf(b.kind) - DONOR_MOMENTS.indexOf(a.kind) ||
    (b.request.requestNo ?? '').localeCompare(a.request.requestNo ?? '', undefined, { numeric: true })
  )
}

/** How an Ended moment reads: its outcome, or `null` when the server sent none. */
export type DonorOutcome = 'cancelled' | 'refused' | 'expired'

export function donorOutcome(request: DonorRequestModel): DonorOutcome | null {
  switch ((request.outcome ?? '').trim().toUpperCase()) {
    case 'CANCELLED':
      return 'cancelled'
    case 'REFUSED':
      return 'refused'
    case 'EXPIRED':
      return 'expired'
    default:
      return null
  }
}

/**
 * The requests still waiting on their donor: OPEN, not picked and not ended. Each gets its own
 * "Waiting on donor" line above Now, oldest raised first.
 */
export function waitingOnDonor(requests: readonly DonorRequestModel[] | null | undefined): DonorRequestModel[] {
  return (requests ?? [])
    .filter(
      (r) =>
        (r.state ?? '').trim().toUpperCase() === 'OPEN' && !realTime(r.fulfilledAt) && !realTime(r.outcomeAt),
    )
    .sort((a, b) => entryTimeValue(a.raisedAt) - entryTimeValue(b.raisedAt))
}

/** The request a job was raised for: its `documentNo` is the request's number (the DRTR transfer). */
export function donorOfJob(
  job: SdDocumentOutboxModel,
  requests: readonly DonorRequestModel[] | null | undefined,
): DonorRequestModel | null {
  const no = (job.documentNo ?? '').trim()
  if (!no) return null
  return (requests ?? []).find((r) => (r.requestNo ?? '').trim() === no) ?? null
}

/** Whole days, hours and minutes from `from` to `now`; a time in the future is no time at all. */
export interface Elapsed {
  days: number
  hours: number
  minutes: number
}

export function elapsedSince(from: string | null | undefined, now: number): Elapsed | null {
  const start = entryTimeValue(from)
  if (!Number.isFinite(start)) return null
  const total = Math.floor(Math.max(0, now - start) / 60_000)
  return { days: Math.floor(total / 1440), hours: Math.floor((total % 1440) / 60), minutes: total % 60 }
}

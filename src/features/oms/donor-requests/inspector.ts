/**
 * The donor request inspector (ticket 432, spec 430 D9/D10): one list row turned into what the
 * pane beside the grid shows. Pure: no React, no `t`.
 *
 * It draws from the row alone and never fetches, so stepping through rows is free. The moments
 * are `@/core/oms`'s donor moments — the same points the Delivery timeline draws — but their
 * presentation is this feature's own: the timeline's components belong to the `document` feature.
 */
import type { DonorRequestModel, DonorRequestState } from '@/core/models/sd-document'
import { donorHost, type DonorHost } from '@/core/oms/donor-host'
import { compareDonorMoments, donorMoments, type DonorMomentKind } from '@/core/oms/donor-moments'
import { realTime } from '@/core/oms/timeline'
import { DONOR_REQUEST_STATES } from './criteria'
import { donorRow, type DonorRowView } from './donor-row'

/** Who did each moment, where the request records one (the server keeps no picker or transferrer). */
const MOMENT_BY: Partial<Record<DonorMomentKind, keyof DonorRequestModel>> = {
  raised: 'raisedBy',
  edited: 'changedBy',
  stamped: 'lockedBy',
  ended: 'outcomeBy',
}

export interface DonorInspectorMoment {
  kind: DonorMomentKind
  at: string
  /** The user it records; `''` when the request records none. */
  by: string
}

export interface DonorInspectorView {
  requestNo: string
  deliveryNo: string
  /** What the request was raised on (spec 3242): a delivery, or another host named in the server's words. */
  host: DonorHost
  donorStore: string
  orderStore: string
  /** The state when this side knows it; `null` for any other, which `stateRaw` keeps. */
  state: DonorRequestState | null
  stateRaw: string
  /** The list's own reading of the row: outcome, tone, wait, cancelled-after-pick, minutes to pick. */
  row: DonorRowView
  reason: string
  asked: number
  given: number
  /** The stock movement, once the request is transferred; `null` before. */
  transfer: { stoNo: string; sapDocumentNo: string } | null
  /** Newest first. */
  moments: DonorInspectorMoment[]
  /** Document Details' delivery route; `null` when the request names no delivery — or its host is not one (672). */
  openTo: string | null
}

const KNOWN_STATES: ReadonlySet<string> = new Set(DONOR_REQUEST_STATES)
const text = (value: unknown) => (typeof value === 'string' ? value.trim() : '')

/** Document Details' delivery route for a delivery number (D10); `null` for a blank one. */
export function deliveryPath(deliveryNo: string | null | undefined): string | null {
  const no = text(deliveryNo)
  return no ? `/oms/delivery/${encodeURIComponent(no)}` : null
}

/**
 * Where a request opens (D10): its delivery's route — only when its host IS a delivery (spec 3242, ticket 672). A
 * request on a session, a Wasfaty+ order or any other host has no page here; its key is shown as plain text.
 */
export function requestOpenPath(
  r: Pick<DonorRequestModel, 'deliveryNo' | 'sourceType'> | null | undefined,
): string | null {
  if (!r) return null
  return donorHost(r.sourceType, r.deliveryNo).isDelivery ? deliveryPath(r.deliveryNo) : null
}

export function donorInspector(r: DonorRequestModel, now: number): DonorInspectorView {
  const stateRaw = text(r.state)
  const norm = stateRaw.toUpperCase()
  const state = KNOWN_STATES.has(norm) ? (norm as DonorRequestState) : null
  // A request cancelled after its transfer (reversed by hand) was still transferred: its STO
  // is the one to trace. When it moved is its Transferred moment.
  const transferred = realTime(r.transferredAt) !== null || state === 'TRANSFERRED'
  const host = donorHost(r.sourceType, r.deliveryNo, r.hostLabel, r.hostLabelAr)
  const moments = donorMoments([r])
    .sort(compareDonorMoments)
    .map(({ kind, at }) => {
      const byField = MOMENT_BY[kind]
      return { kind, at, by: byField ? text(r[byField]) : '' }
    })
  return {
    requestNo: text(r.requestNo),
    deliveryNo: text(r.deliveryNo),
    host,
    donorStore: text(r.donorStore),
    orderStore: text(r.orderStore),
    state,
    stateRaw,
    row: donorRow(r, now),
    reason: text(r.outcomeReason),
    asked: r.required ?? 0,
    given: r.picked ?? 0,
    transfer: transferred
      ? { stoNo: text(r.transferStoNo), sapDocumentNo: text(r.transferSapDocumentNo) }
      : null,
    moments,
    // Only a delivery host has a page to open; another host's key is shown as plain text (672).
    openTo: requestOpenPath(r),
  }
}

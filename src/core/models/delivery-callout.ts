// Wire shapes for a delivery's callout history (BackOffice spec 2952; door 2964 — oms ticket 542).
//
// 🚩 The ONE source is BackOffice `Sartawi.Retail.Data\Modules\Callouts\Delivery\DispatchBoardModels.cs`
// (`DeliveryCalloutHistory`, `DeliveryCalloutRecord`, `DispatchCalloutEvent`), field for field in the
// camelCase ASP.NET Core emits. A record IS a `DispatchCallout` (541's shape, shared from
// `./dispatch-board`) plus its raw `CalloutEvent` log; nothing of the callout is re-declared here.
//
// `GET SdDocumentWeb/Delivery/{deliveryNo}/Callout`, on the Delivery details grant (`GatedByDetail`).
// A delivery never competed answers `callouts: []`. Times are local wall-clock, no offset.

import type { DispatchCallout, LocalDateTime } from './dispatch-board'

/** `CalloutEventKinds` (BackOffice `CalloutConstants.cs`). Open: a kind the server adds later still parses. */
export const CALLOUT_EVENT_KINDS = [
  // Callout-level (bidId ''):
  'Opened',
  'Unanswered',
  'Withdraw',
  'LockReleased',
  'FallbackFailed',
  'FallbackDelivered',
  'FallbackShown',
  'FallbackOpened',
  'FallbackDismissed',
  // Bid-level:
  'Delivered',
  'Shown',
  /** The till opened the bid's sheet. `Opened` is the callout's own opening. */
  'BidOpened',
  'Dismissed',
  'Take',
  'Pass',
] as const
export type CalloutEventKind = (typeof CALLOUT_EVENT_KINDS)[number] | (string & {})

/**
 * One raw `CalloutEvent`. `detail` carries: on `Take` / `Pass` the answer (`Won`, `AlreadyYours`,
 * `AwardedElsewhere`, `Expired`, `Withdrawn`, `YouPassed`); on `Unanswered` the end reason (`AllPassed` /
 * `Expired`); on `Withdraw` its outcome; on `LockReleased` `"reason"` or `"reason: note"`; on
 * `FallbackFailed` the fault; on `Opened` `parties=n;fallback=X`.
 */
export interface DispatchCalloutEvent {
  eventId: string
  at: LocalDateTime
  kind: CalloutEventKind
  /** `''` = a callout-level event. */
  bidId: string
  party: string
  staff: string
  register: string
  detail: string
}

/** A callout of the delivery with its raw event log, in server-time order. */
export interface DeliveryCalloutRecord extends DispatchCallout {
  events: DispatchCalloutEvent[]
}

/** `GET SdDocumentWeb/Delivery/{deliveryNo}/Callout` — every callout of the delivery (normally one), oldest first. */
export interface DeliveryCalloutHistory {
  asOf: LocalDateTime
  deliveryNumber: string
  callouts: DeliveryCalloutRecord[]
}

/** Why an EXPIRED bid went unanswered (`CalloutIgnoreReasons`). Only the last two count against people. */
export const CALLOUT_IGNORE_REASONS = [
  'NotReached',
  'ReachedNotShownNobodySignedIn',
  'ReachedNotShownOldBuild',
  'ShownNotOpened',
  'OpenedNotAnswered',
] as const

/** Why a competed type's delivery was not put to a callout (`CalloutNotOpenedReasons`): its `endReason`. */
export const CALLOUT_NOT_OPENED_REASONS = ['NoGps', 'NoCandidates', 'OneCandidate', 'StockLeftFewerThanTwo'] as const

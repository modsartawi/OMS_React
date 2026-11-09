// Wire shapes for the dispatch board's doors (BackOffice spec 2952; tickets 2959, 2964 — oms ticket 541).
//
// 🚩 The ONE source is BackOffice
// `Sartawi.Retail.Data\Modules\Callouts\Delivery\DispatchBoardModels.cs` (and `DeliveryCalloutLock.cs` for the
// release), field for field in the camelCase ASP.NET Core emits. Words are the callout's (BackOffice
// `CONTEXT.md` § Callout): callout, callout bid, Take, Pass, award, fallback, lock — never "offer".
//
// `DispatchCallout` and `DispatchBid` are SHARED: the delivery's callout history (542,
// `GET SdDocumentWeb/Delivery/{deliveryNo}/Callout`) is a list of the same callout plus its events, so 542
// imports them from here rather than re-declaring them.
//
// Times are local wall-clock with no offset (`yyyy-MM-ddTHH:mm:ss`); a moment never stamped arrives `null`.
// The status and outcome unions are open (`| string`), so a value the server adds later still parses
// and renders as itself.

/** A local wall-clock time, `yyyy-MM-ddTHH:mm:ss`, no offset. Never append a `Z`. */
export type LocalDateTime = string

/** `DispatchCallout.status` — the callout's own state. */
export type CalloutStatus = 'OPEN' | 'TAKEN' | 'UNANSWERED' | 'WITHDRAWN' | 'NOT_OPENED' | (string & {})

/** `DispatchCallout.outcome` — what the board shows. */
export const CALLOUT_OUTCOMES = ['Open', 'Taken', 'FellBack', 'Withdrawn', 'NotCompeted'] as const
export type CalloutOutcome = (typeof CALLOUT_OUTCOMES)[number] | (string & {})

/** `DispatchCallout.distanceMeasure` (BackOffice `CalloutDistanceMeasures`, spec 3460). `''` = no road measure. */
export type DistanceMeasure = '' | 'ROAD' | 'STRAIGHT_FALLBACK' | 'SHADOW' | (string & {})

/** The fallback reasons the client names (BackOffice `RoadDistanceFailureReasons`); another code shows as itself. */
export const DISTANCE_FALLBACK_REASONS = ['NOT_CONFIGURED', 'ERROR', 'TIMEOUT', 'QUOTA', 'KEY', 'HTTP_ERROR', 'BAD_RESPONSE'] as const
export type DistanceFallbackReason = (typeof DISTANCE_FALLBACK_REASONS)[number]

/** `DispatchBid.status`. */
export const BID_STATUSES = ['OPEN', 'TAKEN', 'PASSED', 'LOST', 'EXPIRED', 'WITHDRAWN'] as const
export type BidStatus = (typeof BID_STATUSES)[number] | (string & {})

/** One callout bid: the inspector's row (541) and the Callout sub-tab's ledger row (542). */
export interface DispatchBid {
  bidId: string
  store: string
  status: BidStatus
  offeredAt: LocalDateTime
  /** The km the decision used: road km on a `ROAD` callout, straight-line km otherwise (spec 3460). */
  distanceKm: number
  // Both measures (BackOffice spec 3460, door 3472; oms 858), filled on `ROAD` and `SHADOW` callouts. `0` = not
  // measured. Optional: a bid read before 3472 deployed carries neither.
  straightKm?: number
  roadKm?: number
  /** ATP at offer: `false` = no stock check (or it failed); else covers, or short by `atpShortLines`. */
  atpKnown: boolean
  atpCoversBasket: boolean
  atpShortLines: number
  onlineTills: number
  signedInTills: number
  /** No till of the store was online when the bid was offered. */
  dark: boolean
  deliveredAt: LocalDateTime | null
  deliveredRegister: string
  shownAt: LocalDateTime | null
  shownStaff: string
  shownRegister: string
  openedAt: LocalDateTime | null
  openedStaff: string
  openedRegister: string
  /** The first Take / Pass attempt (lost races included). */
  answeredAt: LocalDateTime | null
  answeredStaff: string
  answeredRegister: string
  closedAt: LocalDateTime | null
  ignoreReason: string
}

/** One callout, as the board and the delivery's Callout sub-tab show it. */
export interface DispatchCallout {
  calloutId: string
  deliveryNumber: string
  status: CalloutStatus
  outcome: CalloutOutcome
  /** `AllPassed` / `Expired` (fell back), `Withdrawn`, or the not-competed reason. */
  endReason: string
  openedAt: LocalDateTime
  expiresAt: LocalDateTime
  endedAt: LocalDateTime | null
  /** Open callouts only: seconds to expiry at `asOf` (0 once due, until the sweeper ends it). */
  secondsLeft: number | null
  candidateCount: number
  // The serving list and the duty check (BackOffice spec 3042, oms 572), stamped on opened and not-opened
  // callouts alike. Optional: a callout read before spec 3042 deployed carries none of the four, and reads
  // as no list and no duty removal.
  /** `''` when the delivery type had no serving list. */
  servingListId?: string
  /** `''` when the list is gone: show the id alone. */
  servingListNameEn?: string
  servingListNameAr?: string
  /** How many radius candidates the duty check took out. */
  dutyRemovedCount?: number
  /**
   * The radius behind the callout's result (BackOffice spec 3326, ticket 3333; oms 715): the type's, or its wider
   * one when the search widened. `0` = no radius search ran. Optional: a callout read before 3326 deployed has none.
   * Whether it widened is not on the door (the type's normal radius is not sent): never guess it here.
   */
  searchRadiusKm?: number
  /**
   * How the radius was measured (BackOffice spec 3460, door 3472; oms 858): `ROAD`, `STRAIGHT_FALLBACK` (Google
   * could not answer), `SHADOW` (road measured and recorded, decided by straight line), or `''` (no road measure:
   * an Off type). Optional: a callout read before 3472 deployed has none, and reads as today.
   */
  distanceMeasure?: DistanceMeasure
  /**
   * 🚩 NOT ON THE DOOR YET (BO ask, oms 858): the fallback's short code (`RoadDistanceFailureReasons`). The Callout
   * record holds it but `DispatchBoardService` does not map it. Absent → the label says plain "(fallback)".
   */
  distanceFallbackReason?: string
  /**
   * 🚩 NOT ON THE DOOR YET (BO ask, oms 858): whether the radius behind the result is the type's wider one. The
   * door sends no normal radius, so the client never infers it from km. Absent → no "widened" in the label.
   */
  searchWidened?: boolean
  locksDelivery: boolean
  /** The delivery is locked now: a locking callout, taken or fell back, never released, delivery not closed. */
  locked: boolean
  awardedParty: string
  awardedAt: LocalDateTime | null
  takenByStaff: string
  takenByDevice: string
  fallbackParty: string
  fallbackAt: LocalDateTime | null
  releasedAt: LocalDateTime | null
  releasedBy: string
  releaseReason: string
  releaseNote: string
  // The delivery, read by its key.
  channel: string
  deliveryType: string
  city: string
  cityCode: string
  district: string
  value: number
  lineCount: number
  // The courier quote and the express flag (BackOffice spec 3306, door 3311 — oms ticket 712). Optional: a
  // callout read before 3311 deployed carries none of the three, and reads as no quote and not express.
  /** An express delivery keeps its store once its OTO order exists: a Release lock frees no move. */
  isExpressDelivery?: boolean
  /**
   * On the wire since BackOffice commit 1d09a8d94 (spec 3306 branch, not yet on pricing2): `!isExpressDelivery`,
   * false = a Release lock frees no move, cancelling is the only way out. The client reads `isExpressDelivery`.
   */
  storeMoveAvailable?: boolean
  /** What OTO predicted for the assigned store; `null` = no quote yet. */
  courierQuote?: DispatchCourierQuote | null
  bids: DispatchBid[]
}

/** `DispatchCourierQuote.outcome`. `NoCourier` and `Failed` carry no company, price or ETA. */
export const COURIER_QUOTE_OUTCOMES = ['Quoted', 'NoCourier', 'Failed'] as const
export type CourierQuoteOutcome = (typeof COURIER_QUOTE_OUTCOMES)[number] | (string & {})

/**
 * A delivery's `DeliveryCourierQuote` row (spec 3306): a PREDICTION. Neither `NoCourier` nor `Failed` means the
 * order failed: the OTO order is created anyway, and the courier from status polling stays the truth.
 */
export interface DispatchCourierQuote {
  outcome: CourierQuoteOutcome
  checkedAt: LocalDateTime
  /** The store OTO was asked about. */
  storeCode: string
  deliveryCompanyName: string
  price: number
  currency: string
  /** OTO's own text: shown as it came, never parsed. */
  estimatedDeliveryDate: string
}

export interface DispatchBoardTiles {
  onCalloutNow: number
  /** Age of the oldest open callout; `null` when none is open. */
  oldestOpenAgeSeconds: number | null
  /** Bids still OPEN on an open callout, and how many of them went to a dark store. */
  bidsAwaiting: number
  bidsAwaitingDark: number
  takenLastHour: number
  /** Median of opened → taken over `takenLastHour`; `null` when nothing was taken. */
  medianSecondsToTake: number | null
  fellBack: number
  notCompeted: number
  withdrawn: number
}

/** `GET DispatchBoard/Board?channel=&city=&store=` — open callouts plus those ended in the last `windowMinutes`. */
export interface DispatchBoard {
  asOf: LocalDateTime
  windowMinutes: number
  tiles: DispatchBoardTiles
  /** Open callouts, the soonest to expire first. */
  open: DispatchCallout[]
  /** Callouts that ended in the window, the latest first. */
  closed: DispatchCallout[]
}

/** The board's filters, each optional (the door matches them case-insensitively). */
export interface DispatchBoardFilter {
  channel: string
  /** The delivery address's city, by code or name. */
  city: string
  /** A store holding a bid, or the store it was awarded / fell back to. */
  store: string
}

/** `GET DispatchBoard/Access` — cookie-only, never grant-gated. */
export interface DispatchBoardAccess {
  /** `BackOfficeScreen[DispatchBoard, Display]`. */
  canOpenDispatchBoard: boolean
  /** `BackOfficeScreen[DispatchBoard, Execute]`. */
  canReleaseLock: boolean
}

/** The release reasons the door knows (`CalloutReleaseReasons.All`). */
export const RELEASE_REASONS = ['NoStock', 'CustomerChange', 'StoreCannotFulfil', 'Other'] as const
export type ReleaseReason = (typeof RELEASE_REASONS)[number]

/** `POST DispatchBoard/ReleaseLock` body. The actor is the session's user, never a body field. */
export interface ReleaseLockRequest {
  deliveryNumber: string
  reason: ReleaseReason
  note?: string
}

/** `POST DispatchBoard/ReleaseLock` answer. */
export interface ReleaseLockResult {
  deliveryNumber: string
  calloutId: string
  /** The store the callout credits (the winner, else the fallback store), unchanged by the release. */
  heldBy: string
  releasedAt: LocalDateTime
  releasedBy: string
  reason: string
  note: string
}

/** The lock's refusal codes (`CalloutLockErrorCodes`). */
export const CALLOUT_LOCK_ERRORS = {
  /** A locked delivery refuses a change (the Sd guard). */
  locked: 'CALLOUT-101',
  /** Release without a known reason. */
  reasonRequired: 'CALLOUT-102',
  /** `Other` without a note. */
  noteRequired: 'CALLOUT-103',
  /** The delivery is not locked (already released, or closed). */
  notLocked: 'CALLOUT-104',
} as const

/**
 * `GET DispatchBoard/RoadShadow?from=&to=&type=` (BackOffice 3470, spec 3460 story 27; oms ticket 859) — what
 * deciding by road WOULD have changed on the deliveries a SHADOW type measured. Display, the board's read grant.
 * Mirrored field for field, camelCase, from BackOffice `CalloutRoadShadowReport` in
 * `Sartawi.Retail.Data/Modules/Callouts/Scorecard/CalloutRoadShadowReportService.cs` (checked on pricing2 at 7ec9609b8).
 * Counts only: no delivery, store or customer leaves the door.
 *
 * The range is the scorecard's: whole local days, both inclusive (absent = the last 30 days, at most 92), refused with
 * `CALLOUT-301` / `302` (`DISPATCH_SCORECARD_REFUSALS`). `type` '' = every delivery type.
 */
export interface RoadShadowQuery {
  from?: string
  to?: string
  type?: string
}

/** One `STRAIGHT_FALLBACK` reason (a `RoadDistanceFailureReasons` code) and its delivery count. */
export interface RoadShadowFallback {
  reason: string
  count: number
}

export interface RoadShadowReport {
  asOf: LocalDateTime
  from: LocalDateTime
  to: LocalDateTime
  type: string
  /** SHADOW callouts: measured by road, decided by straight line. */
  measured: number
  /** `STRAIGHT_FALLBACK` callouts of the range, by reason, most first. */
  fallbacks: RoadShadowFallback[]
  /** Road would have dropped a store that was offered. */
  roadWouldRemoveBids: number
  /** Road would have widened to the wider radius. */
  roadWouldWiden: number
  /** Would have raced where it did not, or the other way round. */
  competedWouldDiffer: number
  /** Shadow bids measured both ways (the median's population). */
  measuredBids: number
  /** Median road km / straight km over `measuredBids`, to 3 places; null when there are none. */
  medianRoadToStraightRatio: number | null
}

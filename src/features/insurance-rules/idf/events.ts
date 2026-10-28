/**
 * IDF events, pure (BackOffice spec 3157, door 3167; oms ticket 626). Each event is one IDF moment at a till: when,
 * where (store, till, transaction), for which insurer (its customer id), the item scanned and the item dispensed, the
 * tier and master (and its version) that decided, the decision, the outcome and the time it took.
 *
 * Doors as built (3167 + the 3157 review): outcomes are `reminder | forcedPickTaken | pickCancelled | lineAbandoned |
 * skippedByException | refusedPreAuth | alternativeTaken` (a swap through the alternative-item button's IDF picker),
 * plus two reserved for IDF requests (`requestRaised`, `autoApproved`): those have words, so a row that carries one
 * reads properly, but the outcome filter does not offer them until requests exist. `source` is the deciding tier as
 * the till spells it (`General | Insurer | Store | InsurerAtStoreList`); `decision` is `None | Reminder | ForcedPick`
 * (`None` on an `alternativeTaken`); `reason` is `allCandidatesDearer` on a reminder the price rule turned out of a
 * forced pick. `scannedUnitPrice` / `dispensedUnitPrice` are per BASE unit. Times are the till's local wall-clock.
 */

export const IDF_EVENT_OUTCOMES = [
  'reminder',
  'forcedPickTaken',
  'pickCancelled',
  'lineAbandoned',
  'skippedByException',
  'refusedPreAuth',
  'alternativeTaken',
  // reserved — IDF requests (spec 3157 open question 1)
  'requestRaised',
  'autoApproved',
] as const
export type IdfEventOutcome = (typeof IDF_EVENT_OUTCOMES)[number]

/** The outcomes the filter offers: every one but the reserved two. */
export const IDF_EVENT_FILTER_OUTCOMES = IDF_EVENT_OUTCOMES.filter(
  (o): o is Exclude<IdfEventOutcome, 'requestRaised' | 'autoApproved'> => o !== 'requestRaised' && o !== 'autoApproved',
)
export type IdfEventFilterOutcome = (typeof IDF_EVENT_FILTER_OUTCOMES)[number]

export const IDF_EVENT_DECISIONS = ['None', 'Reminder', 'ForcedPick'] as const
/** The only reason 3167 sends today. */
export const IDF_EVENT_REASONS = ['allCandidatesDearer'] as const

/** A row of `GET IdfPriority/events` (3167). Empty strings where the door has nothing to say. */
export interface IdfEvent {
  eventId: string
  store: string
  till?: string | null
  trxNumber?: string | null
  documentType?: string | null
  subDocumentType?: string | null
  insurerCustomerId?: string | null
  idfNumber?: string | null
  scannedItemNumber: string
  /** Empty when nothing replaced the scanned item. */
  dispensedItemNumber?: string | null
  source?: string | null
  /** Empty under the general master. */
  masterId?: string | null
  masterVersionId?: string | null
  priority?: number | null
  hardThreshold?: number | null
  reminderThreshold?: number | null
  decision?: string | null
  outcome: string
  reason?: string | null
  /** Per base unit. */
  scannedUnitPrice?: number | null
  /** Per base unit. */
  dispensedUnitPrice?: number | null
  decidedAt?: string | null
  occurredAt: string
  durationMs?: number | null
}

/** The door's `data` (3167): `{ page, pageSize, total, rows }`, newest first by `occurredAt`. */
export interface IdfEventsPage {
  page: number
  pageSize: number
  total: number
  rows: IdfEvent[]
}

/** The `insurance-idf` key of an outcome's word, or null for an outcome this build does not know. */
export function outcomeWordKey(outcome: string): string | null {
  return (IDF_EVENT_OUTCOMES as readonly string[]).includes(outcome) ? `events.outcome.${outcome}` : null
}

/** The `insurance-idf` key of a decision's word, or null for none / an unknown one. */
export function decisionWordKey(decision: string | null | undefined): string | null {
  return decision && (IDF_EVENT_DECISIONS as readonly string[]).includes(decision) ? `events.decision.${decision}` : null
}

/** The `insurance-idf` key of a reason's word, or null for none / an unknown one. */
export function reasonWordKey(reason: string | null | undefined): string | null {
  return reason && (IDF_EVENT_REASONS as readonly string[]).includes(reason) ? `events.reason.${reason}` : null
}

/** The till's `source` spelling (`InsurerAtStoreList`) as the lookup's tier word (`insurerAtStoreList`); null when blank. */
export function tierOfSource(source: string | null | undefined): string | null {
  return source ? source.charAt(0).toLowerCase() + source.slice(1) : null
}

/** Time spent as `m:ss` (a machine value); null when the door sent none. */
export function formatTimeSpent(seconds: number | null | undefined): string | null {
  if (seconds == null || !Number.isFinite(seconds) || seconds < 0) return null
  const s = Math.round(seconds)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

/** A duration in milliseconds (3167's `durationMs`, 3169's `averageDurationMs`) as `m:ss`. */
export function formatDurationMs(ms: number | null | undefined): string | null {
  return ms == null || !Number.isFinite(ms) ? null : formatTimeSpent(ms / 1000)
}

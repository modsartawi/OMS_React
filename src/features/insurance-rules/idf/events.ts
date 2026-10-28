/**
 * IDF events, pure (BackOffice spec 3157, door 3167; oms ticket 626). Each event is one IDF moment at a till: when,
 * where, for which payer, the item scanned and the item dispensed, the master (and its version) that decided, the
 * outcome and the time it took.
 *
 * Outcomes are the brief's six, plus two reserved for IDF requests (`requestRaised`, `autoApproved`): those have
 * words, so a row that carries one reads properly, but the outcome filter does not offer them until requests exist.
 */

export const IDF_EVENT_OUTCOMES = [
  'reminder',
  'forcedPickTaken',
  'pickCancelled',
  'lineAbandoned',
  'skippedByException',
  'refusedPreAuth',
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

/**
 * A row of `GET IdfPriority/events` (3167 finalises the spelling). `at` is local wall-clock, no `Z`. The item
 * dispensed is absent when nothing was dispensed (a cancelled pick, an abandoned line, a refusal).
 */
export interface IdfEvent {
  eventId: string
  at: string
  storeCode: string
  payerCode?: string | null
  documentType?: string | null
  itemScanned: string
  itemDispensed?: string | null
  masterId?: string | null
  masterVersion?: number | null
  outcome: string
  timeSpentSeconds?: number | null
}

/** The door's paged `data` (the house `Paged<T>` shape; 3167 finalises it). */
export interface IdfEventsPage {
  items: IdfEvent[]
  total: number
  page: number
  pageSize: number
}

/** The `insurance-idf` key of an outcome's word, or null for an outcome this build does not know. */
export function outcomeWordKey(outcome: string): string | null {
  return (IDF_EVENT_OUTCOMES as readonly string[]).includes(outcome) ? `events.outcome.${outcome}` : null
}

/** Time spent as `m:ss` (a machine value); null when the door sent none. */
export function formatTimeSpent(seconds: number | null | undefined): string | null {
  if (seconds == null || !Number.isFinite(seconds) || seconds < 0) return null
  const s = Math.round(seconds)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

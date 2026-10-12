import type { TFunction } from 'i18next'
import type { DeliverectHoursRow, DeliverectStoreAction, DeliverectStoreStatusBody } from '@/core/models/deliverect'
import { formatRange, fsi } from '@/core/util/bidi'

// A Deliverect store's status (spec 2615 "Store status"; contract § Store status, BackOffice 2625;
// ticket 481): the busy / close / reopen body, which action a state offers, the week of hours that
// was pushed, and the history's words. Pure: no React (`hoursLabel` takes the caller's `t`).

/** The door's three actions, in the order the dialog offers them. */
export const STATUS_ACTIONS: readonly DeliverectStoreAction[] = ['busy', 'close', 'reopen']

/**
 * A preparation delay as typed: a positive whole number of minutes (ASCII digits only — the field
 * is LTR and a machine value), else `null`. The contract names no ceiling, so none is invented.
 */
export function parseDelay(text: string): number | null {
  const t = text.trim()
  if (!/^\d+$/.test(t)) return null
  const n = Number(t)
  return Number.isSafeInteger(n) && n > 0 ? n : null
}

/**
 * The body of `POST StoreStatus/{store}`, or `null` when it may not be sent. `delayMinutes` is sent
 * for `busy` ONLY (contract: it "applies to busy only") and must be a positive whole number there;
 * for close and reopen the key is absent, whatever the delay field still holds.
 */
export function statusBody(action: DeliverectStoreAction, delayText: string, reason: string): DeliverectStoreStatusBody | null {
  if (action !== 'busy') return { action, reason }
  const delayMinutes = parseDelay(delayText)
  return delayMinutes === null ? null : { action, delayMinutes, reason }
}

/**
 * Whether the dialog offers `action` to a store in `state`: an open store is not reopened, and a
 * closed store is offered reopen ONLY — setting it busy would open it again for orders without
 * anyone choosing Reopen. A busy store may be set busy again (a new delay). A state the contract
 * does not name, or no status at all, offers every action — the server decides.
 */
export function actionOffered(state: string | null | undefined, action: DeliverectStoreAction): boolean {
  if (state === 'open') return action !== 'reopen'
  if (state === 'closed') return action === 'reopen'
  return true
}

/**
 * One day of the pushed hours as ONE string, for the caller to isolate once: the range built by
 * `formatRange` (`08:00–23:00`, a machine value — `Ltr`), and for an overnight shift that range
 * followed by the locale's "next day" (`08:00–02:00 next day` — a range written with words, so the
 * range is interpolated whole (`fsi`) and the caller renders the sentence in `<bdi>`). Never two
 * isolates around the range's ends (bidi rule).
 */
export function hoursLabel(t: TFunction, row: DeliverectHoursRow): string {
  const range = formatRange(row.open, row.close)
  return row.overnight ? t('hours.overnight', { range: fsi(range) }) : range
}

const DAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'] as const
type DayKey = Lowercase<(typeof DAYS)[number]>

/** A contract day (`"SUN"`) as its label key, or `null` for a value the contract does not show. */
export function dayKey(day: string): DayKey | null {
  return (DAYS as readonly string[]).includes(day) ? (day.toLowerCase() as DayKey) : null
}

/**
 * A history row's `action` as its label key. The contract shows busy / close / reopen; the spec's
 * log also records the hours push under a name the contract does not give, so any other value is
 * `null` and shown as sent.
 */
export function historyActionKey(action: string): DeliverectStoreAction | null {
  return (STATUS_ACTIONS as readonly string[]).includes(action) ? (action as DeliverectStoreAction) : null
}

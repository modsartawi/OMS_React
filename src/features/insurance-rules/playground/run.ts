import { localAsOf } from '@/core/insurance-rules/playground'

// The playground's run loop (oms ticket 678). Pure: no React, no http — the page hands it the door call.
// About 500 ms after the last edit the experiment runs by itself; an answer counts only when it belongs to the
// NEWEST request sent (latest-wins by a request sequence, not by arrival), so a slow older reply never overwrites
// a newer one.

/** The quiet window after the last edit before the experiment runs. */
export const RUN_DELAY_MS = 500

export { latestWins, type LatestWins, type RunSettle } from '@/core/insurance-rules/latest-wins'

const LOCAL_TEXT = /^(\d{4}-\d\d-\d\dT\d\d:\d\d)(?::(\d\d)(?:\.\d+)?)?$/

/**
 * "As of" as the door takes it: local wall-clock `yyyy-MM-ddTHH:mm:ss`, no `Z`, no offset. From a Date, or from the
 * date-time input's text (which drops `:ss` when the seconds are 0); anything else, or nothing, is now.
 */
export function asOfText(input?: Date | string | null, now: Date = new Date()): string {
  if (input instanceof Date) return localAsOf(input)
  const m = typeof input === 'string' ? LOCAL_TEXT.exec(input.trim()) : null
  return m ? `${m[1]}:${m[2] ?? '00'}` : localAsOf(now)
}

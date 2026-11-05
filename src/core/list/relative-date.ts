/**
 * A list search's relative Date (spec 380 / ticket 399; graduated from the Deliveries list's
 * `query-model.ts` at ticket 786, when the Order / ERX list became its second reader — a feature
 * may not import a feature).
 *
 * The query bar keeps the Date **relative** ("Last 3 days") and resolves it to a concrete From/To
 * only when a search runs, so a saved "Last 3 days" still means the last three days tomorrow (366).
 * Pure: no React, no i18n.
 */
import { fromIsoDate } from '@/core/util/date-format'

/** The Date entry's relative presets, and Custom: two days of the operator's own. */
export const DATE_PRESETS = ['today', 'yesterday', 'last3', 'last7', 'custom'] as const
export type DatePreset = (typeof DATE_PRESETS)[number]

/** One relative range. Custom holds its two days as `yyyy-MM-dd`; a blank end is `null`. */
export type DateEntry =
  | { preset: Exclude<DatePreset, 'custom'> }
  | { preset: 'custom'; from: string | null; to: string | null }

/** Local midnight, `days` before `now`'s own day. */
function dayBefore(now: Date, days: number): Date {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() - days)
}

/**
 * The Date entry as a concrete From/To against `now`, both at local midnight (the estate is
 * single-timezone local time, so no UTC round trip). `null` when there is no range to send:
 * no Date, or a Custom range missing an end — the search then sends neither, as the panel did.
 */
export function resolveDate(entry: DateEntry | null, now: Date): { from: Date; to: Date } | null {
  if (!entry) return null
  switch (entry.preset) {
    case 'today':
      return { from: dayBefore(now, 0), to: dayBefore(now, 0) }
    case 'yesterday':
      return { from: dayBefore(now, 1), to: dayBefore(now, 1) }
    case 'last3':
      return { from: dayBefore(now, 2), to: dayBefore(now, 0) }
    case 'last7':
      return { from: dayBefore(now, 6), to: dayBefore(now, 0) }
    case 'custom': {
      const from = fromIsoDate(entry.from)
      const to = fromIsoDate(entry.to)
      return from && to ? { from, to } : null
    }
  }
}

/** Whether a Date entry is one a search would send: set, and a Custom range with both ends. */
export function dateIsComplete(entry: DateEntry | null): boolean {
  if (entry === null) return false
  return entry.preset !== 'custom' || (fromIsoDate(entry.from) !== null && fromIsoDate(entry.to) !== null)
}

const isoDay = (value: unknown): string | null => (typeof value === 'string' && value.trim() ? value.trim() : null)

/**
 * A stored Date entry read back defensively (a saved view is a value a human can edit in
 * devtools): anything that is not a preset this module knows is no Date.
 */
export function dateEntryOf(value: unknown): DateEntry | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null
  const record = value as Record<string, unknown>
  if (!DATE_PRESETS.includes(record.preset as never)) return null
  if (record.preset === 'custom') return { preset: 'custom', from: isoDay(record.from), to: isoDay(record.to) }
  return { preset: record.preset as Exclude<DatePreset, 'custom'> }
}

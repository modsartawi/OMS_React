/**
 * A member's duty today, as the Members grid's duty column shows it (oms ticket 568, BackOffice spec 3042 —
 * duty semantics of 3046). Pure: no React, no i18n — it returns keys and values; the cell calls `t`.
 *
 * - `OnDuty` — a duty-checking callout opening now would bid the store: "On duty now" + today's hours.
 * - `OffDuty` — a roster holds today but the store is not on duty now: "Off duty now" + today's hours, or
 *   "Closed today" when `todayShifts` is empty (a valid roster with no row for today's weekday — HITL 3046,
 *   shown as Closed today either way).
 * - `NoRoster` — no roster row holds today: a duty-checking type never bids the store. A warning: it is the
 *   pilot's check before `CalloutDutyCheck` goes on.
 * - Anything else still renders: its raw value, muted, with whatever hours came.
 *
 * Each shift is ONE range string (`formatRange`), isolated once by the cell; an overnight shift's close is
 * tomorrow morning, which the cell marks with a word from the locale.
 */
import type { ServingListMemberRow } from '@/core/models/serving-list'
import type { Severity } from '@/core/ui/severity'
import { formatRange } from '@/core/util/bidi'

export type DutyCellState = 'onDuty' | 'offDuty' | 'closedToday' | 'noRoster' | 'unknown'

export interface DutyHours {
  /** `open–close`, local `HH:mm`, one string. */
  range: string
  /** The close is the next morning. */
  overnight: boolean
}

export interface DutyCellView {
  state: DutyCellState
  /** `serving-lists:` key, or null for a state this screen does not know (render `raw`). */
  labelKey: string | null
  raw: string
  sev: Severity
  hours: DutyHours[]
}

export function dutyCell(row: Pick<ServingListMemberRow, 'duty' | 'todayShifts'>): DutyCellView {
  const raw = row.duty ?? ''
  const hours = (row.todayShifts ?? []).map((s) => ({ range: formatRange(s.open, s.close), overnight: s.overnight === true }))
  switch (raw) {
    case 'OnDuty':
      return { state: 'onDuty', labelKey: 'duty.onDuty', raw, sev: 'ok', hours }
    case 'OffDuty':
      return hours.length === 0
        ? { state: 'closedToday', labelKey: 'duty.closedToday', raw, sev: 'mute', hours }
        : { state: 'offDuty', labelKey: 'duty.offDuty', raw, sev: 'mute', hours }
    case 'NoRoster':
      // No roster holds today, so there are no hours to show.
      return { state: 'noRoster', labelKey: 'duty.noRoster', raw, sev: 'warn', hours: [] }
    default:
      return { state: 'unknown', labelKey: null, raw, sev: 'mute', hours }
  }
}

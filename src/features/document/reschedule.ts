/**
 * Pure helpers for the Screen 2 Reschedule sub-flow.
 */
import type {
  RescheduleDocumentModel,
  TimeSlotModel,
  TimeSlotTimeModel,
} from '@/core/models/slots'

/**
 * Order two windows by start time. `slotFrom` is a datetime string; when both
 * parse, compare chronologically — a naive string sort hits the lexical pitfall
 * (`"14:00" < "9:00"`). Falls back to a locale compare for non-datetime values.
 */
function compareSlotFrom(a: string, b: string): number {
  const ta = Date.parse(a)
  const tb = Date.parse(b)
  if (!Number.isNaN(ta) && !Number.isNaN(tb) && ta !== tb) return ta - tb
  return (a ?? '').localeCompare(b ?? '')
}

/**
 * The selectable days. A non-urgent document sees only days with at least one
 * available (`status === true`) window; an urgent document sees every day.
 */
export function selectableDays(
  slots: readonly TimeSlotModel[],
  isUrgent: boolean,
): TimeSlotModel[] {
  if (isUrgent) return [...slots]
  return slots.filter((day) => (day.times ?? []).some((window) => window.status))
}

/**
 * The selectable windows for a day, ordered by start time. A non-urgent document
 * sees only available windows; an urgent document sees every window.
 */
export function selectableTimes(
  day: TimeSlotModel | null | undefined,
  isUrgent: boolean,
): TimeSlotTimeModel[] {
  const windows = [...(day?.times ?? [])].sort((a, b) => compareSlotFrom(a.slotFrom, b.slotFrom))
  return isUrgent ? windows : windows.filter((window) => window.status)
}

/**
 * Normalise a slot time to ISO 8601 — the format the server binds to the
 * model's `DateTime` fields. A value that does not parse passes through
 * unchanged, so the server surfaces the data issue rather than this silently
 * inventing a time (mirrors the WPF's `DateTime.Parse` step).
 */
export function slotTimeToIso(value: string | null | undefined): string {
  const raw = (value ?? '').trim()
  if (!raw) return ''
  const parsed = new Date(raw)
  return Number.isNaN(parsed.getTime()) ? raw : parsed.toISOString()
}

/** Assemble the reschedule request body from the picker selection. */
export function buildRescheduleModel(
  documentNo: string,
  day: TimeSlotModel,
  time: TimeSlotTimeModel,
  reasonCode: string | null | undefined,
): RescheduleDocumentModel {
  const reason = (reasonCode ?? '').trim()
  return {
    documentNo,
    slotDay: (day.fullDay ?? '').trim() || `${day.date ?? ''} ${day.day ?? ''}`.trim(),
    slotDescription: time.time,
    slotId: time.slotId,
    slotFromTime: slotTimeToIso(time.slotFrom),
    slotToTime: slotTimeToIso(time.slotTo),
    ...(reason ? { reasonCode: reason } : {}),
  }
}

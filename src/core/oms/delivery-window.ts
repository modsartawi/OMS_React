import type { DeliveryDocumentModel } from '@/core/models/delivery-document'
import { formatPair, formatRange } from '@/core/util/bidi'
import { formatShortDate, formatTimeOfDay, isBlankDate } from '@/core/util/date-format'

// A delivery's window: when it is scheduled to arrive. Born in the `document` feature's
// Fulfilment card (spec 083 D-7) and moved here at ticket 397, when the Deliveries list's
// inspector became its second reader: features never import each other, and the timeline's
// next-step expectation (spec 380 D1) reads it for both surfaces.

/**
 * The four fields a window is read from. The list row and the document header both carry
 * them under these names, so either satisfies this.
 */
export type ScheduleFields = Pick<
  DeliveryDocumentModel,
  'deliveryScheduleFromTime' | 'deliveryScheduleToTime' | 'timeSlotDay' | 'timeSlotDescription'
>

function text(value: string | null | undefined): string {
  return (value ?? '').trim()
}

/**
 * A schedule timestamp, or `null` when it is the .NET `DateTime.MinValue`
 * sentinel the API sends for every unset date. `isBlankDate` is imported rather
 * than re-spelled — two spellings of "unset" are how they start to disagree.
 */
function scheduledAt(value: string | null | undefined): Date | null {
  if (!text(value)) return null
  const date = new Date(value as string)
  return isBlankDate(date) ? null : date
}

/**
 * Whether the window comes from the schedule: both ends set and From strictly before To. A
 * live capture (`8000000121`) carries From == To == a capture timestamp, which is no window.
 * A surface isolates by it: the schedule's window is a machine value (`Ltr`), the slot's own
 * day and text are free text (`<bdi>`).
 */
export function hasScheduledWindow(src: ScheduleFields): boolean {
  const from = scheduledAt(src.deliveryScheduleFromTime)
  const to = scheduledAt(src.deliveryScheduleToTime)
  return from !== null && to !== null && from.getTime() < to.getTime()
}

/**
 * The **one** window (D-7). Rendering the slot and the schedule adjacently showed a
 * contradiction on `8000000174` (slot text `"8am - 12 am"` against a schedule of
 * 20:00–22:00) and a zero-length window on `8000000121` (From == To == a capture
 * timestamp), so one source wins:
 *
 * 1. the schedule when both ends are non-sentinel **and From `<` To** — strict,
 *    which is what makes the equal-timestamp case fall through rather than
 *    render a window of no length;
 * 2. otherwise the time slot (`timeSlotDay` + `timeSlotDescription`);
 * 3. otherwise blank.
 *
 * The malformed slot text and its disagreement with its own schedule are data
 * findings, not UI findings — this order means no surface shows the
 * disagreement, and it does not adjudicate which source is right.
 */
export function deliveryWindow(src: ScheduleFields): string {
  if (hasScheduledWindow(src)) {
    // ONE string, isolated once by the surface (spec 380 F27): an isolate per end
    // would lay the two ends out right-to-left.
    return formatRange(formatTimeOfDay(src.deliveryScheduleFromTime), formatTimeOfDay(src.deliveryScheduleToTime))
  }
  return [text(src.timeSlotDay), text(src.timeSlotDescription)].filter(Boolean).join(', ')
}

/**
 * The slot as a day and a window, ONE string for one isolate (ticket 397, 378 §3):
 * `02 Oct 2026 · 10:00–12:00` from a real schedule, else the slot's own day and text
 * (`Monday · 8pm - 10 pm`), else blank. The same source order as `deliveryWindow`.
 */
export function slotDayAndWindow(src: ScheduleFields): string {
  if (hasScheduledWindow(src)) return formatPair(formatShortDate(src.deliveryScheduleFromTime), deliveryWindow(src))
  return formatPair(text(src.timeSlotDay), text(src.timeSlotDescription))
}

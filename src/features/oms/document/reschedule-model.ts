/**
 * What the reschedule dialog chooses for the user, and when it lets them save (ticket 970,
 * BackOffice spec 4354: "a reason on every reschedule").
 *
 * The dialog opens with no reason chosen and does not save a move without one, as the store till
 * does: a pre-chosen reason would be counted as the user's answer, and the spec tells a customer's
 * move from ours by that reason.
 */
import type { TimeSlotModel, TimeSlotTimeModel } from '@/core/models/slots'

export interface RescheduleSelection {
  /** Index into the selectable days, as the day `<select>` holds it; `''` = none. */
  dayIndex: string
  /** The chosen reschedule reason; `''` = none chosen. */
  reasonCode: string
}

/**
 * Seed the selection once the lists land: the first day when none is chosen yet. The reason is
 * never seeded — it stays whatever the user chose, and on open that is nothing.
 */
export function seedReschedule(current: RescheduleSelection, dayCount: number): RescheduleSelection {
  return {
    dayIndex: current.dayIndex === '' && dayCount > 0 ? '0' : current.dayIndex,
    reasonCode: current.reasonCode,
  }
}

/** Save is on only with the lists loaded, a day, a time, and a chosen reason. */
export function canSaveReschedule(state: {
  ready: boolean
  day: TimeSlotModel | null
  time: TimeSlotTimeModel | null
  reasonCode: string
}): boolean {
  return state.ready && state.day !== null && state.time !== null && state.reasonCode.trim() !== ''
}

/**
 * The server's refusal of a move sent with no reason (BackOffice 4384: `SdDocumentScheduleErrorCodes.
 * RescheduleReasonRequired`, at both reschedule doors, before anything is written). Its own message is English
 * only, so the page words this one code itself; every other refusal keeps the server's own words.
 */
export const RESCHEDULE_REASON_REQUIRED = 'SDS-00054'

/** The `document` key that words a refusal code, or null to show the server's own message. */
export function rescheduleRefusalKey(code: string | null): string | null {
  return code === RESCHEDULE_REASON_REQUIRED ? 'reschedule.reasonRefused' : null
}

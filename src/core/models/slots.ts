/**
 * Slot & reschedule models for the Screen 2 Reschedule sub-flow.
 *
 * Returned by the Slot lookup endpoints and posted to the Reschedule endpoints.
 * C# `DateTime` maps to an ISO 8601 `string`.
 */

/** A single bookable time window within a day. */
export interface TimeSlotTimeModel {
  /** Human-readable label — e.g. `10:00 AM - 12:00 PM`. */
  time: string
  /** `true` when the window still has capacity; `false` when full. */
  status: boolean
  slotId: string
  /** Window start — a datetime string. */
  slotFrom: string
  /** Window end — a datetime string. */
  slotTo: string
}

/** A delivery day with its nested time windows. */
export interface TimeSlotModel {
  day: string
  date: string
  /** Server-computed `${date} ${day}` label — e.g. `2026/07/17 FRIDAY`. */
  fullDay: string
  times: TimeSlotTimeModel[]
}

/** The available-slots payload — a list of days. */
export interface TimeSlotsModel {
  slots: TimeSlotModel[]
}

/** A reschedule reason — the Reschedule picker's Reason dropdown. */
export interface SdDocumentRescheduleReasonModel {
  reasonCode: string
  reasonCategory: string
  reasonDescription: string
}

/**
 * Request body for `RescheduleDocument` / `RescheduleDelivery`. `slotFromTime` /
 * `slotToTime` are ISO 8601 datetime strings the server binds to `DateTime`.
 */
export interface RescheduleDocumentModel {
  documentNo: string
  referenceDocumentNo?: string
  slotFromTime: string
  slotToTime: string
  slotId: string
  slotDescription: string
  slotDay: string
  reasonCode?: string
}

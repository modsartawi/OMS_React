/**
 * The settings of a weight set that the screens name, by group, in the order shown (ticket 963; spec 4354 §10). In
 * `@/core/` because two features read it: the simulator's weight set panel edits these settings, and the weight-set list
 * (ticket 967) names them when it shows what differs between two versions — a feature may never import another.
 *
 * PROVISIONAL (spec 4354: not specified) — BackOffice 4360 names no key inside a set's document: every `key` here is
 * ours. A version that does not hold a key reads it at its starting value (4360: "a setting added by a later release is
 * read at its baseline value").
 */
export type WeightGroup = 'weights' | 'factors' | 'reach'

export type WeightControl =
  | { group: WeightGroup; key: string; kind: 'slider'; min: number; max: number; step: number; start: number; riyals?: boolean }
  | { group: WeightGroup; key: string; kind: 'switch'; start: boolean }

/** Each with its range and its starting value (4243 decision 19 where it gives one; the prototype's ranges). */
export const WEIGHT_CONTROLS: readonly WeightControl[] = [
  { group: 'weights', key: 'companyCostWeight', kind: 'slider', min: 0, max: 2, step: 0.25, start: 1 },
  { group: 'weights', key: 'feeWeight', kind: 'slider', min: 0, max: 2, step: 0.25, start: 1 },
  { group: 'weights', key: 'waitingPerHour', kind: 'slider', min: 0, max: 10, step: 0.5, start: 5, riyals: true },
  { group: 'weights', key: 'splitPenalty', kind: 'slider', min: 0, max: 10, step: 1, start: 0, riyals: true },
  { group: 'weights', key: 'mostShipments', kind: 'slider', min: 1, max: 3, step: 1, start: 3 },
  { group: 'weights', key: 'marginMultiplier', kind: 'slider', min: 0.5, max: 1.5, step: 0.25, start: 1 },
  { group: 'factors', key: 'buffer', kind: 'switch', start: true },
  { group: 'factors', key: 'stockConfidence', kind: 'switch', start: true },
  { group: 'factors', key: 'storeRecord', kind: 'switch', start: true },
  { group: 'reach', key: 'widerSlotReach', kind: 'switch', start: false },
  { group: 'reach', key: 'carrierModes', kind: 'switch', start: false },
  { group: 'reach', key: 'feePerOrder', kind: 'switch', start: false },
  { group: 'reach', key: 'pickUpInDeliveryPlan', kind: 'switch', start: false },
]

export const WEIGHT_GROUPS: readonly WeightGroup[] = ['weights', 'factors', 'reach']

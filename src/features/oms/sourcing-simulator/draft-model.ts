/**
 * The weight set panel's draft (ticket 963, BackOffice spec 4354 §10; 4281 decision 16; BackOffice 4243 decisions 19,
 * 26). Pure.
 *
 * A draft is unsaved simulator values: it lives in the browser and goes to the door in full. The panel opens on a saved
 * version, read whole; every setting the panel does not show is carried as read, so the draft is always the whole set.
 * A changed value marks "changed, not saved" and the request sends `{ draft: { basedOn, values } }`; with every value put
 * back it names the saved version again. "Save as a named set" sends the whole draft under a new name.
 *
 * There is no switch for pricing waiting on each shipment: waiting is priced on the last shipment (spec 4354 Further
 * Notes), so no such control exists here.
 */
import type { AdviseWeightSetRef, WeightSetSaveRequest, WeightSetValues, WeightSetVersion } from '@/core/models/sourcing-run'

export type WeightGroup = 'weights' | 'factors' | 'reach'

export type WeightControl =
  | { group: WeightGroup; key: string; kind: 'slider'; min: number; max: number; step: number; start: number; riyals?: boolean }
  | { group: WeightGroup; key: string; kind: 'switch'; start: boolean }

/**
 * The settings the panel edits, by group, in the order shown, each with its range and its starting value (4243
 * decision 19 where it gives one; the prototype's ranges).
 * PROVISIONAL (spec 4354: not specified) — BackOffice 4360 names no key inside a set's document: every `key` here is
 * ours. A version that does not hold a key reads it at its starting value.
 */
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

export interface WeightDraft {
  /** The saved version the panel opened on. */
  base: WeightSetVersion
  /** The whole set as it now stands. */
  values: WeightSetValues
}

export const openDraft = (base: WeightSetVersion): WeightDraft => ({ base, values: { ...base.values } })

/** A control's value: the set's, else its starting value. */
export function controlValue(values: WeightSetValues, control: WeightControl): number | boolean {
  const v = values[control.key]
  if (control.kind === 'slider') return typeof v === 'number' ? v : control.start
  return typeof v === 'boolean' ? v : control.start
}

export function setValue(draft: WeightDraft, key: string, value: number | boolean): WeightDraft {
  const control = WEIGHT_CONTROLS.find((c) => c.key === key)
  const values = { ...draft.values, [key]: value }
  // Put back to what the version reads, a key the version never held is dropped again, so the draft is unchanged.
  if (control && !(key in draft.base.values) && value === control.start) delete values[key]
  return { ...draft, values }
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

export function isChanged(draft: WeightDraft): boolean {
  const keys = new Set([...Object.keys(draft.base.values), ...Object.keys(draft.values)])
  return [...keys].some((k) => !same(draft.base.values[k], draft.values[k]))
}

/** How the request names the set: the saved version, or the draft in full. */
export function weightSetRef(draft: WeightDraft): AdviseWeightSetRef {
  const basedOn = { name: draft.base.name, version: draft.base.version }
  return isChanged(draft) ? { draft: { basedOn, values: { ...draft.values } } } : basedOn
}

/** The body of "save as a named set"; null for a blank name. */
export function saveRequest(draft: WeightDraft, name: string): WeightSetSaveRequest | null {
  const n = name.trim()
  if (!n) return null
  return { name: n, basedOn: { name: draft.base.name, version: draft.base.version }, values: { ...draft.values } }
}

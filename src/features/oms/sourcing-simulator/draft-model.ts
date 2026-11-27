/**
 * The weight set panel's draft (ticket 963, BackOffice spec 4354 §10; 4281 decision 16; BackOffice 4243 decisions 19,
 * 26). Pure.
 *
 * A draft is unsaved simulator values: it lives in the browser and goes to the door in full. The panel opens on a saved
 * version, read whole; every setting the panel does not show is carried as read, so the draft is always the whole set.
 * A changed value marks "changed, not saved" and the request sends `{ draft: { basedOn, values } }`; with every value put
 * back it names the saved version again. "Save as a named set" copies the version the draft came from under a new
name, holding the whole draft (BackOffice 4360 `POST SourcingAdvisor/WeightSets/Copy` with `values`).
 *
 * There is no switch for pricing waiting on each shipment: waiting is priced on the last shipment (spec 4354 Further
 * Notes), so no such control exists here.
 */
import type { AdviseWeightSetRef, WeightSetCopyRequest, WeightSetValues, WeightSetVersion } from '@/core/models/sourcing-run'

// The settings the panel edits live in `@/core/` since ticket 967: the weight-set list names them too.
import { WEIGHT_CONTROLS, withControl } from '@/core/sourcing-advisor/weight-controls'
export { controlValue, WEIGHT_CONTROLS, WEIGHT_GROUPS, type WeightControl, type WeightGroup } from '@/core/sourcing-advisor/weight-controls'

export interface WeightDraft {
  /** The saved version the panel opened on. */
  base: WeightSetVersion
  /** The whole set as it now stands. */
  values: WeightSetValues
}

export const openDraft = (base: WeightSetVersion): WeightDraft => ({ base, values: { ...base.values } })

/** The draft with one control set, at its place in the document (`withControl`). */
export function setValue(draft: WeightDraft, key: string, value: number | boolean): WeightDraft {
  const control = WEIGHT_CONTROLS.find((c) => c.key === key)
  return control ? { ...draft, values: withControl(draft.values, control, value, draft.base.values) } : draft
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

/** Where the panel's read of the weight sets stands. */
export interface SetReading {
  /** The chosen version is read and open as the draft. */
  draft: boolean
  setsRead: boolean
  setsFailed: boolean
  /** A version is chosen (picked, or the one the picker opens on). */
  chosen: boolean
  versionFailed: boolean
}

/**
 * Whether Run waits for the set (review 4354 #7): a run sent before the draft opens names no set, and the moment it
 * opens the ask changes — the plans read as stale, and the next Run plans again on the earlier figures instead of
 * reading afresh. A failed read never holds Run, nor does a list with no set to choose: the door plans on the candidate.
 */
export function waitsForSet(r: SetReading): boolean {
  if (r.draft || r.setsFailed || r.versionFailed) return false
  return !(r.setsRead && !r.chosen)
}

/** The body of "save as a named set" (the Copy door with the draft's values); null for a blank name. */
export function saveRequest(draft: WeightDraft, name: string): WeightSetCopyRequest | null {
  const n = name.trim()
  if (!n) return null
  return { from: { name: draft.base.name, version: draft.base.version }, name: n, values: { ...draft.values } }
}

/**
 * The Delivery inspector's pane (ticket 397, spec 380 L15–L16; ruling 367 §4): what the browser
 * remembers of it, and the one current row J/K step to. The keys, the prefs parsing and the step
 * are `@/core/list/list-keys` (graduated at ticket 786); the storage key is the Deliveries list's.
 */
export {
  INSPECTOR_KEYS,
  NEXT_ROW_KEYS,
  nextRowIndex,
  parseInspectorPrefs,
  PREVIOUS_ROW_KEYS,
  serializeInspectorPrefs,
  type InspectorPrefs,
} from '@/core/list/list-keys'

/** The `localStorage` key. Versioned, so a later shape never misreads this one. */
export const INSPECTOR_PREFS_KEY = 'oms.deliveries.inspector.v1'

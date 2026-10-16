// A link into the Pick support console (ticket 499, brief 2691). Pure.
//
// The console holds its Search tab's case in URL state as `?key=` (ticket 496), so a link that
// carries a delivery number opens that delivery's diagnosis. In `core` because a feature other
// than the console (Document Details) links into it, and a feature may not import another.

/** The console's route. */
export const PICK_SUPPORT_PATH = '/oms/pick-support'

/** The full console, opened on Search with this number as its key. */
export function pickSupportConsoleHref(key: string): string {
  return `${PICK_SUPPORT_PATH}?${new URLSearchParams({ key: key.trim() })}`
}

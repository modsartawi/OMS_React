/**
 * The serving-list grants (BackOffice spec 3042; oms ticket 567), read off the one permissions answer (oms 909). In
 * `@/core/` because two features read them: the Serving lists screen gates its screen and its edit controls on them,
 * and the Dispatch board links a callout's serving list to `/oms/serving-lists/:id` only for a View holder — and a
 * feature may never import another.
 */
import type { Permissions } from '@/core/permissions'

/** `ServingList:03` — the menu leaf, the `ScreenGate` and the board's link read THIS predicate. */
export const canViewServingLists = (p: Permissions): boolean => p.has('ServingList:03')

/** `ServingList:06` — every edit control (570, 569). */
export const canEditServingLists = (p: Permissions): boolean => p.has('ServingList:06')

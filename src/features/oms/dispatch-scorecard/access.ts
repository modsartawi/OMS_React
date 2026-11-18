/**
 * The dispatch scorecard's grant (ticket 543, BackOffice 2965), read off the one permissions answer (oms 914). The
 * Staff tab sits behind the same grant (2950 point 6), so it has no predicate of its own.
 */
import type { Permissions } from '@/core/permissions'

/** `DispatchScorecard:03` — the menu leaf's and the page gate's one predicate. */
export const canOpenDispatchScorecard = (p: Permissions): boolean => p.has('DispatchScorecard:03')

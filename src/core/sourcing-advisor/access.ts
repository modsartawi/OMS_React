/**
 * The sourcing advisor's grant (ticket 738, spec 734 D20/D21), read off the one permissions answer (oms 914). In
 * `@/core/` because two features read it: the advisor's own screen gates on it, and Delivery details
 * (`features/oms/document`) draws its "Why this store?" link only for a holder — and a feature may never import
 * another (`.claude/rules/feature-structure.md`).
 */
import type { Permissions } from '@/core/permissions'

/** `SourcingAdvisor:01` (deliberately Create, not 03) — every reader takes THIS predicate. */
export const canViewSourcingAdvisor = (p: Permissions): boolean => p.has('SourcingAdvisor:01')

/**
 * The grant to save weight sets and start trials (spec 4354 §18–§19, BO 4283 decision 4: "no new grant"). The results
 * page's Trials tab starts a trial under it, and its Phase 2 bar tab writes marks, rulings and the accepted reading
 * under it until a grant is named for those.
 * PROVISIONAL (spec 4354: not specified) — the key `SourcingAdvisorSave:01`; BO 4360 seeds the grant unnamed.
 */
export const canSaveWeightSets = (p: Permissions): boolean => p.has('SourcingAdvisorSave:01')

/**
 * The run grant (ticket 962, BackOffice spec 4354 §19: "a run grant opens the simulator, the store record list and the
 * kept runs"). Here, beside the view grant, because the menu reads it too and the results page (971) will.
 * PROVISIONAL (spec 4354: not specified) — BackOffice 4355 seeds the grant but names none: `SourcingAdvisorRun:06` is
 * ours. Reconcile the key in `@/core/permissions` when it lands; every reader takes THIS predicate.
 */
export const canRunSourcingAdvisor = (p: Permissions): boolean => p.has('SourcingAdvisorRun:06')

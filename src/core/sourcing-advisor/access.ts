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
 * under it until a grant is named for those. The simulator's "Save as a named set" (ticket 963) reads it too.
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

/**
 * Whether the simulator reads the stored run it is handed (`?run=`, `simulatorRunPath`). It does not yet: opening a
 * stored run as it was is a read door of its own, not an advise call (BackOffice 4281 decision 11), and neither that
 * door nor the simulator's reading of the parameter is built. Turn this on in the change that builds them.
 */
export const SIMULATOR_READS_RUN: boolean = false

/**
 * "Open the stored run in the simulator" (the results page's orders drawer and largest differences, ticket 971;
 * review 4354 #4): offered only once the simulator reads the run, and only to a holder of the run grant — the results
 * page itself opens under the view grant, which does not open the simulator.
 */
export const canOpenStoredRun = (p: Permissions, simulatorReadsRun: boolean = SIMULATOR_READS_RUN): boolean => simulatorReadsRun && canRunSourcingAdvisor(p)

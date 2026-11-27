/**
 * The sourcing advisor's grant (ticket 738, spec 734 D20/D21), read off the one permissions answer (oms 914). In
 * `@/core/` because two features read it: the advisor's own screen gates on it, and Delivery details
 * (`features/oms/document`) draws its "Why this store?" link only for a holder — and a feature may never import
 * another (`.claude/rules/feature-structure.md`).
 */
import type { Permissions } from '@/core/permissions'

/**
 * `SourcingAdvisor:01` (deliberately Create, not 03): BackOffice 4397 `SourcingAdvisorViewGrants`, the retired advisor's
 * grant kept as seeded, now opening the comparison results page, its trial and phase 2 bar reads, and the old order
 * link (pricing2 35a4e56be). Every reader takes THIS predicate.
 */
export const canViewSourcingAdvisor = (p: Permissions): boolean => p.has('SourcingAdvisor:01')

/**
 * The grant to save weight sets and start trials (spec 4354 §18–§19): BackOffice 4360 `WeightSetGrants.Save`,
 * `BackOfficeScreen[SourcingWeightSets, 03]` — it saves, copies and retires sets, and from BO 4394 starts trials. The
 * results page's Trials tab starts a trial and a factor table under it (BO 4394); its Phase 2 bar tab writes under the
 * mark grant (BO 4396). The simulator's "Save as a named set" (ticket 963, the Copy door) reads it too.
 */
export const canSaveWeightSets = (p: Permissions): boolean => p.has('SourcingWeightSets:03')

/**
 * The run grant (ticket 962, BackOffice spec 4354 §19: "a run grant opens the simulator, the store record list and the
 * kept runs"): `BackOfficeScreen[SourcingSimulator, 03]` (BackOffice 4355 `SourcingSimulatorGrants`), the grant the
 * advise door's user route, the kept-run doors and the store record door all check. Here, beside the view grant,
 * because the menu reads it too and the results page does. Every reader takes THIS predicate.
 */
export const canRunSourcingAdvisor = (p: Permissions): boolean => p.has('SourcingSimulator:03')

/**
 * The customer-point grant (ticket 964, spec 4354 §12 and §19): `BackOfficeScreen[SourcingCustomerPoint, 03]`
 * (BackOffice 4381 `CustomerPointGrants`). Only its holder gets a replay's real point back; without it the server still
 * plans from the point and the reply says `NO_GRANT`. The replay's switch reads it to say so before the run.
 */
export const canSeeCustomerPoint = (p: Permissions): boolean => p.has('SourcingCustomerPoint:03')

/**
 * The grant to mark the candidate set (spec 4354 §10: "marking the candidate set needs a second grant"): BackOffice 4360
 * `WeightSetGrants.Mark`, `BackOfficeScreen[SourcingCandidateSet, 03]` — the marking screen and the mark door. The
 * weight-set list's marking screen (ticket 967) offers Mark only under it.
 */
export const canMarkCandidateSet = (p: Permissions): boolean => p.has('SourcingCandidateSet:03')

/**
 * Who opens the list of weight sets and versions, with the candidate log (ticket 967): the run grant. BackOffice 4360
 * reads the list, a version and the candidate log under the simulator's run grant only, so the save or mark grant alone
 * would open a screen that can read nothing.
 */
export const canOpenWeightSets = (p: Permissions): boolean => canRunSourcingAdvisor(p)

/**
 * The three planner grants (ticket 968, spec 4354 §19), each changing its tables; every list and history reads under
 * the simulator's run grant. BackOffice at pricing2 35a4e56be:
 * - buffer overrides and a store's hand-set stock confidence — `PlannerStockGrants`, `[SourcingPlannerStock, 03]` (BO 4375);
 * - product rules and the restricted and bulky lists — `ProductRuleGrants`, `[SourcingProductRules, 03]` (BO 4362); its
 *   holder switches any rule, one that guards a medicine too (owner, ticket 968);
 * - the store-by-mode table, carrier contracts and slot rules — `PlannerTableGrants`, `[SourcingPlannerTables, 03]` (BO 4361).
 * The planner page shows a tab only to the holder of its grant (owner's pick, variant A).
 */
export const canEditPlannerBuffer = (p: Permissions): boolean => p.has('SourcingPlannerStock:03')
export const canEditPlannerRules = (p: Permissions): boolean => p.has('SourcingProductRules:03')
export const canEditPlannerTables = (p: Permissions): boolean => p.has('SourcingPlannerTables:03')

/** The planner-data page (and its menu leaf) opens with the run grant, which reads every table, and any planner grant. */
export const canOpenSourcingPlanner = (p: Permissions): boolean =>
  canRunSourcingAdvisor(p) && (canEditPlannerBuffer(p) || canEditPlannerRules(p) || canEditPlannerTables(p))

/**
 * Whether the simulator reads the stored run it is handed (`?run=`, `simulatorRunPath`). It does since ticket 969:
 * opening a stored run as it was is a read door of its own, not an advise call (BackOffice 4281 decision 11); the
 * simulator reads it through that door (BackOffice 4380: `GET SourcingAdvisor/Runs/Open?runId=`).
 */
export const SIMULATOR_READS_RUN: boolean = true

/**
 * "Open the stored run in the simulator" (the results page's orders drawer and largest differences, ticket 971;
 * review 4354 #4): offered only once the simulator reads the run, and only to a holder of the run grant — the results
 * page itself opens under the view grant, which does not open the simulator.
 */
export const canOpenStoredRun = (p: Permissions, simulatorReadsRun: boolean = SIMULATOR_READS_RUN): boolean => simulatorReadsRun && canRunSourcingAdvisor(p)

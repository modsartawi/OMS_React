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
 * The grant to save weight sets and start trials (spec 4354 §18–§19, BO 4283 decision 4: "no new grant"). The results
 * page's Trials tab starts a trial and a factor table under it (BO 4394). The simulator's "Save as a named set" (ticket 963) reads it too.
 * PROVISIONAL (spec 4354: not specified) — the key `SourcingAdvisorSave:01`; BO 4360 seeds the grant unnamed.
 */
export const canSaveWeightSets = (p: Permissions): boolean => p.has('SourcingAdvisorSave:01')

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
 * The grant to mark the candidate set (spec 4354 §10: "marking the candidate set needs a second grant"; §19 "a grant to
 * mark the candidate set"). The weight-set list's marking screen (ticket 967) offers Mark only under it.
 * PROVISIONAL (spec 4354: not specified) — the key `SourcingAdvisorMark:06`; BO 4360 seeds the grant unnamed.
 */
export const canMarkCandidateSet = (p: Permissions): boolean => p.has('SourcingAdvisorMark:06')

/**
 * Who opens the list of weight sets and versions, with the candidate log (ticket 967). Spec 4354 §19 lists the screen
 * but gives it no grant of its own: whoever runs sets (the simulator's picker already reads the list), saves them or
 * marks one reads it. Today's view grant alone does not.
 * PROVISIONAL (spec 4354: not specified) — which grants open the screen.
 */
export const canOpenWeightSets = (p: Permissions): boolean => canRunSourcingAdvisor(p) || canSaveWeightSets(p) || canMarkCandidateSet(p)

/**
 * The three planner grants (ticket 968, BackOffice spec 4354 §19: "a grant for the buffer overrides and the hand-set
 * stock confidence; a grant for the product rules and lists; a grant for the other planner tables"). BO 4375, 4362 and
 * 4361 each seed one, unnamed. The planner page shows a tab only to the holder of its grant (owner's pick, variant A).
 * PROVISIONAL (spec 4354: not specified) — the keys `SourcingPlannerBuffer:01`, `SourcingPlannerRules:01` and
 * `SourcingPlannerTables:01`. Reconcile in `@/core/permissions` as seeded; every reader takes THESE predicates.
 */
export const canEditPlannerBuffer = (p: Permissions): boolean => p.has('SourcingPlannerBuffer:01')
export const canEditPlannerRules = (p: Permissions): boolean => p.has('SourcingPlannerRules:01')
export const canEditPlannerTables = (p: Permissions): boolean => p.has('SourcingPlannerTables:01')

/** The planner-data page (and its menu leaf) opens with any one of the three planner grants. */
export const canOpenSourcingPlanner = (p: Permissions): boolean =>
  canEditPlannerBuffer(p) || canEditPlannerRules(p) || canEditPlannerTables(p)

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

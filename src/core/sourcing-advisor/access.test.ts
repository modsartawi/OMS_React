/**
 * Ticket 738, on the one permissions answer (oms 914): the advisor reads `SourcingAdvisor:01` — Create, deliberately
 * not Display. Ticket 962: the simulator reads the run grant (a provisional key).
 */
import { describe, expect, it } from 'vitest'
import { permissionsOf } from '@/core/permissions'
import {
  canEditPlannerBuffer,
  canEditPlannerRules,
  canEditPlannerTables,
  canMarkCandidateSet,
  canOpenSourcingPlanner,
  canOpenStoredRun,
  canOpenWeightSets,
  canRunSourcingAdvisor,
  canSaveWeightSets,
  canViewSourcingAdvisor,
} from './access'

/**
 * The run grant's key is the simulator reconciler's to settle (`canRunSourcingAdvisor`); these cases grant it under both
 * the provisional key and the server's (`SourcingSimulatorGrants`: `SourcingSimulator`, 03), so they hold either way.
 */
const RUN = ['SourcingAdvisorRun:06', 'SourcingSimulator:03']
const keys = (...k: string[]) => permissionsOf({ screens: k as never[] })

describe('the save grant (save weight sets, start trials): BO 4360 `WeightSetGrants.Save`', () => {
  it('grants on SourcingWeightSets:03, not on the view or run grant', () => {
    expect(canSaveWeightSets(keys('SourcingWeightSets:03'))).toBe(true)
    expect(canSaveWeightSets(keys('SourcingAdvisor:01', ...RUN))).toBe(false)
    expect(canSaveWeightSets(permissionsOf(null))).toBe(false)
  })
})

describe('the marking grant and the weight-set list (BO 4360 `WeightSetGrants.Mark`)', () => {
  it('marks the candidate set on SourcingCandidateSet:03 — the save grant does not mark', () => {
    expect(canMarkCandidateSet(keys('SourcingCandidateSet:03'))).toBe(true)
    expect(canMarkCandidateSet(keys('SourcingWeightSets:03', ...RUN))).toBe(false)
    expect(canMarkCandidateSet(permissionsOf(null))).toBe(false)
  })

  it('the list opens to the run grant, which every list, version and log read needs; save or mark alone reads nothing', () => {
    expect(canOpenWeightSets(keys(...RUN))).toBe(true)
    expect(canOpenWeightSets(keys('SourcingWeightSets:03'))).toBe(false)
    expect(canOpenWeightSets(keys('SourcingCandidateSet:03'))).toBe(false)
    expect(canOpenWeightSets(keys('SourcingAdvisor:01'))).toBe(false)
    expect(canOpenWeightSets(permissionsOf(null))).toBe(false)
  })
})

describe('the sourcing advisor grant', () => {
  it('grants on SourcingAdvisor:01 only', () => {
    expect(canViewSourcingAdvisor(permissionsOf({ screens: ['SourcingAdvisor:01'] }))).toBe(true)
    expect(canViewSourcingAdvisor(permissionsOf({ screens: ['SourcingAdvisor:03' as never] }))).toBe(false)
  })

  it('🚩 no answer grants nothing', () => {
    expect(canViewSourcingAdvisor(permissionsOf(null))).toBe(false)
  })
})

describe('the sourcing advisor run grant (ticket 962, provisional key)', () => {
  it('grants on SourcingAdvisorRun:06 only — the view grant does not open the simulator', () => {
    expect(canRunSourcingAdvisor(permissionsOf({ screens: ['SourcingAdvisorRun:06'] }))).toBe(true)
    expect(canRunSourcingAdvisor(permissionsOf({ screens: ['SourcingAdvisor:01'] }))).toBe(false)
    expect(canRunSourcingAdvisor(permissionsOf(null))).toBe(false)
  })
})

describe('opening a stored run in the simulator (review 4354 #4)', () => {
  it('is never offered while the simulator does not read the run it is handed, whatever the grant', () => {
    expect(canOpenStoredRun(permissionsOf({ screens: ['SourcingAdvisor:01', 'SourcingAdvisorRun:06'] }), false)).toBe(false)
  })

  it('is offered to a holder of the run grant now that the simulator reads the run (ticket 969)', () => {
    expect(canOpenStoredRun(permissionsOf({ screens: ['SourcingAdvisor:01', 'SourcingAdvisorRun:06'] }))).toBe(true)
    expect(canOpenStoredRun(permissionsOf({ screens: ['SourcingAdvisor:01'] }))).toBe(false)
  })

  it('once the simulator reads it, only a holder of the run grant is offered it — the view grant opens no simulator', () => {
    expect(canOpenStoredRun(permissionsOf({ screens: ['SourcingAdvisorRun:06'] }), true)).toBe(true)
    expect(canOpenStoredRun(permissionsOf({ screens: ['SourcingAdvisor:01'] }), true)).toBe(false)
  })
})

describe('the three planner grants (BO 4375, 4362, 4361: `PlannerStockGrants`, `ProductRuleGrants`, `PlannerTableGrants`)', () => {
  it('each opens its own tables only', () => {
    expect(canEditPlannerBuffer(keys('SourcingPlannerStock:03'))).toBe(true)
    expect(canEditPlannerBuffer(keys('SourcingProductRules:03', 'SourcingPlannerTables:03'))).toBe(false)
    expect(canEditPlannerRules(keys('SourcingProductRules:03'))).toBe(true)
    expect(canEditPlannerRules(keys('SourcingPlannerStock:03'))).toBe(false)
    expect(canEditPlannerTables(keys('SourcingPlannerTables:03'))).toBe(true)
    expect(canEditPlannerTables(keys(...RUN))).toBe(false)
  })

  it('the planner page opens with the run grant (every list reads under it) and any one of the three', () => {
    for (const k of ['SourcingPlannerStock:03', 'SourcingProductRules:03', 'SourcingPlannerTables:03']) {
      expect(canOpenSourcingPlanner(keys(k, ...RUN))).toBe(true)
      expect(canOpenSourcingPlanner(keys(k))).toBe(false)
    }
    expect(canOpenSourcingPlanner(keys(...RUN, 'SourcingAdvisor:01'))).toBe(false)
    expect(canOpenSourcingPlanner(permissionsOf(null))).toBe(false)
  })
})

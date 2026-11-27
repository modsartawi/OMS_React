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
  canOpenSourcingPlanner,
  canOpenStoredRun,
  canRunSourcingAdvisor,
  canSaveWeightSets,
  canViewSourcingAdvisor,
} from './access'

describe('the save grant (save weight sets, start trials)', () => {
  it('grants on its own key, not on the view grant', () => {
    expect(canSaveWeightSets(permissionsOf({ screens: ['SourcingAdvisorSave:01'] }))).toBe(true)
    expect(canSaveWeightSets(permissionsOf({ screens: ['SourcingAdvisor:01'] }))).toBe(false)
    expect(canSaveWeightSets(permissionsOf(null))).toBe(false)
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

describe('the three planner grants (ticket 968, provisional keys)', () => {
  const p = (...keys: string[]) => permissionsOf({ screens: keys as never[] })

  it('each opens its own tables only', () => {
    expect(canEditPlannerBuffer(p('SourcingPlannerBuffer:01'))).toBe(true)
    expect(canEditPlannerBuffer(p('SourcingPlannerRules:01', 'SourcingPlannerTables:01'))).toBe(false)
    expect(canEditPlannerRules(p('SourcingPlannerRules:01'))).toBe(true)
    expect(canEditPlannerRules(p('SourcingPlannerBuffer:01'))).toBe(false)
    expect(canEditPlannerTables(p('SourcingPlannerTables:01'))).toBe(true)
    expect(canEditPlannerTables(p('SourcingAdvisorRun:06'))).toBe(false)
  })

  it('the planner page opens with any one of the three, and not with the run or view grant alone', () => {
    for (const k of ['SourcingPlannerBuffer:01', 'SourcingPlannerRules:01', 'SourcingPlannerTables:01']) expect(canOpenSourcingPlanner(p(k))).toBe(true)
    expect(canOpenSourcingPlanner(p('SourcingAdvisorRun:06', 'SourcingAdvisor:01'))).toBe(false)
    expect(canOpenSourcingPlanner(permissionsOf(null))).toBe(false)
  })
})


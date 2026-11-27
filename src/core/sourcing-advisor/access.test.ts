/**
 * Ticket 738, on the one permissions answer (oms 914): the advisor reads `SourcingAdvisor:01` — Create, deliberately
 * not Display. Ticket 962: the simulator reads the run grant (a provisional key).
 */
import { describe, expect, it } from 'vitest'
import { permissionsOf } from '@/core/permissions'
import { canOpenStoredRun, canRunSourcingAdvisor, canSaveWeightSets, canViewSourcingAdvisor } from './access'

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
    expect(canOpenStoredRun(permissionsOf({ screens: ['SourcingAdvisor:01', 'SourcingAdvisorRun:06'] }))).toBe(false)
  })

  it('once the simulator reads it, only a holder of the run grant is offered it — the view grant opens no simulator', () => {
    expect(canOpenStoredRun(permissionsOf({ screens: ['SourcingAdvisorRun:06'] }), true)).toBe(true)
    expect(canOpenStoredRun(permissionsOf({ screens: ['SourcingAdvisor:01'] }), true)).toBe(false)
  })
})


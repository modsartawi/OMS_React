/**
 * Ticket 738, on the one permissions answer (oms 914): the advisor reads `SourcingAdvisor:01` — Create, deliberately
 * not Display. Ticket 962: the simulator reads the run grant (a provisional key).
 */
import { describe, expect, it } from 'vitest'
import { permissionsOf } from '@/core/permissions'
import { canRunSourcingAdvisor, canSaveWeightSets, canViewSourcingAdvisor } from './access'

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

describe('the weight-set save grant (ticket 963, provisional key)', () => {
  it('grants on SourcingAdvisorSets:06 only — the run grant does not save a set', () => {
    expect(canSaveWeightSets(permissionsOf({ screens: ['SourcingAdvisorSets:06'] }))).toBe(true)
    expect(canSaveWeightSets(permissionsOf({ screens: ['SourcingAdvisorRun:06'] }))).toBe(false)
    expect(canSaveWeightSets(permissionsOf(null))).toBe(false)
  })
})

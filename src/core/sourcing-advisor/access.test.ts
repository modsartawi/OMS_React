/**
 * Ticket 738, on the one permissions answer (oms 914): the advisor reads `SourcingAdvisor:01` — Create, deliberately
 * not Display.
 */
import { describe, expect, it } from 'vitest'
import { permissionsOf } from '@/core/permissions'
import { canSaveWeightSets, canViewSourcingAdvisor } from './access'

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

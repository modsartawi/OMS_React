/**
 * Ticket 738, on the one permissions answer (oms 909): the advisor reads `SourcingAdvisor:01` — Create, deliberately
 * not Display.
 */
import { describe, expect, it } from 'vitest'
import { permissionsOf } from '@/core/permissions'
import { canViewSourcingAdvisor } from './access'

describe('the sourcing advisor grant', () => {
  it('grants on SourcingAdvisor:01 only', () => {
    expect(canViewSourcingAdvisor(permissionsOf({ screens: ['SourcingAdvisor:01'] }))).toBe(true)
    expect(canViewSourcingAdvisor(permissionsOf({ screens: ['SourcingAdvisor:03' as never] }))).toBe(false)
  })

  it('🚩 no answer grants nothing', () => {
    expect(canViewSourcingAdvisor(permissionsOf(null))).toBe(false)
  })
})

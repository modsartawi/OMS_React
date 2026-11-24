/**
 * BackOffice ticket 4224 (spec 4212) — the parked-returns grants, as BackOffice 4218 seeds them: the CONTROLLER
 * `ParkedReturns`, 03 view (the list and the detail), 06 settle (the actions, a later ticket's).
 */
import { describe, expect, it } from 'vitest'
import { permissionsFromQuery, permissionsOf } from '@/core/permissions'
import { canSettleParkedReturns, canViewParkedReturns } from './access'

const holding = (...screens: string[]) => permissionsOf({ screens })

describe('each predicate reads its own key', () => {
  it('view: ParkedReturns:03', () => {
    expect(canViewParkedReturns(holding('ParkedReturns:03'))).toBe(true)
    expect(canViewParkedReturns(holding('ParkedReturns:06'))).toBe(false)
  })

  it('settle: ParkedReturns:06', () => {
    expect(canSettleParkedReturns(holding('ParkedReturns:06'))).toBe(true)
    expect(canSettleParkedReturns(holding('ParkedReturns:03'))).toBe(false)
  })
})

describe('fails closed', () => {
  it('no answer, a pending answer or a failed one grants nothing', () => {
    for (const p of [
      permissionsOf(null),
      permissionsFromQuery({ isPending: true, isError: false, data: undefined }),
      permissionsFromQuery({ isPending: false, isError: true, data: undefined }),
    ])
      for (const can of [canViewParkedReturns, canSettleParkedReturns]) expect(can(p)).toBe(false)
  })
})

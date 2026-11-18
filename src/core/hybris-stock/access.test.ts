/** Ticket 847 — the Hybris stock grants, off the one permissions answer since oms 914 (brief 3995 row 41). */
import { describe, expect, it } from 'vitest'
import { permissionsOf } from '@/core/permissions'
import { canManageHybrisStock, canViewHybrisStock } from './access'

const p = (...screens: string[]) => permissionsOf({ screens })

describe('Hybris stock predicates', () => {
  it('view reads HybrisStock:03, manage reads HybrisStock:06', () => {
    expect(canViewHybrisStock(p('HybrisStock:03'))).toBe(true)
    expect(canManageHybrisStock(p('HybrisStock:03'))).toBe(false)
    expect(canManageHybrisStock(p('HybrisStock:06'))).toBe(true)
  })

  it('fails closed with no answer', () => {
    expect(canViewHybrisStock(permissionsOf(null))).toBe(false)
    expect(canManageHybrisStock(permissionsOf(null))).toBe(false)
  })
})

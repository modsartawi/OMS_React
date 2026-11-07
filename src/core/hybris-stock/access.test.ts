import { describe, expect, it } from 'vitest'
import { canManageHybrisStock, canViewHybrisStock, hybrisStockGrants } from './access'

describe('hybrisStockGrants', () => {
  it('reads each flag', () => {
    expect(hybrisStockGrants({ canView: true, canManage: false })).toEqual({ canView: true, canManage: false })
  })

  it('manage implies view', () => {
    expect(hybrisStockGrants({ canView: false, canManage: true })).toEqual({ canView: true, canManage: true })
  })

  it.each([null, undefined, {}, { canView: 'true', canManage: 1 }, []])('fails closed on %j', (r) => {
    expect(hybrisStockGrants(r as never)).toEqual({ canView: false, canManage: false })
  })

  it('the predicates read the same answer', () => {
    expect(canViewHybrisStock({ canView: true, canManage: false })).toBe(true)
    expect(canManageHybrisStock({ canView: true, canManage: false })).toBe(false)
    expect(canManageHybrisStock(undefined)).toBe(false)
  })
})

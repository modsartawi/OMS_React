/**
 * Ticket 477 — the Deliverect grants, off the one permissions answer since oms 914. Each leaf and each page reads its
 * grant through one predicate; a missing or errored answer keeps every Deliverect screen hidden (fail closed).
 */
import { describe, expect, it } from 'vitest'
import { permissionsOf, type Permissions } from '@/core/permissions'
import { canAddPlatform, canManageCatalog, canManageStores, canManageTerms, canViewOrders } from './access'

const KEYS = ['DeliverectStores:03', 'DeliverectCatalog:03', 'DeliverectOrders:03', 'DeliverectTerms:03', 'DeliverectPlatformAdd:03']
const p = (...screens: string[]) => permissionsOf({ screens })

describe('the per-leaf predicates', () => {
  it.each([
    ['DeliverectStores:03', canManageStores],
    ['DeliverectCatalog:03', canManageCatalog],
    ['DeliverectOrders:03', canViewOrders],
    ['DeliverectTerms:03', canManageTerms],
    ['DeliverectPlatformAdd:03', canAddPlatform],
  ] as [string, (p: Permissions) => boolean][])('%s alone grants its own predicate only', (key, can) => {
    expect(can(p(key))).toBe(true)
    expect(can(p(...KEYS.filter((k) => k !== key)))).toBe(false)
    expect(can(permissionsOf(null))).toBe(false)
  })

  it('the Terms grant does not imply Add platform', () => {
    expect(canAddPlatform(p('DeliverectTerms:03'))).toBe(false)
  })
})

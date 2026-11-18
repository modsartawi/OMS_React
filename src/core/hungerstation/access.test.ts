/**
 * Ticket 551 — the HungerStation grants, off the one permissions answer since oms 909. Each leaf and each page reads
 * its grant through one predicate; a missing or errored answer keeps every HungerStation screen hidden (fail closed).
 */
import { describe, expect, it } from 'vitest'
import { permissionsOf, type Permissions } from '@/core/permissions'
import { canManageCatalog, canManagePromotions, canManageStores, canViewOrders } from './access'

const KEYS = ['HungerStationStores:03', 'HungerStationCatalog:03', 'HungerStationOrders:03', 'HungerStationPromotions:03']
const p = (...screens: string[]) => permissionsOf({ screens })

describe('the per-leaf predicates', () => {
  it.each([
    ['HungerStationStores:03', canManageStores],
    ['HungerStationCatalog:03', canManageCatalog],
    ['HungerStationOrders:03', canViewOrders],
    ['HungerStationPromotions:03', canManagePromotions],
  ] as [string, (p: Permissions) => boolean][])('%s alone grants its own predicate only', (key, can) => {
    expect(can(p(key))).toBe(true)
    expect(can(p(...KEYS.filter((k) => k !== key)))).toBe(false)
    expect(can(permissionsOf(null))).toBe(false)
  })

  it('🚩 Deliverect’s grants mean nothing here', () => {
    const deliverect = p('DeliverectStores:03', 'DeliverectCatalog:03', 'DeliverectOrders:03', 'DeliverectTerms:03')
    expect([canManageStores, canManageCatalog, canViewOrders, canManagePromotions].some((can) => can(deliverect))).toBe(false)
  })
})

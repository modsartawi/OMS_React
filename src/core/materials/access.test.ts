/**
 * Ticket 451 — the Materials grants, over the one permissions answer since oms 909 (BackOffice spec 4002). Keys from
 * the brief's mapping table (row 24); `ItemInquiryCustome` is the seed's spelling, no final r. Each leaf and each page
 * reads its grant through one predicate; a missing key or a failed answer keeps the screen hidden.
 */
import { describe, expect, it } from 'vitest'
import { permissionsOf, type ScreenKey } from '@/core/permissions'
import { canCheckGs1, canCheckStock, canSearchMaterials, canSeeMaterialStock } from './access'

const holding = (...screens: ScreenKey[]) => permissionsOf({ screens })

const PREDICATES = [
  ['ItemInquiryCustome:03', canSearchMaterials],
  ['MaterialStockInquiry:03', canCheckStock],
  ['Gs1SerialInquiry:03', canCheckGs1],
] as const

describe('the per-leaf predicates', () => {
  it('each follows its own key and no neighbour', () => {
    for (const [key] of PREDICATES) {
      for (const [otherKey, other] of PREDICATES) expect(other(holding(key))).toBe(otherKey === key)
    }
  })

  it('🚩 the "Customer" spelling is not the seed key', () => {
    expect(canSearchMaterials(permissionsOf({ screens: ['ItemInquiryCustomer:03'] }))).toBe(false)
  })

  it('🚩 a failed answer grants nothing', () => {
    for (const [, can] of PREDICATES) expect(can(permissionsOf(null))).toBe(false)
  })
})

describe('canSeeMaterialStock — the client-side combination', () => {
  it('needs BOTH the search and the stock grant', () => {
    expect(canSeeMaterialStock(holding('ItemInquiryCustome:03', 'MaterialStockInquiry:03'))).toBe(true)
    // Half grants: either one alone is not the Stock tab.
    expect(canSeeMaterialStock(holding('ItemInquiryCustome:03'))).toBe(false)
    expect(canSeeMaterialStock(holding('MaterialStockInquiry:03'))).toBe(false)
    expect(canSeeMaterialStock(holding())).toBe(false)
  })
})

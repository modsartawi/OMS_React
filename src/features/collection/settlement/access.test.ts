/**
 * The settlement account's predicates (spec 267 D1, tickets 268 and 309), over the one permissions answer since oms
 * 909 (BackOffice spec 4002): `SettlementAccount:03` opens the screen, `SettlementSupervision:03` draws the
 * supervisor's acts. Keys from the brief's mapping table (row 30).
 *
 * What the nav does with each answer is pinned in `src/layout/menu-collection.test.ts`.
 */
import { describe, expect, it } from 'vitest'
import { permissionsOf, type ScreenKey } from '@/core/permissions'
import { canOpenSettlement, canSuperviseSettlement } from './api'

const holding = (...screens: ScreenKey[]) => permissionsOf({ screens })

describe('the settlement account predicate', () => {
  it('admits its own key and denies without it', () => {
    expect(canOpenSettlement(holding('SettlementAccount:03'))).toBe(true)
    expect(canOpenSettlement(holding())).toBe(false)
  })

  it('🚩 the four inquiry grants never admit it, alone or together', () => {
    const inquiries = ['CollectionInquiry:03', 'AcrInquiry:03', 'DepositInquiry:03', 'CollectionAttempts:03'] as const
    for (const key of inquiries) expect(canOpenSettlement(holding(key))).toBe(false)
    expect(canOpenSettlement(holding(...inquiries, 'CollectionReady:03'))).toBe(false)
  })

  it('🚩 a failed answer grants nothing', () => {
    expect(canOpenSettlement(permissionsOf(null))).toBe(false)
  })
})

/**
 * Ticket 309 — **settlement supervision**, a power on the screen rather than a screen (BackOffice 1977). It decides
 * whether Approve and Reject are drawn, and nothing else: the doors answer a bare 403 without the grant.
 */
describe('the settlement supervision predicate', () => {
  it('admits its own key and denies without it', () => {
    expect(canSuperviseSettlement(holding('SettlementSupervision:03'))).toBe(true)
    expect(canSuperviseSettlement(holding())).toBe(false)
  })

  it('🚩 the SCREEN grant does not imply the power — an accountant is not a supervisor', () => {
    expect(canSuperviseSettlement(holding('SettlementAccount:03'))).toBe(false)
  })

  it('…and the power does not open the screen — reaching it is still the screen grant', () => {
    expect(canOpenSettlement(holding('SettlementSupervision:03'))).toBe(false)
  })

  it('🚩 a failed answer grants nothing', () => {
    expect(canSuperviseSettlement(permissionsOf(null))).toBe(false)
  })
})

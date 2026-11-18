/**
 * The Collections area's inquiry predicates (ticket 253, 244 §10), over the one permissions answer since oms 914
 * (BackOffice spec 4002): each reads its own `BackOfficeScreen` key.
 *
 * - **Only an explicit grant admits.** An absent key, a pending or failed answer — all denials.
 * - **They are independent.** One grant admits one screen and never its neighbours, which is what makes the ragged
 *   group honest about what the server will actually serve.
 *
 * What the nav does with each answer is pinned in `src/layout/menu-collection.test.ts`.
 */
import { describe, expect, it } from 'vitest'
import { permissionsOf, type ScreenKey } from '@/core/permissions'
import {
  canOpenAcrs,
  canOpenAssignment,
  canOpenAttempts,
  canOpenCollections,
  canOpenDeposits,
  canOpenReady,
} from './api'

const holding = (...screens: ScreenKey[]) => permissionsOf({ screens })

// Keys from the brief's mapping table (row 30), not from the predicates.
const PREDICATES = [
  ['CollectionInquiry:03', canOpenCollections],
  ['AcrInquiry:03', canOpenAcrs],
  ['DepositInquiry:03', canOpenDeposits],
  ['CollectionAttempts:03', canOpenAttempts],
  // 1169's door, in the same matrix as the reads: a read grant must never light the screen that rewrites what those
  // reads filter by.
  ['CollectionAssignment:03', canOpenAssignment],
  // Ready for collection (ticket 317, BackOffice 1994) — its own read grant.
  ['CollectionReady:03', canOpenReady],
] as const

describe('the Collection predicates', () => {
  it('each admits its own key and denies without it', () => {
    for (const [key, can] of PREDICATES) {
      expect(can(holding(key))).toBe(true)
      expect(can(holding())).toBe(false)
    }
  })

  it('🚩 each reads ONLY its own key — one grant never admits a neighbour', () => {
    for (const [key] of PREDICATES) {
      for (const [otherKey, other] of PREDICATES) expect(other(holding(key))).toBe(otherKey === key)
    }
  })

  it('🚩 the settlement grants admit none of these (268)', () => {
    for (const [, can] of PREDICATES) expect(can(holding('SettlementAccount:03', 'SettlementSupervision:03'))).toBe(false)
  })

  it('🚩 another command of the same screen is not the key', () => {
    expect(canOpenCollections(permissionsOf({ screens: ['CollectionInquiry:02', 'CollectionInquiry:06'] }))).toBe(false)
  })

  it('🚩 a failed answer grants nothing', () => {
    for (const [, can] of PREDICATES) expect(can(permissionsOf(null))).toBe(false)
  })
})

/**
 * BackOffice 1995 — the **collector supervisor**: a role bundling the five read grants. The web keys nothing off a
 * role name, so its whole behaviour here is these predicates reading its keys.
 */
describe('a collector supervisor (BackOffice 1995)', () => {
  const COLLECTOR_SUPERVISOR = holding(
    'CollectionInquiry:03',
    'AcrInquiry:03',
    'DepositInquiry:03',
    'CollectionAttempts:03',
    'CollectionReady:03',
  )

  it('opens the five read screens, Ready for collection among them', () => {
    expect(canOpenCollections(COLLECTOR_SUPERVISOR)).toBe(true)
    expect(canOpenAcrs(COLLECTOR_SUPERVISOR)).toBe(true)
    expect(canOpenDeposits(COLLECTOR_SUPERVISOR)).toBe(true)
    expect(canOpenAttempts(COLLECTOR_SUPERVISOR)).toBe(true)
    expect(canOpenReady(COLLECTOR_SUPERVISOR)).toBe(true)
  })

  it('🚩 reaches no act — the assignment screen stays shut', () => {
    expect(canOpenAssignment(COLLECTOR_SUPERVISOR)).toBe(false)
  })
})

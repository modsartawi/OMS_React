/**
 * The Collections nav group, gated (ticket 253, spec 249 §"Getting in").
 *
 * `resolveMenu` is the pure half of `useVisibleMenu` (ticket 124), so what the shell does with each answer is provable
 * with no renderer. Since oms 914 each leaf reads its OWN key off the ONE permissions answer (brief 3995 row 30):
 * Cash collections = `CollectionInquiry:03`, ACRs = `AcrInquiry:03`, Deposits = `DepositInquiry:03`, Attempts =
 * `CollectionAttempts:03`, Ready = `CollectionReady:03`, Assignment = `CollectionAssignment:03`, Settlement account =
 * `SettlementAccount:03`. The group is read out of the **real** `MENU`, never re-declared.
 *
 * 🚩 The two failures being designed against: an area of finance screens left in the nav because the answer errored,
 * and a **uniform** group — every item shown because one grant was held — which would offer a supervisor screens the
 * server will refuse.
 */
import { describe, expect, it } from 'vitest'
import { permissionsFromQuery, permissionsOf } from '@/core/permissions'
import { MENU, type ShellMenuItem } from './menu-model'
import { isGated, resolveMenu } from './useVisibleMenu'

const collections = MENU.find((g) => g.labelKey === 'collection:menu.collections')

const labels = (items: ShellMenuItem[]): string[] => items.flatMap((i) => [i.labelKey, ...labels(i.items ?? [])])
const holding = (...screens: string[]) => permissionsOf({ screens })
const visible = (...screens: string[]) => labels(resolveMenu([collections!], holding(...screens)).items)
const errored = permissionsFromQuery({ isPending: false, isError: true, data: undefined })
const pending = permissionsFromQuery({ isPending: true, isError: false, data: undefined })

const COLLECTIONS = 'CollectionInquiry:03'
const ACRS = 'AcrInquiry:03'
const DEPOSITS = 'DepositInquiry:03'
const ATTEMPTS = 'CollectionAttempts:03'
const READY = 'CollectionReady:03'
const ASSIGNMENT = 'CollectionAssignment:03'
const SETTLEMENT = 'SettlementAccount:03'
const ALL = [COLLECTIONS, ACRS, DEPOSITS, ATTEMPTS, READY, ASSIGNMENT, SETTLEMENT]

/**
 * The settlement item, flattened: since ticket 284 it is a **node** with four children (283's four paths), so every
 * `labels()` expectation below carries five entries where it once carried one. The grant is still ONE key on the node.
 */
const SETTLEMENT_NODE = [
  'settlement:menu.settlement',
  'settlement:menu.overview',
  'settlement:menu.open',
  'settlement:menu.ledger',
  'settlement:menu.upload',
]

describe('the Collections nav group', () => {
  it('exists, with every top-level item gated', () => {
    expect(collections).toBeDefined()
    const items = collections!.items!
    expect(items.map((l) => l.routerLink)).toEqual([
      '/collection/collections',
      '/collection/acrs',
      '/collection/deposits',
      '/collection/attempts',
      // Ready for collection (ticket 317) — a read, beside the four reads, on its own grant.
      '/collection/ready',
      '/collection/assignment',
      // My exports (ticket 4318, spec 4314) — the caller's export jobs; offered only while the feature is on.
      '/collection/exports',
      // The settlement account (ticket 268) — a SECOND feature under this one group and prefix, on its own grant.
      '/collection/settlement',
    ])
    for (const item of items) expect(isGated(item)).toBe(true)
  })

  it('all granted → every item under one Collections group', () => {
    expect(visible(...ALL)).toEqual([
      'collection:menu.collections',
      'collection:menu.cashCollections',
      'collection:menu.acrs',
      'collection:menu.deposits',
      'collection:menu.attempts',
      'collection:menu.ready',
      'collection:menu.assignment',
      // 🚩 Its own namespace, not `collection`'s: the settlement account is its own feature.
      ...SETTLEMENT_NODE,
    ])
  })

  it('🚩 one granted → a RAGGED group with exactly that item', () => {
    expect(visible(DEPOSITS)).toEqual(['collection:menu.collections', 'collection:menu.deposits'])
    expect(visible(ACRS)).toEqual(['collection:menu.collections', 'collection:menu.acrs'])

    // 🚩 The settlement grant is as independent as the others: an accountant granted ONLY the settlement account gets
    // that one node — not the inquiries the server would refuse them.
    expect(visible(SETTLEMENT)).toEqual(['collection:menu.collections', ...SETTLEMENT_NODE])

    // Two grants, and they are the two that were granted — not the first two.
    expect(visible(COLLECTIONS, ATTEMPTS)).toEqual([
      'collection:menu.collections',
      'collection:menu.cashCollections',
      'collection:menu.attempts',
    ])

    // 🚩 BackOffice 1169: holding every read grant still does not show Collection Assignment.
    expect(visible(COLLECTIONS, ACRS, DEPOSITS, ATTEMPTS, READY)).toEqual([
      'collection:menu.collections',
      'collection:menu.cashCollections',
      'collection:menu.acrs',
      'collection:menu.deposits',
      'collection:menu.attempts',
      'collection:menu.ready',
    ])

    // …and the converse: the assignment grant alone gives that one item and no grid.
    expect(visible(ASSIGNMENT)).toEqual(['collection:menu.collections', 'collection:menu.assignment'])
  })

  it('🚩 none granted → NO group at all, not an empty one', () => {
    expect(resolveMenu([collections!], holding()).items).toEqual([])
  })

  it('🚩 near-miss keys, a failed or a pending answer hide the group too', () => {
    for (const p of [
      holding('CollectionInquiry:02', 'AcrInquiry:06', 'SettlementSupervision:03', 'CollectionAssignment:02'),
      errored,
      pending,
    ]) {
      expect(resolveMenu([collections!], p).items).toEqual([])
    }
  })

  it('🚩 Ready is its own grant — it lights one leaf, and Collections does not light it', () => {
    expect(visible(READY)).toEqual(['collection:menu.collections', 'collection:menu.ready'])
    expect(visible(COLLECTIONS)).toEqual(['collection:menu.collections', 'collection:menu.cashCollections'])
  })

  it('🚩 a collector supervisor (BackOffice 1995) sees the five read screens and no act', () => {
    // Five reads granted, the acts (assignment, settlement, supervision) not. Nothing is keyed off the role name.
    expect(visible(COLLECTIONS, ACRS, DEPOSITS, ATTEMPTS, READY)).toEqual([
      'collection:menu.collections',
      'collection:menu.cashCollections',
      'collection:menu.acrs',
      'collection:menu.deposits',
      'collection:menu.attempts',
      'collection:menu.ready',
    ])
  })

  it('reports an errored answer as SETTLED — failing closed must not hang the menu', () => {
    expect(resolveMenu([collections!], errored).settled).toBe(true)
  })
})

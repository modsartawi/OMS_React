/**
 * The Collections nav group, gated (ticket 253, spec 249 §"Getting in").
 *
 * `resolveMenu` is the pure half of `useVisibleMenu` (ticket 124), so what the
 * shell does with each answer the one Collections probe can produce is provable
 * with no renderer — which, while the `CollectionWeb` door is unbuilt, is the
 * only non-Playwright proof this slice has. The group is read out of the **real**
 * `MENU`, never re-declared, so a leaf that lost its probe, drifted off the
 * shared key or picked up the wrong flag fails here.
 *
 * 🚩 The two failures being designed against: an area of finance screens left in
 * the nav because a probe errored, and a **uniform** group — four items shown
 * because one grant was held — which would offer a supervisor three screens the
 * server will refuse.
 */
import { describe, expect, it } from 'vitest'
import { COLLECTION_ACCESS_KEY } from '@/core/collection/api'
import { MENU, type ShellMenuItem } from './menu-model'
import { resolveMenu, type ProbeState } from './useVisibleMenu'

const collections = MENU.find((g) => g.labelKey === 'collection:menu.collections')

const gatedLeaves = (items: ShellMenuItem[]): ShellMenuItem[] =>
  items.flatMap((i) => [...(i.access ? [i] : []), ...gatedLeaves(i.items ?? [])])
const labels = (items: ShellMenuItem[]): string[] =>
  items.flatMap((i) => [i.labelKey, ...labels(i.items ?? [])])

const ALL = {
  canOpenCollections: true,
  canOpenAcrs: true,
  canOpenDeposits: true,
  canOpenAttempts: true,
  canOpenAssignment: true,
  canOpenSettlement: true,
}
const NONE = {
  canOpenCollections: false,
  canOpenAcrs: false,
  canOpenDeposits: false,
  canOpenAttempts: false,
  canOpenAssignment: false,
  canOpenSettlement: false,
}

/**
 * The settlement item, flattened: since ticket 284 it is a **node** with four
 * children (283's four paths), so every `labels()` expectation below carries five
 * entries where it once carried one. The grant did not move — it is still ONE probe
 * on the node, which is why nothing about the ragged-group rules changes.
 */
const SETTLEMENT_NODE = [
  'settlement:menu.settlement',
  'settlement:menu.overview',
  'settlement:menu.open',
  'settlement:menu.ledger',
  'settlement:menu.upload',
]

/** One probe answer, repeated once per gated leaf — they all read the SAME call. */
const probed = (data: unknown): ProbeState[] =>
  gatedLeaves([collections!]).map(() => ({ isPending: false, isSuccess: true, data }))
/** An errored probe: settled, unsuccessful, no data — the thrown-probe case. */
const errored: ProbeState[] = gatedLeaves([collections!]).map(() => ({
  isPending: false,
  isSuccess: false,
  data: undefined,
}))
const pending: ProbeState[] = gatedLeaves([collections!]).map(() => ({
  isPending: true,
  isSuccess: false,
  data: undefined,
}))

describe('the Collections nav group', () => {
  it('exists, with all five leaves gated behind the ONE shared key', () => {
    expect(collections).toBeDefined()
    const leaves = gatedLeaves([collections!])
    expect(leaves.map((l) => l.routerLink)).toEqual([
      '/collection/collections',
      '/collection/acrs',
      '/collection/deposits',
      '/collection/attempts',
      '/collection/assignment',
      // The fifth leaf (ticket 268) — the accountant's settlement account, a
      // SECOND feature under this one group and one prefix rather than an area of
      // its own, and therefore a fifth grant on this same probe.
      '/collection/settlement',
    ])
    // ONE call for the whole area: every leaf's probe key is the SAME exported
    // constant the four screens' own guards read. That identity is what makes a
    // gated area cost one round trip, and what stops the nav and a screen
    // disagreeing about whether the session is allowed in.
    for (const leaf of leaves) expect(leaf.access!.key).toBe(COLLECTION_ACCESS_KEY)
  })

  it('all five granted → five items under one Collections group', () => {
    expect(labels(resolveMenu([collections!], probed(ALL)).items)).toEqual([
      'collection:menu.collections',
      'collection:menu.cashCollections',
      'collection:menu.acrs',
      'collection:menu.deposits',
      'collection:menu.attempts',
      'collection:menu.assignment',
      // 🚩 Its own namespace, not `collection`'s: the settlement account is its own
      // feature and its keys live in `settlement.json`. A leaf whose namespace was
      // never registered renders this raw key to a user — and since 284 that is five
      // keys, the node plus its four screens.
      ...SETTLEMENT_NODE,
    ])
  })

  it('🚩 one granted → a RAGGED group with exactly that item', () => {
    // A user granted only Deposits sees one item, not three that would bounce
    // them. Each leaf reads its own flag off the one answer, so the group is as
    // wide as the grants and no wider.
    expect(
      labels(resolveMenu([collections!], probed({ ...NONE, canOpenDeposits: true })).items),
    ).toEqual(['collection:menu.collections', 'collection:menu.deposits'])

    expect(
      labels(resolveMenu([collections!], probed({ ...NONE, canOpenAcrs: true })).items),
    ).toEqual(['collection:menu.collections', 'collection:menu.acrs'])

    // 🚩 And the fifth grant is as independent as the other four: an accountant
    // granted ONLY the settlement account gets that one leaf — not the four
    // inquiries the server would refuse them. The reverse is pinned in each
    // feature's own access test.
    expect(
      labels(resolveMenu([collections!], probed({ ...NONE, canOpenSettlement: true })).items),
    ).toEqual(['collection:menu.collections', ...SETTLEMENT_NODE])

    // Two grants, and they are the two that were granted — not the first two.
    expect(
      labels(
        resolveMenu([collections!], probed({ ...NONE, canOpenCollections: true, canOpenAttempts: true }))
          .items,
      ),
    ).toEqual([
      'collection:menu.collections',
      'collection:menu.cashCollections',
      'collection:menu.attempts',
    ])

    // 🚩 BackOffice 1169's own version of the rule, and the one with teeth: a
    // session holding ALL FOUR read grants still does not see Collection
    // Assignment. Reading a collection list never implies rewriting the master
    // data those lists filter by, and the grant behind that screen is its own.
    //
    // Settlement is held out too, so this assertion is about the ONE grant it
    // names. Its own independence is 268's test, next door.
    expect(
      labels(
        resolveMenu(
          [collections!],
          probed({ ...ALL, canOpenAssignment: false, canOpenSettlement: false }),
        ).items,
      ),
    ).toEqual([
      'collection:menu.collections',
      'collection:menu.cashCollections',
      'collection:menu.acrs',
      'collection:menu.deposits',
      'collection:menu.attempts',
    ])

    // …and the converse: bound to COLLECTION_ASSIGNMENT alone, they get that one
    // item and no grid.
    expect(
      labels(resolveMenu([collections!], probed({ ...NONE, canOpenAssignment: true })).items),
    ).toEqual(['collection:menu.collections', 'collection:menu.assignment'])
  })

  it('🚩 none granted → NO group at all, not an empty one', () => {
    // The header vanishes with its children, so a "Collections" heading is never
    // left standing over nothing.
    expect(resolveMenu([collections!], probed(NONE)).items).toEqual([])
  })

  it('🚩 an unknown, failed or malformed probe hides the group too', () => {
    for (const states of [
      errored,
      pending,
      probed({}),
      probed(null),
      probed({
        canOpenCollections: 'true',
        canOpenAcrs: 1,
        canOpenDeposits: {},
        canOpenAttempts: [],
        canOpenAssignment: 'yes',
        canOpenSettlement: 'yes',
      }),
      // The shape a different door might answer — a single flag for the area.
      probed({ canOpen: true }),
    ]) {
      expect(resolveMenu([collections!], states).items).toEqual([])
    }
  })

  it('🚩 the FOUR-boolean answer the live door returns today hides ONLY the fifth leaf', () => {
    // Every flag this group's first four leaves need, and `canOpenSettlement`
    // simply absent — which is what `CollectionWeb/Access` actually returns until
    // BackOffice spec 1173 ships the flag (ticket 274 joins the waves). The
    // settlement leaf is the one that vanishes: a probe answering the older shape
    // must not take the four working screens down with it, and must not leak the
    // fifth.
    expect(
      labels(
        resolveMenu(
          [collections!],
          probed({
            canOpenCollections: true,
            canOpenAcrs: true,
            canOpenDeposits: true,
            canOpenAttempts: true,
          }),
        ).items,
      ),
    ).toEqual([
      'collection:menu.collections',
      'collection:menu.cashCollections',
      'collection:menu.acrs',
      'collection:menu.deposits',
      'collection:menu.attempts',
    ])
  })

  it('reports an errored probe as SETTLED — failing closed must not hang the menu', () => {
    expect(resolveMenu([collections!], errored).settled).toBe(true)
  })
})

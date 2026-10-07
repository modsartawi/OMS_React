/**
 * `isActive` — which leaf the nav highlights (ticket 284, spec 282 D2).
 *
 * The matcher reads a pathname and nothing else, so the whole rule is provable with
 * no router and no renderer. What it is defending against is one specific, permanent
 * wrong answer: the settlement Overview sits at `/collection/settlement`, which is a
 * **prefix** of the three screens beside it, so a plain `startsWith` lights two leaves
 * at once on three of the four screens — every time, for everyone.
 *
 * 🚩 The settlement node is read out of the **real** `MENU`, never re-declared, so a
 * leaf that lost `exact` or drifted off its path fails here.
 */
import { describe, expect, it } from 'vitest'
import settlementLocale from '@/locales/en/settlement.json'
import { deriveCrumb } from './crumb'
import { isActive, markedLeaf, MENU, type ShellMenuItem } from './menu-model'

const OVERVIEW = '/collection/settlement'
const OPEN = `${OVERVIEW}/open`
const LEDGER = `${OVERVIEW}/ledger`
const UPLOAD = `${OVERVIEW}/upload`
const ALL_FOUR = [OVERVIEW, OPEN, LEDGER, UPLOAD]

const collections = MENU.find((g) => g.labelKey === 'collection:menu.collections')!
const settlement = (collections.items ?? []).find(
  (i) => i.labelKey === 'settlement:menu.settlement',
)!
const leaf = (labelKey: string): ShellMenuItem =>
  (settlement.items ?? []).find((i) => i.labelKey === labelKey)!

describe('the Settlement Account node', () => {
  it('is a node with exactly the four screens 283 addressed', () => {
    expect(settlement.routerLink).toBe(OVERVIEW)
    expect((settlement.items ?? []).map((i) => i.routerLink)).toEqual(ALL_FOUR)
    // Its label is its own namespace's; the group header above stays `collection`'s.
    expect((settlement.items ?? []).map((i) => i.labelKey)).toEqual([
      'settlement:menu.overview',
      'settlement:menu.open',
      'settlement:menu.ledger',
      'settlement:menu.upload',
    ])
  })

  it('menu and title read Settlement Account', () => {
    // Ticket 340 (BackOffice spec 2149 D13): one name for the ledger on every screen.
    // The node's key is read off the real MENU and resolved against the real bundle.
    expect(settlement.labelKey).toBe('settlement:menu.settlement')
    expect(settlementLocale.menu.settlement).toBe('Settlement Account')
    expect(settlementLocale.title).toBe('Settlement Account')
  })

  it('🚩 keeps the ONE grant on the node — no child mints a second gate', () => {
    // One grant opens all four views; `filterMenu` drops the node and everything
    // under it when the session does not hold it. A probe copied onto each child
    // would be four chances to key one of them wrong.
    expect(settlement.access).toBeDefined()
    for (const child of settlement.items ?? []) expect(child.access).toBeUndefined()
  })
})

describe('isActive — an EXACT leaf does not claim its siblings’ paths', () => {
  const overview = () => leaf('settlement:menu.overview')

  it('the Overview is active on its own path and NOWHERE else', () => {
    expect(overview().exact).toBe(true)
    expect(isActive(overview(), OVERVIEW)).toBe(true)
    for (const path of [OPEN, LEDGER, UPLOAD]) {
      expect(isActive(overview(), path)).toBe(false)
    }
    // …including a screen a later slice hangs under one of them.
    expect(isActive(overview(), `${OPEN}/anything`)).toBe(false)
  })

  it('the three non-exact leaves each match their own path and no sibling', () => {
    for (const [labelKey, own] of [
      ['settlement:menu.open', OPEN],
      ['settlement:menu.ledger', LEDGER],
      ['settlement:menu.upload', UPLOAD],
    ] as const) {
      for (const path of ALL_FOUR) {
        expect([labelKey, path, isActive(leaf(labelKey), path)]).toEqual([
          labelKey,
          path,
          path === own,
        ])
      }
    }
  })

  it('🚩 exactly ONE leaf is highlighted on each of the four screens', () => {
    // The whole point, stated as the reader sees it. Without `exact` the Overview
    // would make this two on three of the four rows.
    for (const path of ALL_FOUR) {
      const lit = (settlement.items ?? []).filter((i) => isActive(i, path))
      expect([path, lit.map((i) => i.labelKey)]).toEqual([
        path,
        [
          {
            [OVERVIEW]: 'settlement:menu.overview',
            [OPEN]: 'settlement:menu.open',
            [LEDGER]: 'settlement:menu.ledger',
            [UPLOAD]: 'settlement:menu.upload',
          }[path],
        ],
      ])
    }
  })

  it('the node itself still claims the whole subtree — the GROUP stays expanded', () => {
    // The node's own row is not drawn from this (it takes its emphasis from having
    // an active child), but the Collections group above asks it, and a collapsed
    // group on three of the four screens would hide the leaf that says where you are.
    for (const path of ALL_FOUR) expect(isActive(settlement, path)).toBe(true)
    expect(isActive(settlement, '/collection/deposits')).toBe(false)
  })
})

describe('isActive — the rule the other leaves have always had is unchanged', () => {
  const plain = (routerLink: string, extra: Partial<ShellMenuItem> = {}): ShellMenuItem => ({
    labelKey: 'x',
    routerLink,
    ...extra,
  })

  it('matches its own path and anything under it', () => {
    expect(isActive(plain('/loy/members'), '/loy/members')).toBe(true)
    expect(isActive(plain('/loy/members'), '/loy/members/9001')).toBe(true)
  })

  it('does NOT match a sibling that merely starts with the same letters', () => {
    // `/admin/ua-users` must not light on `/admin/ua-users-archive`.
    expect(isActive(plain('/admin/ua-users'), '/admin/ua-users-archive')).toBe(false)
  })

  it('honours activePrefix over routerLink', () => {
    const item = plain('/nphies/eligibility/new', { activePrefix: '/nphies/eligibility' })
    expect(isActive(item, '/nphies/eligibility')).toBe(true)
    expect(isActive(item, '/nphies/authorizations')).toBe(false)
  })

  it('an item with neither is never active — a group header is not a destination', () => {
    expect(isActive({ labelKey: 'g', items: [] }, '/anything')).toBe(false)
  })

  it('🚩 exact wins over activePrefix, and matches the item’s OWN link', () => {
    // Nothing sets both today — they are opposite requests. But the narrow answer is
    // the safe one: an item highlighting on a path it does not link to is the worse
    // of the two wrong answers.
    const item = plain('/a/b', { activePrefix: '/a', exact: true })
    expect(isActive(item, '/a/b')).toBe(true)
    expect(isActive(item, '/a')).toBe(false)
  })

  it('⚠️ a trailing slash is the same screen — the nav does not go dark on one', () => {
    // `isOverviewPath` (283) already strips it, so `/collection/settlement/` DRAWS
    // the door. A matcher that disagreed would leave that address highlighting
    // nothing, with the sub-menu collapsed around it.
    expect(isActive(leaf('settlement:menu.overview'), `${OVERVIEW}/`)).toBe(true)
    expect(isActive(leaf('settlement:menu.ledger'), `${LEDGER}/`)).toBe(true)
    expect(isActive(settlement, `${OVERVIEW}/`)).toBe(true)
    // …and the root is still the root, not an empty string.
    expect(isActive(plain('/'), '/')).toBe(true)
  })
})

describe('the OMS group — one leaf lit per screen (ticket 332)', () => {
  const oms = MENU.find((g) => g.labelKey === 'deliveries:menu.oms')!
  const lit = (path: string) => (oms.items ?? []).filter((i) => isActive(i, path)).map((i) => i.labelKey)

  it('Deliveries owns the list and both document routes', () => {
    for (const path of ['/oms/deliveries', '/oms/document/2000000551', '/oms/delivery/8000000253'])
      expect([path, lit(path)]).toEqual([path, ['deliveries:menu.deliveries']])
  })

  it('🚩 the central-invoice screen lights its own leaf ALONE — not Deliveries beside it', () => {
    expect(lit('/oms/central-invoice')).toEqual(['central-invoice:menu.raise'])
  })

  it('the central-invoice leaf carries its OWN probe, not the OMS one', () => {
    const leaf = (oms.items ?? []).find((i) => i.labelKey === 'central-invoice:menu.raise')!
    expect(leaf.access?.key).toEqual(['central-invoice', 'access'])
  })

  it('the list (ticket 333) lights its own leaf alone, and the raise screen does not light it', () => {
    expect(lit('/oms/central-invoices')).toEqual(['central-invoice:menu.list'])
    expect(lit('/oms/central-invoice')).toEqual(['central-invoice:menu.raise'])
  })

  it('the list leaf reads the SAME probe entry as the raise leaf, so one 403 drops both', () => {
    const leaf = (oms.items ?? []).find((i) => i.labelKey === 'central-invoice:menu.list')!
    expect(leaf.access?.key).toEqual(['central-invoice', 'access'])
  })

  // Spec 430 D18 / ticket 431: the wave's leaves follow the two central-invoicing ones.
  it('Donor requests follows Central invoicing, lit alone on its own screen', () => {
    const keys = (oms.items ?? []).map((i) => i.labelKey)
    expect(keys.indexOf('donor-requests:menu.donorRequests')).toBe(keys.indexOf('central-invoice:menu.list') + 1)
    expect(lit('/oms/donor-requests')).toEqual(['donor-requests:menu.donorRequests'])
  })

  it('🚩 Donor requests reads its OWN flag off the ONE OMS probe entry, and an absent flag hides it', () => {
    const leaf = (oms.items ?? []).find((i) => i.labelKey === 'donor-requests:menu.donorRequests')!
    expect(leaf.access?.key).toEqual(['oms', 'access'])
    expect(leaf.access?.visible({ canOpenList: true, canOpenDetail: true })).toBe(false)
    expect(leaf.access?.visible({ canOpenList: false, canOpenDetail: false, canOpenDonorRequests: true })).toBe(true)
  })

  // D18: Donor requests, Failed donor transfers (434), Document payments (433).
  it('Document payments comes after Donor requests, lit alone on its own screen', () => {
    const keys = (oms.items ?? []).map((i) => i.labelKey)
    expect(keys.indexOf('document-payments:menu.documentPayments')).toBeGreaterThan(keys.indexOf('donor-requests:menu.donorRequests'))
    expect(keys.indexOf('donor-requests:menu.donorRequests')).toBeGreaterThanOrEqual(0)
    expect(lit('/oms/document-payments')).toEqual(['document-payments:menu.documentPayments'])
  })

  it('Failed donor transfers sits between Donor requests and Document payments, lit alone', () => {
    const keys = (oms.items ?? []).map((i) => i.labelKey)
    const at = keys.indexOf('failed-donor-transfers:menu.failedDonorTransfers')
    expect(at).toBe(keys.indexOf('donor-requests:menu.donorRequests') + 1)
    expect(keys.indexOf('document-payments:menu.documentPayments')).toBe(at + 1)
    expect(lit('/oms/failed-donor-transfers')).toEqual(['failed-donor-transfers:menu.failedDonorTransfers'])
  })

  it('🚩 Failed donor transfers reads its OWN flag off the ONE OMS probe entry; the re-run flag alone does not show it', () => {
    const leaf = (oms.items ?? []).find((i) => i.labelKey === 'failed-donor-transfers:menu.failedDonorTransfers')!
    expect(leaf.access?.key).toEqual(['oms', 'access'])
    expect(leaf.access?.visible({ canOpenList: true, canOpenDetail: true, canReRunFailedTransfer: true })).toBe(false)
    expect(leaf.access?.visible({ canOpenList: false, canOpenDetail: false, canOpenFailedTransfers: true })).toBe(true)
  })

  it('🚩 Document payments reads its OWN flag off the ONE OMS probe entry, and an absent flag hides it', () => {
    const leaf = (oms.items ?? []).find((i) => i.labelKey === 'document-payments:menu.documentPayments')!
    expect(leaf.access?.key).toEqual(['oms', 'access'])
    expect(leaf.access?.visible({ canOpenList: true, canOpenDetail: true, canOpenDonorRequests: true })).toBe(false)
    expect(leaf.access?.visible({ canOpenList: false, canOpenDetail: false, canOpenDocumentPayments: true })).toBe(true)
  })
})

describe('markedLeaf — the rail marks ONE leaf, the most specific claimant (ticket 391)', () => {
  const marked = (pathname: string) => markedLeaf(MENU, pathname)?.labelKey ?? null

  it('🚩 New check, not the list that owns its subtree, on /nphies/eligibility/new', () => {
    // Both claim the address — the list through `activePrefix`, New check by its own link —
    // and `isActive` says yes to both, so the rail drew two gold markers.
    expect(marked('/nphies/eligibility/new')).toBe('eligibility:menu.newCheck')
  })

  it('the list on its own address and on a record under it', () => {
    expect(marked('/nphies/eligibility')).toBe('eligibility:menu.list')
    expect(marked('/nphies/eligibility/42')).toBe('eligibility:menu.list')
  })

  it('the settlement Overview leaf on the sub-group’s own address, never the sub-group header', () => {
    expect(marked(OVERVIEW)).toBe('settlement:menu.overview')
    expect(marked(LEDGER)).toBe('settlement:menu.ledger')
  })

  it('a plain leaf, and nothing on an address no leaf claims', () => {
    expect(marked('/oms/deliveries')).toBe('deliveries:menu.deliveries')
    expect(marked('/nowhere')).toBeNull()
  })

  it('🚩 breaks a tie the crumb’s way — the deeper leaf — so the two never disagree', () => {
    const menu: ShellMenuItem[] = [
      {
        labelKey: 'group',
        items: [
          { labelKey: 'shallow', routerLink: '/a' },
          { labelKey: 'sub', routerLink: '/b', items: [{ labelKey: 'deep', routerLink: '/a' }] },
        ],
      },
    ]
    expect(markedLeaf(menu, '/a')?.labelKey).toBe('deep')
    expect(deriveCrumb(menu, '/a').trail.at(-1)).toBe('deep')
  })

  it('agrees with isActive: the leaf it returns is active there', () => {
    for (const path of ['/nphies/eligibility/new', OPEN, UPLOAD, '/oms/deliveries'])
      expect(isActive(markedLeaf(MENU, path)!, path)).toBe(true)
  })
})

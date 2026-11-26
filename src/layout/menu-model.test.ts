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
import { permissionsFromQuery, permissionsOf } from '@/core/permissions'
import { isActive, markedLeaf, MENU, type ShellMenuItem } from './menu-model'
import { isGated, resolveMenu } from './useVisibleMenu'

/** oms 914: whether a leaf shows for a session holding exactly these keys of the one permissions answer. */
const shows = (item: ShellMenuItem, ...screens: string[]): boolean =>
  resolveMenu([{ ...item, items: undefined }], permissionsOf({ screens })).items.length > 0
/** A pending and an errored answer both hide a gated leaf. */
const hiddenWhileUnsettled = (item: ShellMenuItem): boolean =>
  [
    permissionsFromQuery({ isPending: true, isError: false, data: undefined }),
    permissionsFromQuery({ isPending: false, isError: true, data: undefined }),
  ].every((p) => resolveMenu([{ ...item, items: undefined }], p).items.length === 0)

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
    // One grant opens all four views; `filterMenu` drops the node and everything under it when the session does not
    // hold it. A gate copied onto each child would be four chances to key one of them wrong.
    expect(isGated(settlement)).toBe(true)
    for (const child of settlement.items ?? []) expect(isGated(child)).toBe(false)
    expect(resolveMenu([settlement], permissionsOf({ screens: ['SettlementAccount:03'] })).items).toHaveLength(1)
    expect(resolveMenu([settlement], permissionsOf({ screens: [] })).items).toHaveLength(0)
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

  it('the central-invoice leaf reads its OWN key (CentralInvoice:03), not the OMS one', () => {
    const leaf = (oms.items ?? []).find((i) => i.labelKey === 'central-invoice:menu.raise')!
    expect(shows(leaf, 'CentralInvoice:03')).toBe(true)
    expect(shows(leaf, 'DocumentList:03', 'DocumentDetails:03')).toBe(false)
  })

  it('the list (ticket 333) lights its own leaf alone, and the raise screen does not light it', () => {
    expect(lit('/oms/central-invoices')).toEqual(['central-invoice:menu.list'])
    expect(lit('/oms/central-invoice')).toEqual(['central-invoice:menu.raise'])
  })

  it('the list leaf reads the SAME key as the raise leaf', () => {
    const leaf = (oms.items ?? []).find((i) => i.labelKey === 'central-invoice:menu.list')!
    expect(shows(leaf, 'CentralInvoice:03')).toBe(true)
    expect(shows(leaf, 'DocumentList:03')).toBe(false)
  })

  // Spec 430 D18 / ticket 431: the wave's leaves follow the two central-invoicing ones.
  it('Donor requests follows Central invoicing, lit alone on its own screen', () => {
    const keys = (oms.items ?? []).map((i) => i.labelKey)
    expect(keys.indexOf('donor-requests:menu.donorRequests')).toBe(keys.indexOf('central-invoice:menu.list') + 1)
    expect(lit('/oms/donor-requests')).toEqual(['donor-requests:menu.donorRequests'])
  })

  it('🚩 Donor requests reads its OWN key (DonorRequestInquiry:03), and the list keys alone hide it', () => {
    const leaf = (oms.items ?? []).find((i) => i.labelKey === 'donor-requests:menu.donorRequests')!
    expect(shows(leaf, 'DocumentList:03', 'DocumentDetails:03')).toBe(false)
    expect(shows(leaf, 'DonorRequestInquiry:03')).toBe(true)
    expect(hiddenWhileUnsettled(leaf)).toBe(true)
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

  it('🚩 Failed donor transfers reads its OWN key (FailedDonorTransfers:03); the re-run key alone does not show it', () => {
    const leaf = (oms.items ?? []).find((i) => i.labelKey === 'failed-donor-transfers:menu.failedDonorTransfers')!
    expect(shows(leaf, 'DocumentList:03', 'FailedDonorTransfers:06')).toBe(false)
    expect(shows(leaf, 'FailedDonorTransfers:03')).toBe(true)
  })

  it('🚩 Document payments reads its OWN key (DocumentPaymentInquiry:03), and a neighbour’s key hides it', () => {
    const leaf = (oms.items ?? []).find((i) => i.labelKey === 'document-payments:menu.documentPayments')!
    expect(shows(leaf, 'DocumentList:03', 'DonorRequestInquiry:03')).toBe(false)
    expect(shows(leaf, 'DocumentPaymentInquiry:03')).toBe(true)
  })

  it('Cities & districts follows Document payments (D18), lit alone on its own screen', () => {
    const keys = (oms.items ?? []).map((i) => i.labelKey)
    expect(keys.indexOf('geography:menu.geography')).toBe(keys.indexOf('document-payments:menu.documentPayments') + 1)
    expect(lit('/oms/geography')).toEqual(['geography:menu.geography'])
  })

  it('🚩 Cities & districts reads SdCityInquiry:03 OR SdDistrictInquiry:03; an import key alone does not show it', () => {
    const leaf = (oms.items ?? []).find((i) => i.labelKey === 'geography:menu.geography')!
    expect(shows(leaf, 'DocumentList:03', 'SdCityImport:03', 'SdDistrictImport:03')).toBe(false)
    expect(shows(leaf, 'SdCityInquiry:03')).toBe(true)
    expect(shows(leaf, 'SdDistrictInquiry:03')).toBe(true)
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

describe('the Delivery statistics leaf (ticket 484)', () => {
  const oms = MENU.find((g) => g.labelKey === 'deliveries:menu.oms')!
  const leaf = (oms.items ?? []).find((i) => i.labelKey === 'delivery-statistics:menu.deliveryStatistics')!

  it('sits last in the OMS group, lit alone on its own screen', () => {
    const keys = (oms.items ?? []).map((i) => i.labelKey)
    expect(keys.at(-1)).toBe('delivery-statistics:menu.deliveryStatistics')
    expect((oms.items ?? []).filter((i) => isActive(i, '/oms/delivery-statistics')).map((i) => i.labelKey)).toEqual([
      'delivery-statistics:menu.deliveryStatistics',
    ])
  })

  it('🚩 reads the OMS LIST key (DocumentList:03), and fails closed without it', () => {
    expect(shows(leaf, 'DocumentList:03')).toBe(true)
    expect(shows(leaf, 'DocumentDetails:03', 'DonorRequestInquiry:03')).toBe(false)
    expect(hiddenWhileUnsettled(leaf)).toBe(true)
  })
})

describe('the Pick support leaf (ticket 496)', () => {
  const oms = MENU.find((g) => g.labelKey === 'deliveries:menu.oms')!
  const leaf = (oms.items ?? []).find((i) => i.labelKey === 'pick-support:menu.pickSupport')!

  it('sits in the OMS group just before Delivery statistics, lit alone on its own screen', () => {
    const keys = (oms.items ?? []).map((i) => i.labelKey)
    expect(keys.at(-2)).toBe('pick-support:menu.pickSupport')
    expect(leaf.routerLink).toBe('/oms/pick-support')
    expect((oms.items ?? []).filter((i) => isActive(i, '/oms/pick-support')).map((i) => i.labelKey)).toEqual([
      'pick-support:menu.pickSupport',
    ])
  })

  it('🚩 reads PickSupport:03, and fails closed without it (the fix or serial key alone does not show it)', () => {
    expect(shows(leaf, 'PickSupport:03')).toBe(true)
    for (const miss of ['PickSupport:06', 'PickSupportSerial:03', 'DocumentList:03']) expect(shows(leaf, miss)).toBe(false)
    expect(shows(leaf)).toBe(false)
    expect(hiddenWhileUnsettled(leaf)).toBe(true)
  })
})

describe('the Dispatch scorecard leaf (ticket 543)', () => {
  const oms = MENU.find((g) => g.labelKey === 'deliveries:menu.oms')!
  const leaf = (oms.items ?? []).find((i) => i.labelKey === 'dispatch-scorecard:menu.dispatchScorecard')!

  it('sits in the OMS group, lit alone on its own screen', () => {
    expect(leaf.routerLink).toBe('/oms/dispatch-scorecard')
    expect((oms.items ?? []).filter((i) => isActive(i, '/oms/dispatch-scorecard')).map((i) => i.labelKey)).toEqual([
      'dispatch-scorecard:menu.dispatchScorecard',
    ])
  })

  it('🚩 reads its OWN key (DispatchScorecard:03), and fails closed without it', () => {
    expect(shows(leaf, 'DispatchScorecard:03')).toBe(true)
    for (const miss of ['DispatchScorecard:06', 'DispatchBoard:03']) expect(shows(leaf, miss)).toBe(false)
    expect(shows(leaf)).toBe(false)
    expect(hiddenWhileUnsettled(leaf)).toBe(true)
  })
})

describe('the Closes after a take leaf (ticket 758)', () => {
  const oms = MENU.find((g) => g.labelKey === 'deliveries:menu.oms')!
  const leaf = (oms.items ?? []).find((i) => i.labelKey === 'dispatch-scorecard:menu.closesAfterTake')!

  it('sits in the OMS group right after the scorecard, and the rail marks it (not the scorecard) on its own page', () => {
    const keys = (oms.items ?? []).map((i) => i.labelKey)
    expect(keys.indexOf('dispatch-scorecard:menu.closesAfterTake')).toBe(keys.indexOf('dispatch-scorecard:menu.dispatchScorecard') + 1)
    expect(leaf.routerLink).toBe('/oms/dispatch-scorecard/closes')
    expect(markedLeaf(MENU, '/oms/dispatch-scorecard/closes')?.labelKey).toBe('dispatch-scorecard:menu.closesAfterTake')
    expect(markedLeaf(MENU, '/oms/dispatch-scorecard')?.labelKey).toBe('dispatch-scorecard:menu.dispatchScorecard')
  })

  it('🚩 reads the scorecard’s OWN key (no new grant), failing closed', () => {
    expect(shows(leaf, 'DispatchScorecard:03')).toBe(true)
    for (const miss of ['DispatchBoard:03']) expect(shows(leaf, miss)).toBe(false)
    expect(shows(leaf)).toBe(false)
    expect(hiddenWhileUnsettled(leaf)).toBe(true)
  })
})

describe('the Serial refusals leaf (ticket 573)', () => {
  const oms = MENU.find((g) => g.labelKey === 'deliveries:menu.oms')!
  const leaf = (oms.items ?? []).find((i) => i.labelKey === 'serial-refusals:menu.serialRefusals')!

  it('sits in the OMS group right after the scorecard and its closes report, lit alone on its own screen', () => {
    const keys = (oms.items ?? []).map((i) => i.labelKey)
    expect(keys.indexOf('serial-refusals:menu.serialRefusals')).toBe(keys.indexOf('dispatch-scorecard:menu.closesAfterTake') + 1)
    expect(leaf.routerLink).toBe('/oms/serial-refusals')
    expect((oms.items ?? []).filter((i) => isActive(i, '/oms/serial-refusals')).map((i) => i.labelKey)).toEqual([
      'serial-refusals:menu.serialRefusals',
    ])
  })

  it('🚩 reads its OWN key (SerialRefusal:03), and fails closed without it', () => {
    expect(shows(leaf, 'SerialRefusal:03')).toBe(true)
    for (const miss of ['SerialRefusal:06']) expect(shows(leaf, miss)).toBe(false)
    expect(shows(leaf)).toBe(false)
    expect(hiddenWhileUnsettled(leaf)).toBe(true)
  })
})

describe('the Expired approval picks leaf (BackOffice ticket 3874)', () => {
  const oms = MENU.find((g) => g.labelKey === 'deliveries:menu.oms')!
  const leaf = (oms.items ?? []).find((i) => i.labelKey === 'expired-approval-picks:menu.expiredApprovalPicks')!

  it('sits in the OMS group right after Serial refusals, lit alone on its own screen', () => {
    const keys = (oms.items ?? []).map((i) => i.labelKey)
    expect(keys.indexOf('expired-approval-picks:menu.expiredApprovalPicks')).toBe(keys.indexOf('serial-refusals:menu.serialRefusals') + 1)
    expect(leaf.routerLink).toBe('/oms/expired-approval-picks')
    expect((oms.items ?? []).filter((i) => isActive(i, '/oms/expired-approval-picks')).map((i) => i.labelKey)).toEqual([
      'expired-approval-picks:menu.expiredApprovalPicks',
    ])
  })

  it('🚩 reads its OWN key (ExpiredApprovalPick:03), and fails closed without it', () => {
    expect(shows(leaf, 'ExpiredApprovalPick:03')).toBe(true)
    for (const miss of ['ExpiredApprovalPick:06']) expect(shows(leaf, miss)).toBe(false)
    expect(shows(leaf)).toBe(false)
    expect(hiddenWhileUnsettled(leaf)).toBe(true)
  })
})

describe('the Stock group (owner, 2026-11-20)', () => {
  const stock = MENU.find((g) => g.labelKey === 'stock-health:menu.stock')!
  const items = stock.items ?? []
  const leaf = (key: string) => items.find((i) => i.labelKey === key)!
  const LEAVES = [
    ['stock-health:menu.stockHealth', '/stock/health'],
    ['stock-console:menu.stockConsole', '/stock/console'],
    ['store-stages:menu.storeStages', '/stock/store-stages'],
    ['materials-search:menu.stockCheck', '/stock/check'],
    ['held-stock-report:menu.refusals', '/stock/refusals'],
    ['held-stock-report:menu.held', '/stock/held'],
    ['held-stock-report:menu.gates', '/stock/gates'],
    ['hold-daily-list:menu.holdDailyList', '/stock/stale-holds'],
    ['hybris-stock-stores:menu.hybrisStores', '/stock/hybris/stores'],
    ['hybris-stock-stores:menu.hybrisMaterials', '/stock/hybris/materials'],
    ['hybris-stock-stores:menu.hybrisPushes', '/stock/hybris/pushes'],
  ] as const

  it('is ONE group of its own, right after OMS', () => {
    expect(MENU.filter((g) => g.labelKey === 'stock-health:menu.stock')).toHaveLength(1)
    expect(MENU[MENU.indexOf(stock) - 1]?.labelKey).toBe('deliveries:menu.oms')
  })

  it('holds every stock screen, in order, each gated and lit alone on its own screen', () => {
    expect(items.map((i) => [i.labelKey, i.routerLink])).toEqual(LEAVES.map(([k, p]) => [k, p]))
    for (const [key, path] of LEAVES) {
      expect(isGated(leaf(key))).toBe(true)
      expect(items.filter((i) => isActive(i, path)).map((i) => i.labelKey)).toEqual([key])
    }
  })

  it('🚩 the screens left OMS, Materials and the old Hybris stock group, so no screen is listed twice', () => {
    const elsewhere = MENU.filter((g) => g !== stock).flatMap((g) => (g.items ?? []).map((i) => i.labelKey))
    for (const [key] of LEAVES) expect(elsewhere).not.toContain(key)
    expect(MENU.some((g) => g.labelKey === 'hybris-stock-stores:menu.hybrisStock')).toBe(false)
  })

  it('🚩 the held-stock reports all read the ONE key (HeldStockReport:03), and fail closed without it', () => {
    for (const key of ['held-stock-report:menu.refusals', 'held-stock-report:menu.held', 'held-stock-report:menu.gates']) {
      expect(shows(leaf(key), 'HeldStockReport:03')).toBe(true)
      expect(shows(leaf(key), 'HeldStockReport:06', 'HoldDailyList:03')).toBe(false)
      expect(hiddenWhileUnsettled(leaf(key))).toBe(true)
    }
  })

  it('🚩 the Stock console reads its OWN key (StockConsole:03), and fails closed without it', () => {
    const l = leaf('stock-console:menu.stockConsole')
    expect(shows(l, 'StockConsole:03')).toBe(true)
    for (const miss of ['StockHealth:03', 'StoreStage:03']) expect(shows(l, miss)).toBe(false)
    expect(shows(l)).toBe(false)
    expect(hiddenWhileUnsettled(l)).toBe(true)
  })

  it('🚩 Holds that should have ended reads its OWN key (HoldDailyList:03), and fails closed without it', () => {
    const l = leaf('hold-daily-list:menu.holdDailyList')
    expect(shows(l, 'HoldDailyList:03')).toBe(true)
    for (const miss of ['HoldDailyList:06', 'HeldStockReport:03']) expect(shows(l, miss)).toBe(false)
    expect(shows(l)).toBe(false)
    expect(hiddenWhileUnsettled(l)).toBe(true)
  })

  it('🚩 Store stages reads its OWN key (StoreStage:03), and fails closed without it (the move key alone does not show it)', () => {
    const l = leaf('store-stages:menu.storeStages')
    expect(shows(l, 'StoreStage:03')).toBe(true)
    for (const miss of ['StoreStage:02', 'StoreCountClose:02']) expect(shows(l, miss)).toBe(false)
    expect(shows(l)).toBe(false)
    expect(hiddenWhileUnsettled(l)).toBe(true)
  })
})

describe('the Serving lists leaf (ticket 567)', () => {
  const oms = MENU.find((g) => g.labelKey === 'deliveries:menu.oms')!
  const keys = (oms.items ?? []).map((i) => i.labelKey)
  const leaf = (oms.items ?? []).find((i) => i.labelKey === 'serving-lists:menu.servingLists')!

  it('sits in the OMS group right after the Dispatch board, lit alone on its screen and its detail', () => {
    expect(keys.indexOf('serving-lists:menu.servingLists')).toBe(keys.indexOf('dispatch-board:menu.dispatchBoard') + 1)
    expect(leaf.routerLink).toBe('/oms/serving-lists')
    for (const path of ['/oms/serving-lists', '/oms/serving-lists/SVL-1']) {
      expect((oms.items ?? []).filter((i) => isActive(i, path)).map((i) => i.labelKey)).toEqual(['serving-lists:menu.servingLists'])
    }
  })

  it('🚩 reads ServingList:03, and fails closed without it (the edit key alone does not show it)', () => {
    expect(shows(leaf, 'ServingList:03')).toBe(true)
    for (const miss of ['ServingList:06']) expect(shows(leaf, miss)).toBe(false)
    expect(shows(leaf)).toBe(false)
    expect(hiddenWhileUnsettled(leaf)).toBe(true)
  })
})

describe('the Sourcing advisor leaf (ticket 738)', () => {
  const oms = MENU.find((g) => g.labelKey === 'deliveries:menu.oms')!
  const leaf = (oms.items ?? []).find((i) => i.labelKey === 'sourcing-advisor:menu.sourcingAdvisor')!

  it('sits in the OMS group, lit alone on its own screen and its explanations', () => {
    expect(leaf.routerLink).toBe('/oms/sourcing-advisor')
    expect((oms.items ?? []).filter((i) => isActive(i, '/oms/sourcing-advisor/order/8000000253')).map((i) => i.labelKey)).toEqual([
      'sourcing-advisor:menu.sourcingAdvisor',
    ])
  })

  it('🚩 reads its OWN key (SourcingAdvisor:01 — deliberately Create), and fails closed without it', () => {
    expect(shows(leaf, 'SourcingAdvisor:01')).toBe(true)
    for (const miss of ['SourcingAdvisor:03']) expect(shows(leaf, miss)).toBe(false)
    expect(shows(leaf)).toBe(false)
    expect(hiddenWhileUnsettled(leaf)).toBe(true)
  })
})

describe('the Sourcing simulator leaf (ticket 962)', () => {
  const oms = MENU.find((g) => g.labelKey === 'deliveries:menu.oms')!
  const keys = (oms.items ?? []).map((i) => i.labelKey)
  const leaf = (oms.items ?? []).find((i) => i.labelKey === 'sourcing-simulator:menu.sourcingSimulator')!

  it('sits in the OMS group right after the Sourcing advisor, lit alone on its own screen', () => {
    expect(keys.indexOf('sourcing-simulator:menu.sourcingSimulator')).toBe(keys.indexOf('sourcing-advisor:menu.sourcingAdvisor') + 1)
    expect(leaf.routerLink).toBe('/oms/sourcing-simulator')
    expect((oms.items ?? []).filter((i) => isActive(i, '/oms/sourcing-simulator')).map((i) => i.labelKey)).toEqual([
      'sourcing-simulator:menu.sourcingSimulator',
    ])
  })

  it('🚩 reads the run grant (provisional SourcingAdvisorRun:06), not the view grant, and fails closed without it', () => {
    expect(shows(leaf, 'SourcingAdvisorRun:06')).toBe(true)
    expect(shows(leaf, 'SourcingAdvisor:01')).toBe(false)
    expect(shows(leaf)).toBe(false)
    expect(hiddenWhileUnsettled(leaf)).toBe(true)
  })
})

describe('the Road distance (Shadow) leaf (ticket 859)', () => {
  const oms = MENU.find((g) => g.labelKey === 'deliveries:menu.oms')!
  const keys = (oms.items ?? []).map((i) => i.labelKey)
  const leaf = (oms.items ?? []).find((i) => i.labelKey === 'dispatch-board:menu.roadShadow')!

  it('sits in the OMS group after Serving lists, and the rail marks it (not the board) on its own page', () => {
    expect(keys.indexOf('dispatch-board:menu.roadShadow')).toBe(keys.indexOf('serving-lists:menu.servingLists') + 1)
    expect(leaf.routerLink).toBe('/oms/dispatch-board/road-shadow')
    expect(markedLeaf(MENU, '/oms/dispatch-board/road-shadow')?.labelKey).toBe('dispatch-board:menu.roadShadow')
    expect(markedLeaf(MENU, '/oms/dispatch-board')?.labelKey).toBe('dispatch-board:menu.dispatchBoard')
  })

  it('🚩 reads the board’s OWN key (DispatchBoard:03, no new grant), failing closed', () => {
    expect(shows(leaf, 'DispatchBoard:03')).toBe(true)
    for (const miss of ['DispatchBoard:06']) expect(shows(leaf, miss)).toBe(false)
    expect(shows(leaf)).toBe(false)
    expect(hiddenWhileUnsettled(leaf)).toBe(true)
  })
})

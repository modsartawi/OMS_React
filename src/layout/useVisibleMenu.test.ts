import { describe, expect, it } from 'vitest'
import { permissionsFromQuery, permissionsOf, type Permissions } from '@/core/permissions'
import type { ShellMenuItem } from './menu-model'
import { offerAsked, resolveMenu } from './useVisibleMenu'

// Ticket 124's settled flag, on the one permissions answer since oms 914. `resolveMenu` is the pure half of
// `useVisibleMenu` — the hook only feeds it `usePermissions()` — so every rule about WHAT is visible and WHEN the answer
// is trustworthy is provable here, with no renderer.

/** Two gated leaves under one group (one by key, one by predicate), plus an ungated group. */
const MENU: ShellMenuItem[] = [
  { labelKey: 'g.open', items: [{ labelKey: 'l.open', routerLink: '/open' }] },
  {
    labelKey: 'g.gated',
    items: [
      { labelKey: 'l.a', routerLink: '/a', key: 'DocumentList:03' },
      { labelKey: 'l.b', routerLink: '/b', requires: (p) => p.has('Nphies:03') && p.has('NphiesUndispense:03') },
    ],
  },
]

const pending: Permissions = permissionsFromQuery({ isPending: true, isError: false, data: undefined })
const errored: Permissions = permissionsFromQuery({ isPending: false, isError: true, data: undefined })
const holding = (...screens: string[]): Permissions => permissionsOf({ screens })
const all = holding('DocumentList:03', 'Nphies:03', 'NphiesUndispense:03')

const labels = (items: ShellMenuItem[]): string[] => items.flatMap((i) => [i.labelKey, ...labels(i.items ?? [])])

describe('resolveMenu — settled', () => {
  it('is false while the answer is pending, and every gated item hides', () => {
    const r = resolveMenu(MENU, pending)
    expect(r.settled).toBe(false)
    expect(labels(r.items)).toEqual(['g.open', 'l.open'])
  })

  it('is true once the answer is in', () => {
    expect(resolveMenu(MENU, all).settled).toBe(true)
  })

  it('is true when the answer ERRORED — and every gated item hides', () => {
    const r = resolveMenu(MENU, errored)
    expect(r.settled).toBe(true)
    expect(labels(r.items)).toEqual(['g.open', 'l.open'])
  })

  it('an errored answer grants nothing even if a predicate would say yes to anything', () => {
    const lax: ShellMenuItem[] = [{ labelKey: 'g', items: [{ labelKey: 'l', routerLink: '/l', requires: () => true }] }]
    expect(resolveMenu(lax, errored).items).toEqual([])
    expect(resolveMenu(lax, pending).items).toEqual([])
    expect(labels(resolveMenu(lax, holding()).items)).toEqual(['g', 'l'])
  })
})

describe('resolveMenu — items', () => {
  it('keeps the ungated group and both granted leaves', () => {
    expect(labels(resolveMenu(MENU, all).items)).toEqual(['g.open', 'l.open', 'g.gated', 'l.a', 'l.b'])
  })

  it('a key leaf is an exact lookup', () => {
    expect(labels(resolveMenu(MENU, holding('DocumentList:02', 'Nphies:03')).items)).toEqual(['g.open', 'l.open'])
  })

  it('a predicate leaf shows only on its whole combination (half-grant hidden)', () => {
    expect(labels(resolveMenu(MENU, holding('DocumentList:03', 'NphiesUndispense:03')).items)).toEqual([
      'g.open',
      'l.open',
      'g.gated',
      'l.a',
    ])
  })

  it('drops a group whose gated children are all denied', () => {
    expect(labels(resolveMenu(MENU, holding()).items)).toEqual(['g.open', 'l.open'])
  })

  it('🚩 a NESTED node whose children all hide disappears with them', () => {
    // Ticket 284 added one more level to the nav; the drop-an-empty-group rule holds at any depth.
    const nested: ShellMenuItem[] = [
      {
        labelKey: 'g',
        items: [
          { labelKey: 'l.plain', routerLink: '/plain' },
          {
            labelKey: 'n',
            routerLink: '/n',
            items: [
              { labelKey: 'n.a', routerLink: '/n/a', key: 'AcrInquiry:03' },
              { labelKey: 'n.b', routerLink: '/n/b', key: 'DepositInquiry:03' },
            ],
          },
        ],
      },
    ]
    expect(labels(resolveMenu(nested, holding()).items)).toEqual(['g', 'l.plain'])
    expect(labels(resolveMenu(nested, holding('AcrInquiry:03')).items)).toEqual(['g', 'l.plain', 'n', 'n.a'])
    expect(labels(resolveMenu(nested, holding('AcrInquiry:03', 'DepositInquiry:03')).items)).toEqual([
      'g',
      'l.plain',
      'n',
      'n.a',
      'n.b',
    ])
  })

  it('🚩 a gated node takes its ungated children with it — the settlement shape', () => {
    const gatedNode: ShellMenuItem[] = [
      {
        labelKey: 'g',
        items: [
          {
            labelKey: 'n',
            routerLink: '/n',
            key: 'SettlementAccount:03',
            items: [
              { labelKey: 'n.a', routerLink: '/n' },
              { labelKey: 'n.b', routerLink: '/n/b' },
            ],
          },
        ],
      },
    ]
    expect(labels(resolveMenu(gatedNode, holding('SettlementAccount:03')).items)).toEqual(['g', 'n', 'n.a', 'n.b'])
    expect(resolveMenu(gatedNode, holding()).items).toEqual([])
  })

  it('reports an EMPTY menu as settled — the empty-state case ticket 124 exists for', () => {
    const allGated: ShellMenuItem[] = [{ labelKey: 'g', items: [{ labelKey: 'l', routerLink: '/l', key: 'CallCenter:03' }] }]
    const r = resolveMenu(allGated, holding())
    expect(r.items).toEqual([])
    expect(r.settled).toBe(true)
  })
})

describe('resolveMenu — offered (a data door, not a permission)', () => {
  const offer = { queryKey: ['t', 'offered'], queryFn: async () => true }
  const menu: ShellMenuItem[] = [
    { labelKey: 'g', items: [{ labelKey: 'l', routerLink: '/l', key: 'Analytics:03', offered: offer }] },
  ]
  const granted = holding('Analytics:03')

  it('shows the leaf only when its grant holds AND the door offered it', () => {
    expect(labels(resolveMenu(menu, granted, () => true).items)).toEqual(['g', 'l'])
    expect(resolveMenu(menu, granted, () => false).items).toEqual([])
    expect(resolveMenu(menu, holding(), () => true).items).toEqual([])
  })

  it('fails closed: not told it is offered ⇒ hidden', () => {
    expect(resolveMenu(menu, granted).items).toEqual([])
  })
})

describe('offerAsked', () => {
  it('asks the door only once the grant says yes', () => {
    const item: ShellMenuItem = { labelKey: 'l', key: 'Analytics:03', offered: { queryKey: ['x'], queryFn: async () => true } }
    expect(offerAsked(item, pending)).toBe(false)
    expect(offerAsked(item, errored)).toBe(false)
    expect(offerAsked(item, holding())).toBe(false)
    expect(offerAsked(item, holding('Analytics:03'))).toBe(true)
  })
})

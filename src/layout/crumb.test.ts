/**
 * `deriveCrumb` — the top bar's breadcrumb (spec 380 F11, ticket 386).
 *
 * The crumb is read off the menu, never written per screen: the group, the sub-group
 * when there is one, the screen, and the record number when the route carries one.
 * A pathname and the route's params go in, label keys come out — no router, no
 * renderer. The menu is the **real** `MENU`, so a leaf that moves or loses its path
 * changes what these say.
 */
import { describe, expect, it } from 'vitest'
import { deriveCrumb } from './crumb'
import { MENU } from './menu-model'

describe('crumb derives group, sub-group and screen from the menu for a route', () => {
  it('is the group and the screen for a plain leaf', () => {
    expect(deriveCrumb(MENU, '/oms/deliveries')).toEqual({
      trail: ['deliveries:menu.oms', 'deliveries:menu.deliveries'],
      record: null,
    })
  })

  it('puts the Settlement sub-group between the group and the screen', () => {
    expect(deriveCrumb(MENU, '/collection/settlement/open').trail).toEqual([
      'collection:menu.collections',
      'settlement:menu.settlement',
      'settlement:menu.open',
    ])
    expect(deriveCrumb(MENU, '/collection/settlement/ledger').trail).toEqual([
      'collection:menu.collections',
      'settlement:menu.settlement',
      'settlement:menu.ledger',
    ])
  })

  it('names the Overview leaf on the sub-group’s own address, not the sub-group twice', () => {
    expect(deriveCrumb(MENU, '/collection/settlement').trail).toEqual([
      'collection:menu.collections',
      'settlement:menu.settlement',
      'settlement:menu.overview',
    ])
  })

  it('ends on the record number when the route carries one', () => {
    expect(deriveCrumb(MENU, '/oms/document/1000000393', { documentNo: '1000000393' })).toEqual({
      trail: ['deliveries:menu.oms', 'deliveries:menu.deliveries'],
      record: '1000000393',
    })
    expect(deriveCrumb(MENU, '/oms/delivery/80001238', { deliveryNo: '80001238' }).record).toBe('80001238')
    expect(deriveCrumb(MENU, '/loy/members/77001', { loyId: '77001' })).toEqual({
      trail: ['loy:menu.loyalty', 'loy:menu.members'],
      record: '77001',
    })
  })

  it('takes the most specific leaf when two claim the address', () => {
    // The eligibility list owns the whole `/nphies/eligibility` subtree; the New check
    // leaf is its own exact route inside it.
    expect(deriveCrumb(MENU, '/nphies/eligibility/new').trail).toEqual([
      'eligibility:menu.nphies',
      'eligibility:menu.newCheck',
    ])
    expect(deriveCrumb(MENU, '/nphies/eligibility/42', { id: '42' })).toEqual({
      trail: ['eligibility:menu.nphies', 'eligibility:menu.list'],
      record: '42',
    })
  })

  it('reads no record from a route with no param — a create screen is not a record', () => {
    expect(deriveCrumb(MENU, '/nphies/authorizations/new', {})).toEqual({
      trail: ['eligibility:menu.nphies', 'authorizations:menu.authorizations'],
      record: null,
    })
  })

  it('ignores a splat and an empty param', () => {
    expect(deriveCrumb(MENU, '/oms/deliveries', { '*': 'x/y', documentNo: '' }).record).toBeNull()
  })

  it('treats a trailing slash as the same screen', () => {
    expect(deriveCrumb(MENU, '/collection/settlement/').trail).toEqual(
      deriveCrumb(MENU, '/collection/settlement').trail,
    )
  })

  it('is empty on the home page and on an address no menu item claims', () => {
    expect(deriveCrumb(MENU, '/')).toEqual({ trail: [], record: null })
    expect(deriveCrumb(MENU, '/nowhere/at-all')).toEqual({ trail: [], record: null })
  })

  it('is the leaf alone for a top-level leaf outside any group', () => {
    const menu = [{ labelKey: 'x:solo', routerLink: '/solo' }]
    expect(deriveCrumb(menu, '/solo').trail).toEqual(['x:solo'])
  })
})

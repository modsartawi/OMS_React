/**
 * The Campaigns nav group (ticket 501, BackOffice spec 2737).
 *
 * Read out of the **real** `MENU`, never re-declared. The group is UNGATED by ruling in this wave —
 * no Ua permission exists until BackOffice 2759 — so a leaf that grew a probe before ticket 520
 * fails here, as does one that drifted out of the group's place after Pricing.
 */
import { describe, expect, it } from 'vitest'
import { MENU, markedLeaf, type ShellMenuItem } from './menu-model'
import { resolveMenu } from './useVisibleMenu'
import { deriveCrumb } from './crumb'

const campaigns = MENU.find((g) => g.labelKey === 'campaign-list:menu.group')
const leaves = (items: ShellMenuItem[]): ShellMenuItem[] => items.flatMap((i) => (i.items ? leaves(i.items) : [i]))

describe('the Campaigns nav group', () => {
  it('sits right after Pricing, before Materials', () => {
    const at = MENU.indexOf(campaigns!)
    expect(MENU[at - 1].labelKey).toBe('simulation:menu.pricing')
    expect(MENU[at + 1].labelKey).toBe('materials-search:menu.materials')
  })

  it('501 ships the first leaf at /campaigns; since 534 it is the Promotions list', () => {
    expect(leaves([campaigns!])[0].routerLink).toBe('/campaigns')
    expect(leaves([campaigns!])[0].labelKey).toBe('campaign-list:menu.promotions')
  })

  it('534: a promotion’s page and the no-promotion page light Promotions, the code in the crumb', () => {
    expect(markedLeaf(MENU, '/campaigns/promotions/0001000048-261009-261015')?.labelKey).toBe('campaign-list:menu.promotions')
    expect(markedLeaf(MENU, '/campaigns/no-promotion')?.labelKey).toBe('campaign-list:menu.promotions')
    expect(deriveCrumb(MENU, '/campaigns/promotions/WKND', { promotionCode: 'WKND' })).toEqual({
      trail: ['campaign-list:menu.group', 'campaign-list:menu.promotions'],
      record: 'WKND',
    })
  })

  it('🚩 no leaf carries a probe until ticket 520 — the group shows for every user', () => {
    for (const leaf of leaves([campaigns!])) expect(leaf.access).toBeUndefined()
    expect(campaigns!.access).toBeUndefined()
    expect(resolveMenu([campaigns!], []).items).toHaveLength(1)
    expect(resolveMenu([campaigns!], []).items[0].items).toHaveLength(8)
  })

  it('a campaign’s workspace lights the Promotions leaf and puts its id in the crumb', () => {
    expect(markedLeaf(MENU, '/campaigns/WKND20')?.labelKey).toBe('campaign-list:menu.promotions')
    expect(deriveCrumb(MENU, '/campaigns/WKND20', { id: 'WKND20' })).toEqual({
      trail: ['campaign-list:menu.group', 'campaign-list:menu.promotions'],
      record: 'WKND20',
    })
  })

  it('513 adds Priority second, at /campaigns/priority, and it lights itself rather than Promotions', () => {
    expect(leaves([campaigns!])[1].routerLink).toBe('/campaigns/priority')
    expect(markedLeaf(MENU, '/campaigns/priority')?.labelKey).toBe('campaign-list:menu.priority')
  })

  it('514 adds Simulator third, at /campaigns/simulator, and it lights itself rather than Promotions', () => {
    expect(leaves([campaigns!])[2].routerLink).toBe('/campaigns/simulator')
    expect(markedLeaf(MENU, '/campaigns/simulator')?.labelKey).toBe('campaign-list:menu.simulator')
  })

  it('518 adds Sessions fourth, at /campaigns/sessions; it and a session light it, the sale id in the crumb', () => {
    expect(leaves([campaigns!])[3].routerLink).toBe('/campaigns/sessions')
    expect(markedLeaf(MENU, '/campaigns/sessions')?.labelKey).toBe('campaign-list:menu.sessions')
    expect(markedLeaf(MENU, '/campaigns/sessions/R101-0042')?.labelKey).toBe('campaign-list:menu.sessions')
    expect(deriveCrumb(MENU, '/campaigns/sessions/R101-0042', { saleId: 'R101-0042' })).toEqual({
      trail: ['campaign-list:menu.group', 'campaign-list:menu.sessions'],
      record: 'R101-0042',
    })
  })

  it('519 adds Coupon finder fifth and Customers sixth; each lights itself rather than Promotions', () => {
    expect(leaves([campaigns!])[4].routerLink).toBe('/campaigns/coupon-finder')
    expect(leaves([campaigns!])[5].routerLink).toBe('/campaigns/customers')
    expect(markedLeaf(MENU, '/campaigns/coupon-finder')?.labelKey).toBe('campaign-list:menu.couponFinder')
    expect(markedLeaf(MENU, '/campaigns/customers')?.labelKey).toBe('campaign-list:menu.customers')
  })

  it('530 adds Campaign upload seventh, at /campaigns/upload, and it lights itself rather than Promotions', () => {
    expect(leaves([campaigns!])[6].routerLink).toBe('/campaigns/upload')
    expect(markedLeaf(MENU, '/campaigns/upload')?.labelKey).toBe('campaign-list:menu.upload')
  })

  it('532 adds Campaign uploads eighth, at /campaigns/uploads; an opened upload lights it, never Campaign upload', () => {
    expect(leaves([campaigns!])[7].routerLink).toBe('/campaigns/uploads')
    expect(markedLeaf(MENU, '/campaigns/uploads')?.labelKey).toBe('campaign-list:menu.uploads')
    expect(markedLeaf(MENU, '/campaigns/uploads/0001000048-261009-261015')?.labelKey).toBe('campaign-list:menu.uploads')
    expect(markedLeaf(MENU, '/campaigns/upload')?.labelKey).toBe('campaign-list:menu.upload')
  })

  it('a Settings page keeps the campaign’s id as the crumb’s record (509: its page is a splat, not a param)', () => {
    expect(deriveCrumb(MENU, '/campaigns/WKND20/settings/schedule', { id: 'WKND20', '*': 'schedule' }).record).toBe('WKND20')
  })
})

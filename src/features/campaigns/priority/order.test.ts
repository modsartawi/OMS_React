import { describe, expect, it } from 'vitest'
import type { RuleDraftSummary, RuleEvaluationTree } from '@/core/models/rule-campaign'
import {
  addGroup,
  carrierDrafts,
  orderSave,
  blankGroups,
  campaignIdsOf,
  freshGroupName,
  moveCampaign,
  moveCampaignTo,
  moveGroup,
  newGroupId,
  placeOf,
  removeGroup,
  sameOrder,
  setGroup,
  tidyOrder,
} from './order'

const says = (en: string, ar = '') => ({ en, ar })

/** The prototype's sample order (data.js `tree`), as `Rules/Authoring/Order` answers its `tree`. */
const ORDER: RuleEvaluationTree = {
  order: [{ campaign: 'PCUT-SA01' }, { group: 'g-items' }, { campaign: 'GP-BEAUTY15' }, { campaign: 'BDAY-BEAUTY' }, { group: 'g-basket' }, { campaign: 'BASE-EARN' }],
  groups: [
    { id: 'g-items', name: says('Item deals'), mode: 'highest', scope: 'item', campaigns: ['SUN-3FOR2', 'BABY-BUNDLE'] },
    { id: 'g-basket', name: says('Basket offers'), mode: 'first', scope: 'session', campaigns: ['WKND20', 'PTS-50OFF'] },
  ],
}

const sorted = (o: RuleEvaluationTree) => [...campaignIdsOf(o)].sort()

describe('the evaluation order', () => {
  it('order_moveAcrossGroups_keepsEveryCampaignOnce', () => {
    const id = newGroupId(ORDER)
    let o = addGroup(ORDER, id, says('Weekend'))
    o = moveCampaignTo(o, 'GP-BEAUTY15', id)
    o = moveCampaignTo(o, 'WKND20', id)
    o = moveCampaignTo(o, 'SUN-3FOR2', 'base')
    o = moveCampaignTo(o, 'WKND20', 'g-items')
    expect(sorted(o)).toEqual(sorted(ORDER))
    expect(new Set(campaignIdsOf(o)).size).toBe(campaignIdsOf(o).length)
    expect(placeOf(o, 'GP-BEAUTY15')).toBe(id)
    expect(placeOf(o, 'SUN-3FOR2')).toBe('base')
    expect(placeOf(o, 'WKND20')).toBe('g-items')
    expect(o.groups.find((g) => g.id === 'g-items')!.campaigns).toEqual(['BABY-BUNDLE', 'WKND20'])
    // the new group sits at the end of the base, and a campaign moved to the base lands after it
    expect(o.order.slice(-2)).toEqual([{ group: id }, { campaign: 'SUN-3FOR2' }])
  })

  it('a campaign HQ listed twice is placed once when it moves', () => {
    const twice: RuleEvaluationTree = { ...ORDER, order: [...ORDER.order, { campaign: 'WKND20' }] }
    const o = moveCampaignTo(twice, 'WKND20', 'base')
    expect(campaignIdsOf(o).filter((x) => x === 'WKND20')).toHaveLength(1)
  })

  it('moving to the place it is already in leaves the order as it was', () => {
    expect(moveCampaignTo(ORDER, 'WKND20', 'g-basket')).toBe(ORDER)
    expect(moveCampaignTo(ORDER, 'WKND20', 'nowhere')).toBe(ORDER)
  })

  it('up and down move a campaign within its own list, and stop at the ends', () => {
    expect(moveCampaign(ORDER, 'PTS-50OFF', -1).groups[1].campaigns).toEqual(['PTS-50OFF', 'WKND20'])
    expect(moveCampaign(ORDER, 'WKND20', -1)).toBe(ORDER)
    expect(moveCampaign(ORDER, 'PTS-50OFF', 1)).toBe(ORDER)
    // in the base, a campaign passes a group as one place
    expect(moveCampaign(ORDER, 'GP-BEAUTY15', -1).order.slice(0, 3)).toEqual([{ campaign: 'PCUT-SA01' }, { campaign: 'GP-BEAUTY15' }, { group: 'g-items' }])
    expect(moveCampaign(ORDER, 'PCUT-SA01', -1)).toBe(ORDER)
    expect(moveCampaign(ORDER, 'BASE-EARN', 1)).toBe(ORDER)
  })

  it('up and down move a group as one place in the base, its campaigns with it', () => {
    const o = moveGroup(ORDER, 'g-basket', 1)
    expect(o.order.slice(-2)).toEqual([{ campaign: 'BASE-EARN' }, { group: 'g-basket' }])
    expect(o.groups).toEqual(ORDER.groups)
    expect(moveGroup(o, 'g-basket', 1)).toBe(o)
  })

  it('a new group is "first that yields", session scope, empty, with an id no group has', () => {
    const id = newGroupId(ORDER)
    expect(ORDER.groups.map((g) => g.id)).not.toContain(id)
    const o = addGroup(ORDER, id, says('New group'))
    expect(o.groups.at(-1)).toEqual({ id, name: says('New group'), mode: 'first', scope: 'session', campaigns: [] })
    expect(newGroupId(o)).not.toBe(id)
  })

  it('a group takes a name, a mode and a scope', () => {
    const o = setGroup(ORDER, 'g-basket', { mode: 'highest', scope: 'item', name: says('Coupons') })
    expect(o.groups[1]).toMatchObject({ name: says('Coupons'), mode: 'highest', scope: 'item', campaigns: ['WKND20', 'PTS-50OFF'] })
    expect(ORDER.groups[1].mode).toBe('first')
  })

  it('only an empty group is deleted, from the groups and from the base', () => {
    expect(removeGroup(ORDER, 'g-basket')).toBe(ORDER)
    const id = newGroupId(ORDER)
    const o = removeGroup(addGroup(ORDER, id, says('x')), id)
    expect(sameOrder(o, ORDER)).toBe(true)
  })

  it('a group with a blank name is named as a problem', () => {
    expect(blankGroups(ORDER)).toEqual([])
    expect(blankGroups(setGroup(ORDER, 'g-items', { name: says('  ') }))).toEqual(['g-items'])
  })

  it('sameOrder compares places, modes, scopes and names', () => {
    expect(sameOrder(ORDER, structuredClone(ORDER))).toBe(true)
    expect(sameOrder(ORDER, moveCampaign(ORDER, 'PTS-50OFF', -1))).toBe(false)
    expect(sameOrder(ORDER, setGroup(ORDER, 'g-items', { scope: 'session' }))).toBe(false)
  })

  it('a move keeps what else HQ answered beside the base and the groups', () => {
    const more = { ...ORDER, rowVersion: 'r7' } as RuleEvaluationTree
    expect(moveCampaignTo(more, 'WKND20', 'base')).toHaveProperty('rowVersion', 'r7')
    expect(addGroup(more, 'x', says('x'))).toHaveProperty('rowVersion', 'r7')
    expect(removeGroup(addGroup(more, 'x', says('x')), 'x')).toHaveProperty('rowVersion', 'r7')
  })

  it('the default name of a new group is one no group has', () => {
    const make = (n: number) => `New group ${n}`
    expect(freshGroupName(ORDER, make)).toBe('New group 3')
    const taken = setGroup(ORDER, 'g-items', { name: says('New group 3') })
    expect(freshGroupName(taken, make)).toBe('New group 4')
  })

  it('a tidy order is drawn as HQ answered it', () => {
    expect(tidyOrder(ORDER)).toBe(ORDER)
  })

  it('an untidy order from HQ is drawn with every campaign once and every group placed once', () => {
    const untidy: RuleEvaluationTree = {
      order: [{ campaign: 'WKND20' }, { group: 'g-items' }, { group: 'ghost' }, { campaign: 'PCUT-SA01' }, { group: 'g-items' }],
      groups: [ORDER.groups[0], ORDER.groups[1], { ...ORDER.groups[0], campaigns: ['PCUT-SA01'] }],
    }
    const o = tidyOrder(untidy)
    expect(o.order).toEqual([{ campaign: 'WKND20' }, { group: 'g-items' }, { campaign: 'PCUT-SA01' }, { group: 'g-basket' }])
    expect(o.groups.map((g) => g.id)).toEqual(['g-items', 'g-basket'])
    expect(o.groups[1].campaigns).toEqual(['PTS-50OFF'])
    expect(new Set(campaignIdsOf(o)).size).toBe(campaignIdsOf(o).length)
    expect(tidyOrder(o)).toBe(o)
  })
})

describe('the order rides a draft (no order save)', () => {
  const summary = (campaign: string, state: RuleDraftSummary['state']): RuleDraftSummary => ({
    campaign,
    name: says(campaign),
    revision: 2,
    features: [],
    publishedVersionNo: 0,
    updatedAt: '2026-10-16T09:40:00',
    updatedBy: 'Omar (marketing)',
    state,
    requestedBy: '',
  })

  it('only a draft being edited may carry it: a pending one is frozen, a sent-back one waits on its author', () => {
    const drafts = [summary('A', 'editing'), summary('B', 'pending'), summary('C', 'sentBack'), summary('D', 'editing')]
    expect(carrierDrafts(drafts).map((d) => d.campaign)).toEqual(['A', 'D'])
  })

  it('orderSave_sendsTheDraftWholeWithTheTree: the draft as loaded, at its revision, with the edited tree', () => {
    const tree = setGroup(ORDER, 'g-items', { name: says(' Item deals ', ' عروض ') })
    const draft = { campaign: { id: 'SPRING-DRAFT', name: says('Spring'), rules: [] }, features: ['points' as const], revision: 4 }
    const body = orderSave(draft, tree)
    expect(body).toMatchObject({ campaign: draft.campaign, features: ['points'], revision: 4 })
    expect(body.tree?.order).toEqual(ORDER.order)
    expect(body.tree?.groups[0].name).toEqual({ en: 'Item deals', ar: 'عروض' })
    expect(tree.groups[0].name.en).toBe(' Item deals ')
  })
})

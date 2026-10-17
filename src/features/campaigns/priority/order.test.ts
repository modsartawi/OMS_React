import { describe, expect, it } from 'vitest'
import type { RuleEvaluationOrder } from '@/core/models/rule-campaign'
import {
  addGroup,
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

/** The prototype's sample order (data.js `tree`). */
const ORDER: RuleEvaluationOrder = {
  base: [{ c: 'PCUT-SA01' }, { g: 'g-items' }, { c: 'GP-BEAUTY15' }, { c: 'BDAY-BEAUTY' }, { g: 'g-basket' }, { c: 'BASE-EARN' }],
  groups: [
    { id: 'g-items', name: 'Item deals', mode: 'highest', scope: 'item', items: ['SUN-3FOR2', 'BABY-BUNDLE'] },
    { id: 'g-basket', name: 'Basket offers', mode: 'first', scope: 'session', items: ['WKND20', 'PTS-50OFF'] },
  ],
}

const sorted = (o: RuleEvaluationOrder) => [...campaignIdsOf(o)].sort()

describe('the evaluation order', () => {
  it('order_moveAcrossGroups_keepsEveryCampaignOnce', () => {
    const id = newGroupId(ORDER)
    let o = addGroup(ORDER, id, 'Weekend')
    o = moveCampaignTo(o, 'GP-BEAUTY15', id)
    o = moveCampaignTo(o, 'WKND20', id)
    o = moveCampaignTo(o, 'SUN-3FOR2', 'base')
    o = moveCampaignTo(o, 'WKND20', 'g-items')
    expect(sorted(o)).toEqual(sorted(ORDER))
    expect(new Set(campaignIdsOf(o)).size).toBe(campaignIdsOf(o).length)
    expect(placeOf(o, 'GP-BEAUTY15')).toBe(id)
    expect(placeOf(o, 'SUN-3FOR2')).toBe('base')
    expect(placeOf(o, 'WKND20')).toBe('g-items')
    expect(o.groups.find((g) => g.id === 'g-items')!.items).toEqual(['BABY-BUNDLE', 'WKND20'])
    // the new group sits at the end of the base, and a campaign moved to the base lands after it
    expect(o.base.slice(-2)).toEqual([{ g: id }, { c: 'SUN-3FOR2' }])
  })

  it('a campaign HQ listed twice is placed once when it moves', () => {
    const twice: RuleEvaluationOrder = { ...ORDER, base: [...ORDER.base, { c: 'WKND20' }] }
    const o = moveCampaignTo(twice, 'WKND20', 'base')
    expect(campaignIdsOf(o).filter((x) => x === 'WKND20')).toHaveLength(1)
  })

  it('moving to the place it is already in leaves the order as it was', () => {
    expect(moveCampaignTo(ORDER, 'WKND20', 'g-basket')).toBe(ORDER)
    expect(moveCampaignTo(ORDER, 'WKND20', 'nowhere')).toBe(ORDER)
  })

  it('up and down move a campaign within its own list, and stop at the ends', () => {
    expect(moveCampaign(ORDER, 'PTS-50OFF', -1).groups[1].items).toEqual(['PTS-50OFF', 'WKND20'])
    expect(moveCampaign(ORDER, 'WKND20', -1)).toBe(ORDER)
    expect(moveCampaign(ORDER, 'PTS-50OFF', 1)).toBe(ORDER)
    // in the base, a campaign passes a group as one place
    expect(moveCampaign(ORDER, 'GP-BEAUTY15', -1).base.slice(0, 3)).toEqual([{ c: 'PCUT-SA01' }, { c: 'GP-BEAUTY15' }, { g: 'g-items' }])
    expect(moveCampaign(ORDER, 'PCUT-SA01', -1)).toBe(ORDER)
    expect(moveCampaign(ORDER, 'BASE-EARN', 1)).toBe(ORDER)
  })

  it('up and down move a group as one place in the base, its campaigns with it', () => {
    const o = moveGroup(ORDER, 'g-basket', 1)
    expect(o.base.slice(-2)).toEqual([{ c: 'BASE-EARN' }, { g: 'g-basket' }])
    expect(o.groups).toEqual(ORDER.groups)
    expect(moveGroup(o, 'g-basket', 1)).toBe(o)
  })

  it('a new group is "first that yields", session scope, empty, with an id no group has', () => {
    const id = newGroupId(ORDER)
    expect(ORDER.groups.map((g) => g.id)).not.toContain(id)
    const o = addGroup(ORDER, id, 'New group')
    expect(o.groups.at(-1)).toEqual({ id, name: 'New group', mode: 'first', scope: 'session', items: [] })
    expect(newGroupId(o)).not.toBe(id)
  })

  it('a group takes a name, a mode and a scope', () => {
    const o = setGroup(ORDER, 'g-basket', { mode: 'highest', scope: 'item', name: 'Coupons' })
    expect(o.groups[1]).toMatchObject({ name: 'Coupons', mode: 'highest', scope: 'item', items: ['WKND20', 'PTS-50OFF'] })
    expect(ORDER.groups[1].mode).toBe('first')
  })

  it('only an empty group is deleted, from the groups and from the base', () => {
    expect(removeGroup(ORDER, 'g-basket')).toBe(ORDER)
    const id = newGroupId(ORDER)
    const o = removeGroup(addGroup(ORDER, id, 'x'), id)
    expect(sameOrder(o, ORDER)).toBe(true)
  })

  it('a group with a blank name is named as a problem', () => {
    expect(blankGroups(ORDER)).toEqual([])
    expect(blankGroups(setGroup(ORDER, 'g-items', { name: '  ' }))).toEqual(['g-items'])
  })

  it('sameOrder compares places, modes, scopes and names', () => {
    expect(sameOrder(ORDER, structuredClone(ORDER))).toBe(true)
    expect(sameOrder(ORDER, moveCampaign(ORDER, 'PTS-50OFF', -1))).toBe(false)
    expect(sameOrder(ORDER, setGroup(ORDER, 'g-items', { scope: 'session' }))).toBe(false)
  })

  it('a move keeps what else HQ answered beside the base and the groups', () => {
    const more = { ...ORDER, rowVersion: 'r7' } as RuleEvaluationOrder
    expect(moveCampaignTo(more, 'WKND20', 'base')).toHaveProperty('rowVersion', 'r7')
    expect(addGroup(more, 'x', 'x')).toHaveProperty('rowVersion', 'r7')
    expect(removeGroup(addGroup(more, 'x', 'x'), 'x')).toHaveProperty('rowVersion', 'r7')
  })

  it('the default name of a new group is one no group has', () => {
    const make = (n: number) => `New group ${n}`
    expect(freshGroupName(ORDER, make)).toBe('New group 3')
    const taken = setGroup(ORDER, 'g-items', { name: 'New group 3' })
    expect(freshGroupName(taken, make)).toBe('New group 4')
  })

  it('a tidy order is drawn as HQ answered it', () => {
    expect(tidyOrder(ORDER)).toBe(ORDER)
  })

  it('an untidy order from HQ is drawn with every campaign once and every group placed once', () => {
    const untidy: RuleEvaluationOrder = {
      base: [{ c: 'WKND20' }, { g: 'g-items' }, { g: 'ghost' }, { c: 'PCUT-SA01' }, { g: 'g-items' }],
      groups: [ORDER.groups[0], ORDER.groups[1], { ...ORDER.groups[0], items: ['PCUT-SA01'] }],
    }
    const o = tidyOrder(untidy)
    expect(o.base).toEqual([{ c: 'WKND20' }, { g: 'g-items' }, { c: 'PCUT-SA01' }, { g: 'g-basket' }])
    expect(o.groups.map((g) => g.id)).toEqual(['g-items', 'g-basket'])
    expect(o.groups[1].items).toEqual(['PTS-50OFF'])
    expect(new Set(campaignIdsOf(o)).size).toBe(campaignIdsOf(o).length)
    expect(tidyOrder(o)).toBe(o)
  })
})

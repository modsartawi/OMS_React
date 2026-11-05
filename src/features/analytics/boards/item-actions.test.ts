import { describe, expect, it } from 'vitest'
import { itemActions } from './item-actions'

const me = { userId: 'msartawi', canView: true, canCurate: false }
const curator = { userId: 'msartawi', canView: true, canCurate: true }
const mine = (tier: 'personal' | 'shared' | 'certified') => ({ owner: 'msartawi', tier })
const theirs = (tier: 'personal' | 'shared' | 'certified') => ({ owner: 'aalharbi', tier })

describe('tier and actions: owner × tier × curator → save in place | save as copy | read only', () => {
  it('my Personal item saves in place, and offers no copy', () => {
    expect(itemActions(mine('personal'), me)).toEqual({ save: 'in-place', actions: ['saveInPlace', 'share', 'delete'] })
  })
  it('my Shared item saves in place, and also offers an explicit copy', () => {
    expect(itemActions(mine('shared'), me)).toEqual({ save: 'in-place', actions: ['saveInPlace', 'saveAsCopy', 'unshare', 'delete'] })
  })
  it('a Shared item I do not own saves as my copy', () => {
    expect(itemActions(theirs('shared'), me)).toEqual({ save: 'copy', actions: ['saveAsCopy'] })
    expect(itemActions(theirs('shared'), curator)).toEqual({ save: 'copy', actions: ['saveAsCopy', 'certify'] })
  })
  it('a Certified item saves as a copy for a non-curator, even its owner', () => {
    expect(itemActions(theirs('certified'), me)).toEqual({ save: 'copy', actions: ['saveAsCopy'] })
    expect(itemActions(mine('certified'), me)).toEqual({ save: 'copy', actions: ['saveAsCopy'] })
  })
  it('a curator edits a Certified item in place, and may still copy it', () => {
    expect(itemActions(theirs('certified'), curator)).toEqual({ save: 'in-place', actions: ['saveInPlace', 'saveAsCopy', 'uncertify', 'delete'] })
  })
  it('a curator does not edit someone else’s Personal or Shared item in place', () => {
    expect(itemActions(theirs('shared'), curator).save).toBe('copy')
  })
  it('someone else’s Personal item is read only (it should not have been visible)', () => {
    expect(itemActions(theirs('personal'), me)).toEqual({ save: 'read-only', actions: [] })
    expect(itemActions(theirs('personal'), curator)).toEqual({ save: 'read-only', actions: [] })
  })
  it('without the screen grant, or with no known user, everything is read only', () => {
    expect(itemActions(mine('personal'), { ...me, canView: false })).toEqual({ save: 'read-only', actions: [] })
    expect(itemActions(mine('shared'), { ...me, userId: null })).toEqual({ save: 'copy', actions: ['saveAsCopy'] })
    expect(itemActions(mine('personal'), { ...me, userId: null })).toEqual({ save: 'read-only', actions: [] })
  })
  it('a new item (none yet) saves as a new Personal item', () => {
    expect(itemActions(null, me)).toEqual({ save: 'create', actions: ['create'] })
    expect(itemActions(null, { ...me, canView: false })).toEqual({ save: 'read-only', actions: [] })
  })
  it('an owner is matched without regard to case', () => {
    expect(itemActions({ owner: 'MSartawi', tier: 'personal' }, me).save).toBe('in-place')
  })
})

// 778: share, unshare, certify (and certify a later revision into the certified copy), un-certify, delete.
const tierActions = (item: Parameters<typeof itemActions>[0], actor: Parameters<typeof itemActions>[1]) =>
  itemActions(item, actor).actions.filter((a) => a !== 'saveInPlace' && a !== 'saveAsCopy' && a !== 'create')

describe('tier and actions: share, certify, uncertify and delete availability per owner and curator', () => {
  it.each([
    // [tier, mine?, curator?, has a certified copy?, expected]
    ['personal', true, false, false, ['share', 'delete']],
    ['personal', true, true, false, ['share', 'certify', 'delete']],
    ['personal', true, true, true, ['share', 'certifyRevision', 'delete']],
    ['shared', true, false, false, ['unshare', 'delete']],
    ['shared', true, true, false, ['unshare', 'certify', 'delete']],
    ['shared', false, false, false, []],
    ['shared', false, true, false, ['certify']],
    ['shared', false, true, true, ['certifyRevision']],
    ['certified', true, false, false, []],
    ['certified', false, false, false, []],
    ['certified', false, true, false, ['uncertify', 'delete']],
    ['certified', true, true, false, ['uncertify', 'delete']],
    ['personal', false, true, false, []],
  ] as const)('%s item, mine=%s, curator=%s, certified copy=%s → %j', (tier, isMine, isCurator, copy, expected) => {
    const actor = isCurator ? curator : me
    const item = { ...(isMine ? mine(tier) : theirs(tier)), certifiedCopy: copy }
    expect(tierActions(item, actor)).toEqual(expected)
  })
  it('a Certified item is never shared or unshared, even by its owner', () => {
    expect(tierActions(mine('certified'), curator)).not.toContain('share')
    expect(tierActions(mine('certified'), curator)).not.toContain('unshare')
  })
  it('without the screen grant nothing is offered, curator or not', () => {
    expect(tierActions(mine('shared'), { ...curator, canView: false })).toEqual([])
  })
  it('a new item (none yet) offers no tier actions', () => {
    expect(tierActions(null, curator)).toEqual([])
  })
})

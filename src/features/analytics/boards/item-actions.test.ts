import { describe, expect, it } from 'vitest'
import { itemActions } from './item-actions'

const me = { userId: 'msartawi', canView: true, canAuthor: true, canCurate: false }
const curator = { userId: 'msartawi', canView: true, canAuthor: true, canCurate: true }
const runner = { userId: 'msartawi', canView: true, canAuthor: false, canCurate: false }
const mine = (tier: 'personal' | 'shared' | 'certified') => ({ owner: 'msartawi', tier })
const theirs = (tier: 'personal' | 'shared' | 'certified') => ({ owner: 'aalharbi', tier })

describe('tier and actions: owner × tier × curator → save in place | save as copy | read only', () => {
  it('my Personal item saves in place, and offers no copy', () => {
    expect(itemActions(mine('personal'), me)).toEqual({ save: 'in-place', actions: ['run', 'export', 'saveInPlace', 'share', 'delete'] })
  })
  it('my Shared item saves in place, and also offers an explicit copy', () => {
    expect(itemActions(mine('shared'), me)).toEqual({ save: 'in-place', actions: ['run', 'export', 'saveInPlace', 'saveAsCopy', 'unshare', 'delete'] })
  })
  it('a Shared item I do not own saves as my copy', () => {
    expect(itemActions(theirs('shared'), me)).toEqual({ save: 'copy', actions: ['run', 'export', 'saveAsCopy'] })
    expect(itemActions(theirs('shared'), curator)).toEqual({ save: 'copy', actions: ['run', 'export', 'saveAsCopy', 'certify'] })
  })
  it('a Certified item saves as a copy for a non-curator, even its owner', () => {
    expect(itemActions(theirs('certified'), me)).toEqual({ save: 'copy', actions: ['run', 'export', 'saveAsCopy'] })
    expect(itemActions(mine('certified'), me)).toEqual({ save: 'copy', actions: ['run', 'export', 'saveAsCopy'] })
  })
  it('a curator edits a Certified item in place, and may still copy it', () => {
    expect(itemActions(theirs('certified'), curator)).toEqual({ save: 'in-place', actions: ['run', 'export', 'saveInPlace', 'saveAsCopy', 'uncertify', 'delete'] })
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
    expect(itemActions(mine('shared'), { ...me, userId: null })).toEqual({ save: 'copy', actions: ['run', 'export', 'saveAsCopy'] })
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
  itemActions(item, actor).actions.filter((a) => a !== 'saveInPlace' && a !== 'saveAsCopy' && a !== 'create' && a !== 'run' && a !== 'export')

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

// 822 (spec 819 §C/§E): the author grant. A runner (`canView` without `canAuthor`) runs and exports, nothing else;
// curate implies author.
describe('itemActions with grants: runner, author, curator × tier × owner', () => {
  const author = me
  it.each([
    // [grant, tier, mine?, expected]
    ['runner', 'personal', true, { save: 'read-only', actions: ['run', 'export'] }],
    ['runner', 'shared', true, { save: 'read-only', actions: ['run', 'export'] }],
    ['runner', 'shared', false, { save: 'read-only', actions: ['run', 'export'] }],
    ['runner', 'certified', false, { save: 'read-only', actions: ['run', 'export'] }],
    ['runner', 'certified', true, { save: 'read-only', actions: ['run', 'export'] }],
    ['runner', 'personal', false, { save: 'read-only', actions: [] }],
    ['author', 'personal', true, { save: 'in-place', actions: ['run', 'export', 'saveInPlace', 'share', 'delete'] }],
    ['author', 'shared', false, { save: 'copy', actions: ['run', 'export', 'saveAsCopy'] }],
    ['author', 'certified', false, { save: 'copy', actions: ['run', 'export', 'saveAsCopy'] }],
    ['curator', 'certified', false, { save: 'in-place', actions: ['run', 'export', 'saveInPlace', 'saveAsCopy', 'uncertify', 'delete'] }],
    ['curator', 'shared', false, { save: 'copy', actions: ['run', 'export', 'saveAsCopy', 'certify'] }],
  ] as const)('%s, %s item, mine=%s → %j', (grant, tier, isMine, expected) => {
    const actor = grant === 'runner' ? runner : grant === 'author' ? author : curator
    expect(itemActions(isMine ? mine(tier) : theirs(tier), actor)).toEqual(expected)
  })
  it('a runner gets only run and export, never edit, copy, share, certify or delete', () => {
    for (const tier of ['personal', 'shared', 'certified'] as const) {
      expect(itemActions(mine(tier), runner).actions).toEqual(['run', 'export'])
    }
  })
  it('a runner cannot create a new item', () => {
    expect(itemActions(null, runner)).toEqual({ save: 'read-only', actions: [] })
  })
  it('curate implies author: a curator grant without the author flag still edits a Certified item', () => {
    expect(itemActions(theirs('certified'), { ...curator, canAuthor: false }).save).toBe('in-place')
    expect(itemActions(null, { ...curator, canAuthor: false })).toEqual({ save: 'create', actions: ['create'] })
  })
})

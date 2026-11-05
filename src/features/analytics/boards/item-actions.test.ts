import { describe, expect, it } from 'vitest'
import { itemActions } from './item-actions'

const me = { userId: 'msartawi', canView: true, canCurate: false }
const curator = { userId: 'msartawi', canView: true, canCurate: true }
const mine = (tier: 'personal' | 'shared' | 'certified') => ({ owner: 'msartawi', tier })
const theirs = (tier: 'personal' | 'shared' | 'certified') => ({ owner: 'aalharbi', tier })

describe('tier and actions: owner × tier × curator → save in place | save as copy | read only', () => {
  it('my Personal item saves in place, and offers no copy', () => {
    expect(itemActions(mine('personal'), me)).toEqual({ save: 'in-place', actions: ['saveInPlace'] })
  })
  it('my Shared item saves in place, and also offers an explicit copy', () => {
    expect(itemActions(mine('shared'), me)).toEqual({ save: 'in-place', actions: ['saveInPlace', 'saveAsCopy'] })
  })
  it('a Shared item I do not own saves as my copy', () => {
    expect(itemActions(theirs('shared'), me)).toEqual({ save: 'copy', actions: ['saveAsCopy'] })
    expect(itemActions(theirs('shared'), curator)).toEqual({ save: 'copy', actions: ['saveAsCopy'] })
  })
  it('a Certified item saves as a copy for a non-curator, even its owner', () => {
    expect(itemActions(theirs('certified'), me)).toEqual({ save: 'copy', actions: ['saveAsCopy'] })
    expect(itemActions(mine('certified'), me)).toEqual({ save: 'copy', actions: ['saveAsCopy'] })
  })
  it('a curator edits a Certified item in place, and may still copy it', () => {
    expect(itemActions(theirs('certified'), curator)).toEqual({ save: 'in-place', actions: ['saveInPlace', 'saveAsCopy'] })
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

import { describe, expect, it } from 'vitest'
import { mayEditItem, readRevisions, revisionList } from './revisions'

const rev = (revision: number, updatedBy = 'msartawi', updatedAt = `2026-11-0${Math.min(revision, 9)}T09:00:00`) => ({ revision, updatedBy, updatedAt })

describe('revisions list: newest first, the revision being viewed marked', () => {
  it('orders the revisions newest first, whatever order the door gives them', () => {
    const rows = revisionList(readRevisions([rev(2), rev(4), rev(1), rev(3)]), 4)
    expect(rows.map((r) => r.revision)).toEqual([4, 3, 2, 1])
  })
  it('marks the revision being viewed, and only that one', () => {
    const rows = revisionList(readRevisions([rev(1), rev(2), rev(3)]), 2)
    expect(rows.map((r) => [r.revision, r.viewing])).toEqual([
      [3, false],
      [2, true],
      [1, false],
    ])
  })
  it('offers a revert on every revision but the one being viewed', () => {
    const rows = revisionList(readRevisions([rev(1), rev(2), rev(3)]), 3)
    expect(rows.map((r) => r.canRevert)).toEqual([false, true, true])
  })
  it('keeps who and when, and what a revert revision reverted to', () => {
    const rows = revisionList(readRevisions([rev(1, 'aalharbi', '2026-11-01T08:15:00'), { ...rev(2), revertedFrom: 1 }]), 2)
    expect(rows[1]).toMatchObject({ revision: 1, by: 'aalharbi', at: '2026-11-01T08:15:00', revertedFrom: null })
    expect(rows[0].revertedFrom).toBe(1)
  })
  it('shows at most the last 20, even when the door sends more', () => {
    const many = Array.from({ length: 25 }, (_, i) => rev(i + 1))
    const rows = revisionList(readRevisions(many), 25)
    expect(rows).toHaveLength(20)
    expect(rows[0].revision).toBe(25)
    expect(rows[19].revision).toBe(6)
  })
  it('reads a bare array or an { revisions } page; anything else, or a row with no revision number, is dropped', () => {
    expect(readRevisions({ revisions: [rev(1)] }).map((r) => r.revision)).toEqual([1])
    expect(readRevisions(null)).toEqual([])
    expect(readRevisions([{ updatedBy: 'x' }, rev(2)]).map((r) => r.revision)).toEqual([2])
  })
})

describe('only someone who may edit the item sees its history', () => {
  const me = { userId: 'msartawi', canView: true, canAuthor: true, canCurate: false }
  const curator = { ...me, canCurate: true }
  it('my own Personal or Shared item: yes', () => {
    expect(mayEditItem({ owner: 'msartawi', tier: 'personal' }, me)).toBe(true)
    expect(mayEditItem({ owner: 'msartawi', tier: 'shared' }, me)).toBe(true)
  })
  it('someone else’s Shared item, or a Certified one without the curator grant: no', () => {
    expect(mayEditItem({ owner: 'aalharbi', tier: 'shared' }, me)).toBe(false)
    expect(mayEditItem({ owner: 'msartawi', tier: 'certified' }, me)).toBe(false)
  })
  it('a curator on a Certified item: yes', () => {
    expect(mayEditItem({ owner: 'curator1', tier: 'certified' }, curator)).toBe(true)
  })
  it('without the screen grant: no', () => {
    expect(mayEditItem({ owner: 'msartawi', tier: 'personal' }, { ...me, canView: false })).toBe(false)
  })
})

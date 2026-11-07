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

// 826 (spec 819 §C): an audience change and a reassign are written to the history, but are not revisions.
describe('history events: audience changes and reassigns', () => {
  const raw = [
    { revision: 3, updatedAt: '2026-11-05T09:00:00', updatedBy: 'msartawi' },
    { revision: 3, updatedAt: '2026-11-05T10:00:00', updatedBy: 'msartawi', event: 'audience' },
    { revision: 3, updatedAt: '2026-11-05T11:00:00', updatedBy: 'curator1', event: 'reassign', owner: 'kalotaibi' },
    { revision: 2, updatedAt: '2026-11-04T09:00:00', updatedBy: 'msartawi' },
    { revision: 3, updatedAt: '2026-11-05T12:00:00', updatedBy: 'x', event: 'unknown-kind' },
  ]
  it('the reader keeps the event and its new owner, and reads an unknown kind as an ordinary row', () => {
    const read = readRevisions(raw)
    expect(read[1]).toMatchObject({ event: 'audience' })
    expect(read[2]).toMatchObject({ event: 'reassign', owner: 'kalotaibi' })
    expect(read[4].event).toBeUndefined()
  })
  it('events list newest first above the revision they followed; they are never viewed or reverted to', () => {
    const rows = revisionList(readRevisions(raw.slice(0, 4)), 3)
    expect(rows.map((r) => [r.revision, r.event ?? null, r.viewing, r.canRevert])).toEqual([
      [3, 'reassign', false, false],
      [3, 'audience', false, false],
      [3, null, true, false],
      [2, null, false, true],
    ])
    expect(rows[0].owner).toBe('kalotaibi')
  })
})

/**
 * Ticket 571 — the History tab's client-side filters (action, store code: "who took store X off, and when")
 * and its "Show more", which raises the door's `take` (there is no cursor; 200 by default, at most 1000).
 */
import { describe, expect, it } from 'vitest'
import type { ServingListChangeRow } from '@/core/models/serving-list'
import { CHANGES_MAX_TAKE, CHANGES_TAKE, actionOptions, canShowMore, filterChanges, isFilteredChanges, nextTake } from './history-filter'

const row = (changeId: string, action: string, storeCode = ''): ServingListChangeRow => ({
  changeId,
  servingListId: 'L1',
  action,
  storeCode,
  changedAt: '2026-10-24T14:30:00',
  changedBy: 'amal',
  note: '',
  oldNameEn: '',
  oldNameAr: '',
  newNameEn: '',
  newNameAr: '',
})

const ROWS = [
  row('6', 'RemoveStore', 'P019'),
  row('5', 'DisableStore', 'P001'),
  row('4', 'AddStore', 'P0190'),
  row('3', 'AddStore', 'P019'),
  row('2', 'Rename'),
  row('1', 'Create'),
]
const ids = (rows: ServingListChangeRow[]) => rows.map((r) => r.changeId)

describe('filterChanges', () => {
  it('no filter keeps every row, newest first as the door sent them', () => {
    expect(ids(filterChanges(ROWS, { action: '', store: '' }))).toEqual(['6', '5', '4', '3', '2', '1'])
  })

  it("a store code finds that store's add and removal — exactly, ignoring case and spaces", () => {
    expect(ids(filterChanges(ROWS, { action: '', store: ' p019 ' }))).toEqual(['6', '3'])
  })

  it('an action keeps only that action', () => {
    expect(ids(filterChanges(ROWS, { action: 'AddStore', store: '' }))).toEqual(['4', '3'])
  })

  it('action and store combine', () => {
    expect(ids(filterChanges(ROWS, { action: 'RemoveStore', store: 'P019' }))).toEqual(['6'])
    expect(ids(filterChanges(ROWS, { action: 'Rename', store: 'P019' }))).toEqual([])
  })

  it('isFilteredChanges is false for blanks', () => {
    expect(isFilteredChanges({ action: '', store: '  ' })).toBe(false)
    expect(isFilteredChanges({ action: 'Create', store: '' })).toBe(true)
    expect(isFilteredChanges({ action: '', store: 'P1' })).toBe(true)
  })
})

describe('actionOptions', () => {
  it('offers the eight known actions in order, then any unlisted action the rows carry', () => {
    expect(actionOptions([row('9', 'MergeLists'), row('8', 'AddStore'), row('7', 'MergeLists')])).toEqual([
      'Create',
      'Rename',
      'Deactivate',
      'Reactivate',
      'AddStore',
      'RemoveStore',
      'EnableStore',
      'DisableStore',
      'MergeLists',
    ])
  })
})

describe('Show more', () => {
  it('starts at the door default and steps by it up to the door maximum', () => {
    expect(CHANGES_TAKE).toBe(200)
    expect(CHANGES_MAX_TAKE).toBe(1000)
    expect(nextTake(200)).toBe(400)
    expect(nextTake(800)).toBe(1000)
    expect(nextTake(1000)).toBe(1000)
  })

  it('is offered only when the door filled the page and the maximum is not reached', () => {
    expect(canShowMore(200, 200)).toBe(true)
    expect(canShowMore(199, 200)).toBe(false)
    expect(canShowMore(1000, 1000)).toBe(false)
  })
})

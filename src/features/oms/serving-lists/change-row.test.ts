/**
 * Ticket 571 — a serving list's change-log row as the History tab shows it (BackOffice spec 3042, door
 * `GET ServingListWeb/Lists/{id}/Changes`): the action in words, the store (blank for a list-level action),
 * a create's names and a rename's before → after; an action this screen does not know renders raw.
 */
import { describe, expect, it } from 'vitest'
import type { ServingListChangeRow } from '@/core/models/serving-list'
import { changeRow } from './change-row'

const row = (over: Partial<ServingListChangeRow> = {}): ServingListChangeRow => ({
  changeId: 'C1',
  servingListId: '01JBX0SERVINGLIST000000001',
  action: 'AddStore',
  storeCode: 'P001',
  changedAt: '2026-10-24T14:30:00',
  changedBy: 'amal',
  note: '',
  oldNameEn: '',
  oldNameAr: '',
  newNameEn: '',
  newNameAr: '',
  ...over,
})

describe('changeRow — the action in words', () => {
  it.each([
    ['Create', 'history.action.Create'],
    ['Rename', 'history.action.Rename'],
    ['Deactivate', 'history.action.Deactivate'],
    ['Reactivate', 'history.action.Reactivate'],
    ['AddStore', 'history.action.AddStore'],
    ['RemoveStore', 'history.action.RemoveStore'],
    ['EnableStore', 'history.action.EnableStore'],
    ['DisableStore', 'history.action.DisableStore'],
  ])('%s → its label key', (action, key) => {
    expect(changeRow(row({ action })).actionKey).toBe(key)
  })

  it('an unlisted action has no key and keeps its raw value', () => {
    const view = changeRow(row({ action: 'MergeLists' }))
    expect(view.actionKey).toBeNull()
    expect(view.action).toBe('MergeLists')
  })
})

describe('changeRow — the names and the store', () => {
  it('a rename shows its names before and after', () => {
    const view = changeRow(
      row({ action: 'Rename', storeCode: '', oldNameEn: 'Riyadh north', oldNameAr: 'شمال الرياض', newNameEn: 'Riyadh N', newNameAr: 'الرياض ش' }),
    )
    expect(view.names).toEqual({ kind: 'rename', fromEn: 'Riyadh north', fromAr: 'شمال الرياض', toEn: 'Riyadh N', toAr: 'الرياض ش' })
  })

  it('a create shows the names it was given', () => {
    const view = changeRow(row({ action: 'Create', storeCode: '', newNameEn: 'Jeddah', newNameAr: 'جدة' }))
    expect(view.names).toEqual({ kind: 'create', en: 'Jeddah', ar: 'جدة' })
  })

  it('any other action has no names, even if the row carried some', () => {
    expect(changeRow(row({ action: 'Deactivate', storeCode: '', newNameEn: 'stray' })).names).toEqual({ kind: 'none' })
    expect(changeRow(row({ action: 'AddStore' })).names).toEqual({ kind: 'none' })
  })

  it('a list-level action has no store; a store action keeps its code', () => {
    expect(changeRow(row({ action: 'Deactivate', storeCode: '' })).storeCode).toBe('')
    expect(changeRow(row({ action: 'Rename', storeCode: '' })).storeCode).toBe('')
    expect(changeRow(row({ action: 'RemoveStore', storeCode: 'P019' })).storeCode).toBe('P019')
  })

  it('a list-level action shows no store even if the row carried one', () => {
    expect(changeRow(row({ action: 'Create', storeCode: 'P001' })).storeCode).toBe('')
  })
})

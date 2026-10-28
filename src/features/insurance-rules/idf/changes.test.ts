/**
 * Ticket 650 — one row of the general change log (BackOffice spec 3185, door 3194): its before and after, each drawn as
 * ONE whole value (the bidi rule). 654: the sides are the snapshots BackOffice 3192/3196 log, read by the row's ENTITY —
 * an item's `{ idfNumber, priority }` (`IDF-IBU · 3`, a machine value), a group's `{ idfNumber, description,
 * dosageForm }` (its description and dosage form, free text: the number is the row's key); an absent side (`null`:
 * before a first set or an add, after a clear or a remove) is none.
 */
import { describe, expect, it } from 'vitest'
import { actionWordKey, changeSides, entityWordKey, type IdfChange } from './changes'

const row = (patch: Partial<IdfChange>): IdfChange => ({
  changeId: 'C-1',
  entity: 'item',
  key: '300110',
  action: 'set',
  before: null,
  after: null,
  reason: 'r',
  by: 'msartawi',
  at: '2026-10-27T10:00:00',
  uploadId: null,
  idfNumberBefore: '',
  idfNumberAfter: '',
  ...patch,
})

describe('before → after renders set, clear and group edits', () => {
  it('a first set has no before; its after is the group and priority, machine text', () => {
    expect(changeSides(row({ action: 'set', after: { idfNumber: 'IDF-IBU', priority: 3 } }))).toEqual({
      before: null,
      after: { text: 'IDF-IBU · 3', machine: true },
    })
  })
  it('a re-rank shows both sides', () => {
    expect(changeSides(row({ before: { idfNumber: 'IDF-IBU', priority: 3 }, after: { idfNumber: 'IDF-IBU', priority: 1 } }))).toEqual({
      before: { text: 'IDF-IBU · 3', machine: true },
      after: { text: 'IDF-IBU · 1', machine: true },
    })
  })
  it('a clear has no after', () => {
    expect(changeSides(row({ action: 'clear', before: { idfNumber: 'IDF-PPI', priority: 2 } }))).toEqual({
      before: { text: 'IDF-PPI · 2', machine: true },
      after: null,
    })
  })
  it('a group edit shows the group fields as free text, a blank field dropped — never its number as an item pair', () => {
    const edit = row({
      entity: 'group',
      key: 'IDF-0102',
      action: 'edit',
      before: { idfNumber: 'IDF-0102', description: 'Ibuprofen 400 mg', dosageForm: '' },
      after: { idfNumber: 'IDF-0102', description: 'Ibuprofen 400 mg', dosageForm: 'Tablet' },
    })
    expect(changeSides(edit)).toEqual({
      before: { text: 'Ibuprofen 400 mg', machine: false },
      after: { text: 'Ibuprofen 400 mg · Tablet', machine: false },
    })
  })
  it('a group add has no before, a group remove no after', () => {
    const add = row({ entity: 'group', key: 'IDF-0310', action: 'add', after: { idfNumber: 'IDF-0310', description: 'أوميبرازول 20 ملغ', dosageForm: 'Capsule' } })
    expect(changeSides(add)).toEqual({ before: null, after: { text: 'أوميبرازول 20 ملغ · Capsule', machine: false } })
    expect(changeSides(row({ entity: 'group', action: 'remove', before: { idfNumber: 'IDF-0399', description: 'Cetirizine 10 mg', dosageForm: 'Tablet' } })).after).toBeNull()
  })
  it('an empty snapshot, or a row of an entity this build does not know, is none', () => {
    expect(changeSides(row({ before: {}, after: { idfNumber: '', priority: 0 } }))).toEqual({ before: null, after: null })
    expect(changeSides(row({ entity: 'store', before: { code: 'P001' } })).before).toBeNull()
  })
})

describe('the change log words', () => {
  it('known entities and actions map to their words; an unknown one has none', () => {
    expect(entityWordKey('group')).toBe('changes.entity.group')
    expect(actionWordKey('clear')).toBe('changes.action.clear')
    expect(actionWordKey('merge')).toBeNull()
  })
})

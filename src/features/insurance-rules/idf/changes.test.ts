/**
 * Ticket 650 — one row of the general change log (BackOffice spec 3185, door 3194): its before and after, each drawn as
 * ONE whole value (the bidi rule). An item's side is its IDF group and priority (`IDF-IBU · 3`, a machine value); a
 * group's side its fields (free text); an absent side (before a set, after a clear or a remove) is none.
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
  it('a group edit shows the group fields as free text, a blank field dropped', () => {
    const edit = row({ entity: 'group', key: 'IDF-0102', action: 'edit', before: { description: 'Ibuprofen 400 mg', dosageForm: '' }, after: { description: 'Ibuprofen 400 mg', dosageForm: 'Tablet' } })
    expect(changeSides(edit)).toEqual({
      before: { text: 'Ibuprofen 400 mg', machine: false },
      after: { text: 'Ibuprofen 400 mg · Tablet', machine: false },
    })
  })
  it('a group add has no before, a group remove no after', () => {
    expect(changeSides(row({ entity: 'group', action: 'add', after: { description: 'أوميبرازول 20 ملغ', dosageForm: 'Capsule' } })).before).toBeNull()
    expect(changeSides(row({ entity: 'group', action: 'remove', before: { description: 'Cetirizine 10 mg', dosageForm: 'Tablet' } })).after).toBeNull()
  })
  it('a side the server sends as text, or an empty object, is drawn as it is or as none', () => {
    expect(changeSides(row({ before: 'IDF-IBU/3', after: {} }))).toEqual({ before: { text: 'IDF-IBU/3', machine: false }, after: null })
  })
})

describe('the change log words', () => {
  it('known entities and actions map to their words; an unknown one has none', () => {
    expect(entityWordKey('group')).toBe('changes.entity.group')
    expect(actionWordKey('clear')).toBe('changes.action.clear')
    expect(actionWordKey('merge')).toBeNull()
  })
})

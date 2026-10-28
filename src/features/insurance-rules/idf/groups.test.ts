/**
 * Ticket 652 — the IDF groups leaf (BackOffice spec 3185, door 3196): the add / edit form's rules (number required
 * and at most 8 — `IdfGroupWidths.Number`, 654 —, description required and at most 300, dosage form at most 50, the
 * number fixed on an edit), Remove offered only on an empty group, and the list's address (`?q=&page=`).
 */
import { describe, expect, it } from 'vitest'
import { canRemoveGroup, groupBody, groupEditBody, groupFormProblems, groupsDoorParams, readGroupsQuery, removeRefusal, removeRefusedForGood, writeGroupsQuery } from './groups'
import { groupsExportFileName, groupsTemplateFileName } from './download'

describe('group form: number required and ≤ 8, description required, number fixed on edit', () => {
  it('a blank add asks for the number and the description; the dosage form is optional', () => {
    expect(groupFormProblems({ idfNumber: ' ', description: '', dosageForm: '' }, 'add')).toEqual({ idfNumber: 'numberRequired', description: 'descriptionRequired' })
  })
  it('an 8-character number is accepted, a 9-character one is too long (654: the built door, not the sketch’s 26)', () => {
    expect(groupFormProblems({ idfNumber: 'IDF-0101', description: 'Paracetamol 500', dosageForm: '' }, 'add')).toEqual({})
    expect(groupFormProblems({ idfNumber: 'IDF-01010', description: 'Paracetamol 500', dosageForm: '' }, 'add')).toEqual({ idfNumber: 'numberTooLong' })
  })
  it('a description over 300 and a dosage form over 50 characters are too long (IDF-00045), on add and edit', () => {
    const f = { idfNumber: 'IDF-1', description: 'd'.repeat(300), dosageForm: 'f'.repeat(50) }
    expect(groupFormProblems(f, 'add')).toEqual({})
    expect(groupFormProblems({ ...f, description: 'd'.repeat(301), dosageForm: 'f'.repeat(51) }, 'edit')).toEqual({ description: 'descriptionTooLong', dosageForm: 'dosageFormTooLong' })
  })
  it('an edit never checks the number — it is fixed — and its body carries no number', () => {
    expect(groupFormProblems({ idfNumber: '', description: 'Ibuprofen', dosageForm: 'Tablet' }, 'edit')).toEqual({})
    expect(groupFormProblems({ idfNumber: 'IDF-1', description: ' ', dosageForm: 'Tablet' }, 'edit')).toEqual({ description: 'descriptionRequired' })
    expect(groupEditBody({ idfNumber: 'IDF-1', description: ' Ibuprofen ', dosageForm: ' Tablet ' })).toEqual({ description: 'Ibuprofen', dosageForm: 'Tablet' })
  })
  it('an add body carries the trimmed number, description and dosage form', () => {
    expect(groupBody({ idfNumber: ' IDF-9 ', description: ' Amoxicillin ', dosageForm: '' })).toEqual({ idfNumber: 'IDF-9', description: 'Amoxicillin', dosageForm: '' })
  })
})

describe('remove is offered only on an empty group', () => {
  it('item count 0 → removable; any member → not', () => {
    expect(canRemoveGroup({ itemCount: 0 })).toBe(true)
    expect(canRemoveGroup({ itemCount: 3 })).toBe(false)
  })
})

describe('the groups address: ?q=&page=, defaults omitted', () => {
  it('reads a search and a page, a bad page is page 1', () => {
    expect(readGroupsQuery(new URLSearchParams('q=para&page=3'))).toEqual({ q: 'para', page: 3 })
    expect(readGroupsQuery(new URLSearchParams('page=x'))).toEqual({ q: '', page: 1 })
  })
  it('writes only what differs from the default', () => {
    expect(writeGroupsQuery({ q: '', page: 1 }).toString()).toBe('')
    expect(writeGroupsQuery({ q: 'para', page: 2 }).toString()).toBe('q=para&page=2')
  })
  it('the door is asked search= and page=', () => {
    expect(groupsDoorParams({ q: 'para', page: 2 })).toEqual({ search: 'para', page: '2' })
  })
})

describe('a refused remove (IDF-00047) names what still holds the group: items and/or live rankings', () => {
  it('reads data { idfNumber, itemCount, entryCount }', () => {
    expect(removeRefusal({ idfNumber: 'IDF-0399', itemCount: 2, entryCount: 0 })).toEqual({ itemCount: 2, entryCount: 0 })
    expect(removeRefusal({ idfNumber: 'IDF-0310', itemCount: 0, entryCount: 3 })).toEqual({ itemCount: 0, entryCount: 3 })
  })
  it('a count that is not a number reads as 0; no data, or neither count, is no refusal', () => {
    expect(removeRefusal({ itemCount: '12', entryCount: 4 })).toEqual({ itemCount: 0, entryCount: 4 })
    expect(removeRefusal(null)).toBeNull()
    expect(removeRefusal({ message: 'Timeout' })).toBeNull()
  })
})

describe('only the "group has items" refusal keeps Remove off; any other failure may be retried (3185 review)', () => {
  it('a refusal naming items, or live rankings, is final', () => {
    expect(removeRefusedForGood({ itemCount: 2, entryCount: 0 })).toBe(true)
    expect(removeRefusedForGood({ itemCount: 0, entryCount: 5 })).toBe(true)
  })
  it('a refusal with no count, a count of 0, or no data at all (a network or server failure) allows a retry', () => {
    expect(removeRefusedForGood(null)).toBe(false)
    expect(removeRefusedForGood(undefined)).toBe(false)
    expect(removeRefusedForGood({ itemCount: 0, entryCount: 0 })).toBe(false)
    expect(removeRefusedForGood({ message: 'Timeout' })).toBe(false)
  })
})

describe('the groups downloads fall back to a fixed ASCII name when the server sends none', () => {
  it('export and template', () => {
    expect(groupsExportFileName()).toBe('idf-groups.xlsx')
    expect(groupsTemplateFileName()).toBe('idf-groups-template.xlsx')
  })
})

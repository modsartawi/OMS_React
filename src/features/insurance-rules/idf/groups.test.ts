/**
 * Ticket 652 — the IDF groups leaf (BackOffice spec 3185, door 3196): the add / edit form's rules (number required
 * and at most 26, description required, the number fixed on an edit), Remove offered only on an empty group, and the
 * list's address (`?q=&page=`).
 */
import { describe, expect, it } from 'vitest'
import { canRemoveGroup, groupBody, groupEditBody, groupFormProblems, groupsDoorParams, readGroupsQuery, refusedItemCount, writeGroupsQuery } from './groups'
import { groupsExportFileName, groupsTemplateFileName } from './download'

describe('group form: number required and ≤ 26, description required, number fixed on edit', () => {
  it('a blank add asks for the number and the description; the dosage form is optional', () => {
    expect(groupFormProblems({ idfNumber: ' ', description: '', dosageForm: '' }, 'add')).toEqual({ idfNumber: 'numberRequired', description: 'descriptionRequired' })
  })
  it('a 26-character number is accepted, a 27-character one is too long', () => {
    expect(groupFormProblems({ idfNumber: 'A'.repeat(26), description: 'Paracetamol 500', dosageForm: '' }, 'add')).toEqual({})
    expect(groupFormProblems({ idfNumber: 'A'.repeat(27), description: 'Paracetamol 500', dosageForm: '' }, 'add')).toEqual({ idfNumber: 'numberTooLong' })
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

describe('a refused remove names the count it carries', () => {
  it('reads data.itemCount, null when absent', () => {
    expect(refusedItemCount({ itemCount: 12 })).toBe(12)
    expect(refusedItemCount(null)).toBeNull()
    expect(refusedItemCount({ itemCount: '12' })).toBeNull()
  })
})

describe('the groups downloads fall back to a fixed ASCII name when the server sends none', () => {
  it('export and template', () => {
    expect(groupsExportFileName()).toBe('idf-groups.xlsx')
    expect(groupsTemplateFileName()).toBe('idf-groups-template.xlsx')
  })
})

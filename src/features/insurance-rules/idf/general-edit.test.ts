/**
 * Ticket 648 — one general item's group and priority are set or cleared with a reason (BackOffice spec 3185, door
 * 3192). The dialog's Save stays off until the form is valid: a group, a whole priority of 1 or more, and a reason
 * (plus, for Set item, the item number); the body sent is `{ idfNumber, priority, reason }`.
 */
import { describe, expect, it } from 'vitest'
import { generalEditBody, generalEditProblems, generalFormFromRow, isGeneralEditValid, NEW_GENERAL_ITEM_FORM, wholePriority, type IdfGeneralEditForm } from './general-edit'

const ok: IdfGeneralEditForm = { itemNumber: '300110', idfNumber: 'IDF-IBU', priority: '3', reason: 'Re-ranked after the shortage' }

describe('648 · the general edit form', () => {
  it('general edit form is valid only with a group, a whole priority ≥ 1 and a reason', () => {
    expect(isGeneralEditValid(ok, 'edit')).toBe(true)
    expect(generalEditProblems({ ...ok, idfNumber: '  ' }, 'edit')).toEqual({ idfNumber: 'groupRequired' })
    expect(generalEditProblems({ ...ok, priority: '' }, 'edit')).toEqual({ priority: 'priorityRequired' })
    for (const priority of ['0', '-1', '2.5', '1e2', 'x', '3 4'])
      expect([priority, generalEditProblems({ ...ok, priority }, 'edit')]).toEqual([priority, { priority: 'priorityWholeNumber' }])
    expect(isGeneralEditValid({ ...ok, priority: ' 12 ' }, 'edit')).toBe(true)
    expect(generalEditProblems({ ...ok, reason: ' ' }, 'edit')).toEqual({ reason: 'reasonRequired' })
    expect(generalEditProblems({ ...ok, reason: 'x'.repeat(401) }, 'edit')).toEqual({ reason: 'reasonTooLong' })
    expect(isGeneralEditValid(NEW_GENERAL_ITEM_FORM, 'set')).toBe(false)
  })

  it('Set item also needs the item number; an edit keeps the row its own', () => {
    expect(generalEditProblems({ ...ok, itemNumber: '' }, 'set')).toEqual({ itemNumber: 'itemRequired' })
    expect(generalEditProblems({ ...ok, itemNumber: '' }, 'edit')).toEqual({})
  })

  it('an edit starts from the row, with no reason', () => {
    expect(generalFormFromRow({ itemNumber: '300110', descriptionEn: 'Adol', descriptionAr: '', idfNumber: 'IDF-PARA-500', priority: 2 })).toEqual({
      itemNumber: '300110',
      idfNumber: 'IDF-PARA-500',
      priority: '2',
      reason: '',
    })
  })

  it('the body is the group, the priority as a number and the reason, trimmed', () => {
    expect(generalEditBody({ itemNumber: ' 300999 ', idfNumber: ' IDF-IBU ', priority: ' 07 ', reason: ' New item ' })).toEqual({ idfNumber: 'IDF-IBU', priority: 7, reason: 'New item' })
  })
})

describe('a priority is a whole number of 1 or more, shared by the draft and the general edits (3185 review)', () => {
  it('reads a whole number of 1 or more, trimmed', () => {
    expect(wholePriority(' 12 ')).toBe(12)
    expect(wholePriority('1')).toBe(1)
  })
  it('anything else is null: blank, 0, negative, decimal, hex, exponent', () => {
    for (const p of ['', ' ', '0', '-3', '2.5', '0x10', '1e1', 'two', '00']) expect(wholePriority(p), p).toBeNull()
  })
})

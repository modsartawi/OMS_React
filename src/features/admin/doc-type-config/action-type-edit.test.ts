/**
 * Ticket 3155 — the action types page and its save dialog, as pure functions: both name EVERY document type and
 * delivery type in the category (the edit reaches them all), only the description and the five options change, and Save
 * waits for a change, a valid description and a reason.
 */
import { describe, expect, it } from 'vitest'
import {
  ACTION_DESCRIPTION_MAX,
  actionTypeEditState,
  actionTypeSaveRequest,
  affectedTypesView,
  descriptionProblem,
  setActionTypeField,
} from './action-type-edit'
import type { ActionTypeSettings, AffectedDocumentType } from './action-type-types'

const actionType = (over: Partial<ActionTypeSettings> = {}): ActionTypeSettings => ({
  actionType: 'OCAN',
  description: 'Order cancel',
  documentCategory: 'O',
  updateLastAction: true,
  deactivateDocument: true,
  activateDocument: false,
  completeDocument: false,
  allowedWhenCompleted: false,
  ...over,
})

const affected: AffectedDocumentType[] = [
  { documentType: 'WSFD', description: 'Wasfaty delivery', kind: 'DocumentType' },
  { documentType: 'DL', description: 'Delivery', kind: 'DeliveryDocumentType' },
  { documentType: 'BUPA', description: 'Bupa insurance', kind: 'DocumentType' },
  { documentType: 'CASH', description: 'Cash sale', kind: 'DocumentType' },
]

describe('affectedTypesView — what the page and the save dialog both list', () => {
  it('names every type the category holds, document types then delivery types, each by code', () => {
    const view = affectedTypesView(affected)
    expect(view.total).toBe(4)
    expect(view.groups.map((g) => g.kind)).toEqual(['DocumentType', 'DeliveryDocumentType'])
    expect(view.groups[0].types.map((t) => t.documentType)).toEqual(['BUPA', 'CASH', 'WSFD'])
    expect(view.groups[1].types.map((t) => t.documentType)).toEqual(['DL'])
  })

  it('drops an empty kind, and is empty for no types', () => {
    expect(affectedTypesView(affected.filter((t) => t.kind === 'DocumentType')).groups.map((g) => g.kind)).toEqual(['DocumentType'])
    expect(affectedTypesView([])).toEqual({ total: 0, groups: [] })
    expect(affectedTypesView(undefined)).toEqual({ total: 0, groups: [] })
  })
})

describe('the action type edit', () => {
  it('changes the description and the options, never the code or the category', () => {
    const before = actionType()
    expect(setActionTypeField(before, 'completeDocument', true).completeDocument).toBe(true)
    expect(setActionTypeField(before, 'description', 'Cancelled').description).toBe('Cancelled')
    expect(before.completeDocument).toBe(false)
    // @ts-expect-error — code and category are not editable fields
    expect(setActionTypeField(before, 'documentCategory', 'X')).toBe(before)
  })

  it('lists only what changed, in the page order, comparing text trimmed', () => {
    const before = actionType()
    const draft = { ...before, description: ' Order cancel ', allowedWhenCompleted: true, updateLastAction: false }
    expect(actionTypeEditState(before, draft, 'why', affected).changes).toEqual([
      { field: 'updateLastAction', before: true, after: false },
      { field: 'allowedWhenCompleted', before: false, after: true },
    ])
  })

  it('Save waits for a change, a valid description and a reason', () => {
    const before = actionType()
    expect(actionTypeEditState(before, before, 'why', affected).blocker).toBe('noChange')
    const changed = { ...before, completeDocument: true }
    expect(actionTypeEditState(before, changed, '  ', affected).blocker).toBe('reason')
    expect(actionTypeEditState(before, { ...changed, description: '' }, 'why', affected).blocker).toBe('description')
    const ok = actionTypeEditState(before, changed, 'why', affected)
    expect(ok.canSave).toBe(true)
    expect(ok.blocker).toBeNull()
  })

  it('the dialog repeats the page’s affected types', () => {
    const state = actionTypeEditState(actionType(), actionType({ completeDocument: true }), 'why', affected)
    expect(state.affected).toEqual(affectedTypesView(affected))
  })

  it('refuses a description the column cannot hold, as the server does', () => {
    expect(descriptionProblem('Order cancel')).toBeNull()
    expect(descriptionProblem('   ')).toBe('empty')
    expect(descriptionProblem('x'.repeat(ACTION_DESCRIPTION_MAX))).toBeNull()
    expect(descriptionProblem('x'.repeat(ACTION_DESCRIPTION_MAX + 1))).toBe('tooLong')
    expect(descriptionProblem('إلغاء الطلب')).toBe('notPlainText')
  })

  it('sends the loaded row as the before-state, the description trimmed, and the trimmed reason', () => {
    const before = actionType()
    const draft = { ...before, description: '  Cancelled  ', completeDocument: true }
    expect(actionTypeSaveRequest(before, draft, '  customer asked ')).toEqual({
      before,
      after: { ...draft, description: 'Cancelled' },
      reason: 'customer asked',
    })
  })
})

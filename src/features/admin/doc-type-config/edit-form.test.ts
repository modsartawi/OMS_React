/**
 * Ticket 3149 — the edit dialog's rules, as pure functions: locked fields are read-only, Save is disabled until
 * something changed AND a reason is given, and the request carries the before-state the screen loaded.
 */
import { describe, expect, it } from 'vitest'
import { editState, saveRequest, setField } from './edit-form'
import { ALL_FIELDS, LOCKED_FIELDS, isLocked } from './fields'
import { settings } from './test-fixtures'

describe('the field map', () => {
  it('shows every setting the door answers, once', () => {
    const fields = ALL_FIELDS.map((f) => f.field)
    expect(new Set(fields).size).toBe(fields.length)
    expect([...fields].sort()).toEqual(Object.keys(settings()).sort())
  })

  it('locks code, category and engine — nothing else', () => {
    expect([...LOCKED_FIELDS].sort()).toEqual(['documentCategory', 'documentType', 'engineType'])
    expect(isLocked('isPickedOnOrder')).toBe(false)
  })
})

describe('setField', () => {
  it('changes an editable field and leaves the draft it was given alone', () => {
    const draft = settings()
    const next = setField(draft, 'isPickedOnOrder', true)
    expect(next.isPickedOnOrder).toBe(true)
    expect(draft.isPickedOnOrder).toBe(false)
  })

  it.each(['documentType', 'documentCategory', 'engineType'] as const)('🚩 leaves the locked %s read-only', (field) => {
    const draft = settings()
    expect(setField(draft, field, 'ZZZZ')).toBe(draft)
  })
})

describe('editState', () => {
  const before = settings()

  it('cannot save while nothing changed, even with a reason', () => {
    const s = editState(before, settings(), 'because')
    expect(s.changes).toEqual([])
    expect(s.canSave).toBe(false)
    expect(s.blocker).toBe('noChange')
  })

  it.each(['', '   '])('cannot save a change without a reason (%j)', (reason) => {
    const s = editState(before, settings({ autoClose: true }), reason)
    expect(s.changes).toHaveLength(1)
    expect(s.canSave).toBe(false)
    expect(s.blocker).toBe('reason')
  })

  it('cannot save a reason over 200 characters', () => {
    expect(editState(before, settings({ autoClose: true }), 'x'.repeat(201)).blocker).toBe('reason')
  })

  it('can save a change with a reason; the diff shows only what changed', () => {
    const s = editState(before, settings({ autoClose: true }), ' customer asked ')
    expect(s.canSave).toBe(true)
    expect(s.blocker).toBe(null)
    expect(s.changes).toEqual([{ field: 'autoClose', before: false, after: true }])
  })
})

describe('saveRequest', () => {
  it('sends the loaded before-state, the draft and the trimmed reason', () => {
    const before = settings()
    const after = settings({ autoClose: true })
    expect(saveRequest(before, after, '  customer asked  ')).toEqual({ before, after, reason: 'customer asked' })
  })
})

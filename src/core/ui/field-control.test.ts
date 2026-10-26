// The shared field controls' wiring (ticket 595, spec 590 §Shared controls): how a Field links
// its label, hint and error to the one control inside it. Pure, so it is proven here; the
// painted look is proven by tools/dmsco-theme-drive.mjs (no React Testing Library, spec 083).
import { describe, expect, it } from 'vitest'
import { describedBy, fieldIds, controlWiring } from './field-control'

describe('describedBy', () => {
  it('joins the ids that are present, in order', () => {
    expect(describedBy('a-hint', undefined, 'a-error')).toBe('a-hint a-error')
  })

  it('is absent rather than empty when nothing describes the control', () => {
    // An empty aria-describedby="" is noise to a screen reader; the attribute must not render.
    expect(describedBy(undefined, '', false, null)).toBeUndefined()
  })
})

describe('fieldIds', () => {
  it('names the hint and the error after the control id', () => {
    expect(fieldIds('r1', { hint: true, error: true })).toEqual({
      controlId: 'r1',
      hintId: 'r1-hint',
      errorId: 'r1-error',
      describedBy: 'r1-hint r1-error',
    })
  })

  it('describes the control by nothing when the field has neither hint nor error', () => {
    expect(fieldIds('r1', { hint: false, error: false })).toEqual({
      controlId: 'r1',
      hintId: undefined,
      errorId: undefined,
      describedBy: undefined,
    })
  })
})

describe('controlWiring', () => {
  const field = { controlId: 'r1', describedBy: 'r1-hint', invalid: false }

  it('takes the Field id, description and validity when the control states none', () => {
    expect(controlWiring(field, {})).toEqual({ id: 'r1', 'aria-describedby': 'r1-hint', 'aria-invalid': undefined })
  })

  it('keeps an id the control states itself', () => {
    expect(controlWiring(field, { id: 'own' }).id).toBe('own')
  })

  it("keeps the control's own description beside the Field's", () => {
    expect(controlWiring(field, { 'aria-describedby': 'note' })['aria-describedby']).toBe('r1-hint note')
  })

  it('is invalid when the Field carries an error, or when the control says so', () => {
    expect(controlWiring({ ...field, invalid: true }, {})['aria-invalid']).toBe(true)
    expect(controlWiring(field, { 'aria-invalid': true })['aria-invalid']).toBe(true)
  })

  it('renders no aria-invalid at all on a valid control', () => {
    // aria-invalid="false" is legal but every valid field in the app would carry it.
    expect(controlWiring(field, { 'aria-invalid': false })['aria-invalid']).toBeUndefined()
  })

  it('passes a lone control (no Field around it) through unchanged', () => {
    expect(controlWiring(null, { id: 'x', 'aria-describedby': 'd' })).toEqual({
      id: 'x',
      'aria-describedby': 'd',
      'aria-invalid': undefined,
    })
  })
})

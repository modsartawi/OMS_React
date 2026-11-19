/**
 * Oms 922 — a reviewer's mark (BackOffice spec 4050 story 19): watching, cleared, confirmed or closed, with a note that
 * says why. The form reads its problem from `markProblem`; only a body `markBody` made is sent (`./api.test.ts`).
 */
import { describe, expect, it } from 'vitest'
import { draftAfterSave, MARK_STATUSES, markBody, markProblem, NOTE_MAX } from './mark'

describe('the statuses a reviewer sets', () => {
  it('are watching, cleared, confirmed and closed — never open, which is the job’s', () => {
    expect(MARK_STATUSES).toEqual(['watching', 'cleared', 'confirmed', 'closed'])
  })
})

describe('what stops a mark', () => {
  it('no status chosen', () => {
    expect(markProblem({ status: '', note: 'checked the CCTV' })).toBe('status')
  })

  it('a blank note, spaces included', () => {
    for (const note of ['', '   ', '\n\t']) expect(markProblem({ status: 'cleared', note })).toBe('note')
  })

  it(`a note past ${NOTE_MAX} characters, counted after trimming`, () => {
    expect(NOTE_MAX).toBe(500)
    expect(markProblem({ status: 'cleared', note: 'x'.repeat(500) })).toBeNull()
    expect(markProblem({ status: 'cleared', note: `  ${'x'.repeat(500)}  ` })).toBeNull()
    expect(markProblem({ status: 'cleared', note: 'x'.repeat(501) })).toBe('tooLong')
  })

  it('a status and a note: nothing', () => {
    for (const status of MARK_STATUSES) expect(markProblem({ status, note: 'a note' })).toBeNull()
  })
})

describe('the body sent', () => {
  it('the status and the note trimmed; an Arabic note as typed', () => {
    expect(markBody({ status: 'confirmed', note: '  three pharmacies in one morning  ' })).toEqual({ status: 'confirmed', note: 'three pharmacies in one morning' })
    expect(markBody({ status: 'watching', note: 'مريض مزمن يسافر كثيرا' })).toEqual({ status: 'watching', note: 'مريض مزمن يسافر كثيرا' })
  })

  it('none for a draft with a problem', () => {
    expect(markBody({ status: '', note: 'a note' })).toBeNull()
    expect(markBody({ status: 'closed', note: ' ' })).toBeNull()
  })
})

describe('the form after a mark is saved (review 8)', () => {
  const sent = { status: 'cleared', note: 'Known chronic traveller.' } as const

  it('empties when it still holds what was sent', () => {
    expect(draftAfterSave({ ...sent }, sent)).toEqual({ status: '', note: '' })
  })

  it('keeps what was typed while the mark was saving: a longer note, another status', () => {
    expect(draftAfterSave({ status: 'cleared', note: 'Known chronic traveller. Payer agrees.' }, sent)).toEqual({ status: 'cleared', note: 'Known chronic traveller. Payer agrees.' })
    expect(draftAfterSave({ status: 'watching', note: 'Known chronic traveller.' }, sent)).toEqual({ status: 'watching', note: 'Known chronic traveller.' })
  })
})

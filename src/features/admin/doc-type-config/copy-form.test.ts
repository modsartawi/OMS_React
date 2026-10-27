/**
 * Ticket 3153 — the copy dialog's rules, as pure functions: the copy starts from the source with a blank code and
 * description; EVERY setting is editable before the first save (category and engine included), while the edit of a
 * saved type keeps them locked; Save waits for a new, unused code that fits the column, a description and a reason;
 * the code-only-behaviour warning shows when the server lists the source code, and never blocks.
 */
import { describe, expect, it } from 'vitest'
import en from '@/locales/en/doc-type-config.json'
import ar from '@/locales/ar/doc-type-config.json'
import { hasLocaleKey as has } from '@/core/test/locale'
import { CODE_MAX, copyDraft, copyRequest, copyState, copyWarning, setCopyField } from './copy-form'
import { setField } from './edit-form'
import { settings } from './test-fixtures'
import type { CodeOnlyBehaviourLine } from './types'

const EXISTING = ['BUPA', 'CASH', 'ORRT']
const ready = () => ({ ...copyDraft(settings()), documentType: 'BUPB', description: 'Bupa copy' })

describe('copyDraft', () => {
  it('starts from the source with a blank code and description', () => {
    const draft = copyDraft(settings({ isPickedOnOrder: true }))
    expect(draft.documentType).toBe('')
    expect(draft.description).toBe('')
    expect(draft.isPickedOnOrder).toBe(true)
    expect(draft.engineType).toBe('SISPRICING')
  })
})

describe('🚩 category and engine are editable before the first save only', () => {
  it.each(['documentType', 'documentCategory', 'engineType'] as const)('the copy changes %s', (field) => {
    expect(setCopyField(copyDraft(settings()), field, 'LEGACY')[field]).toBe('LEGACY')
  })

  it.each(['documentCategory', 'engineType'] as const)('…while the saved type keeps %s locked', (field) => {
    const saved = settings()
    expect(setField(saved, field, 'LEGACY')).toBe(saved)
  })
})

describe('copyState', () => {
  it('cannot save without a code', () => {
    expect(copyState(copyDraft(settings()), 'new channel', EXISTING).blocker).toBe('codeRequired')
  })

  it(`cannot save a code longer than ${CODE_MAX}`, () => {
    expect(copyState({ ...ready(), documentType: 'BUPAX' }, 'new channel', EXISTING).blocker).toBe('codeTooLong')
  })

  it('cannot save a code that is already a type, whatever its case or spaces', () => {
    expect(copyState({ ...ready(), documentType: ' cash ' }, 'new channel', EXISTING).blocker).toBe('codeExists')
  })

  it('cannot save without a description', () => {
    expect(copyState({ ...ready(), description: '  ' }, 'new channel', EXISTING).blocker).toBe('descriptionRequired')
  })

  it.each(['', '   ', 'x'.repeat(201)])('cannot save without a reason of 1-200 characters', (reason) => {
    expect(copyState(ready(), reason, EXISTING).blocker).toBe('reason')
  })

  it('can save a new code, a description and a reason', () => {
    const s = copyState(ready(), ' new channel ', EXISTING)
    expect(s.canSave).toBe(true)
    expect(s.blocker).toBeNull()
  })
})

describe('copyRequest', () => {
  it('sends the code trimmed and upper-case, every setting as edited, and the trimmed reason', () => {
    const draft = setCopyField({ ...ready(), documentType: ' bupb ' }, 'engineType', 'LEGACY')
    const req = copyRequest(draft, '  new channel ')
    expect(req.reason).toBe('new channel')
    expect(req.after.documentType).toBe('BUPB')
    expect(req.after.engineType).toBe('LEGACY')
    expect(req.after.description).toBe('Bupa copy')
  })
})

describe('copyWarning', () => {
  const line: CodeOnlyBehaviourLine = { entityType: 'DocumentType', code: 'BUPA', english: 'BUPA: no SMS.', arabic: 'بوبا: بدون رسائل.' }

  it('shows the lines the server lists for the source code', () => {
    expect(copyWarning([line])).toEqual({ show: true, lines: [line] })
  })

  it('shows nothing for an unlisted code, or while the list loads', () => {
    expect(copyWarning([]).show).toBe(false)
    expect(copyWarning(undefined).show).toBe(false)
  })

  it('never blocks the save', () => {
    copyWarning([line])
    expect(copyState(ready(), 'new channel', EXISTING).canSave).toBe(true)
  })
})

describe('the copy dialog has words in English and Arabic', () => {
  it.each([en, ar])('every blocker, the warning and the button', (locale) => {
    const keys = [
      ...['codeRequired', 'codeTooLong', 'codeExists', 'descriptionRequired'].map((b) => `copy.blockers.${b}`),
      ...['title', 'confirm', 'note', 'warningTitle', 'warningNote', 'saved', 'failed'].map((k) => `copy.${k}`),
      'detail.copy',
    ]
    for (const key of keys) expect([key, has(locale, key)]).toEqual([key, true])
  })
})

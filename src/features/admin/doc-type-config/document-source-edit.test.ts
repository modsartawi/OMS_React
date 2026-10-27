/**
 * Ticket 3156 — the document sources page's rules: the address (source + tab), the edit (description + category, code
 * locked; a change, a description the column holds, a reason), the copy (a new free code, the edited description and
 * category, a reason; the code-only-behaviour warning never blocks) and the refusal codes.
 */
import { describe, expect, it } from 'vitest'
import { copyWarning } from './copy-form'
import {
  DOCUMENT_SOURCES_TABS,
  SOURCE_CATEGORIES,
  SOURCE_CODE_MAX,
  documentSourcesParams,
  documentSourcesViewFromParams,
  setSourceField,
  sourceCopyDraft,
  sourceCopyRequest,
  sourceCopyState,
  sourceEditState,
  sourceSaveRequest,
} from './document-source-edit'
import { DOCUMENT_SOURCE_ERRORS } from './document-sources-api'
import type { DocumentSourceSettings } from './document-source-types'

const source = (over: Partial<DocumentSourceSettings> = {}): DocumentSourceSettings => ({
  documentSource: 'WSFD',
  description: 'Wasfaty',
  documentSourceCategory: '',
  ...over,
})

describe('the document sources address', () => {
  it('reads the source and the tab, defaulting to the source tab', () => {
    expect(documentSourcesViewFromParams(new URLSearchParams('source=%20cinb%20&tab=history'))).toEqual({ source: 'CINB', tab: 'history' })
    expect(documentSourcesViewFromParams(new URLSearchParams('tab=bogus'))).toEqual({ source: '', tab: 'source' })
    expect(DOCUMENT_SOURCES_TABS).toEqual(['source', 'history'])
  })

  it('writes no key for a blank source or the default tab', () => {
    expect(documentSourcesParams({ source: 'CINB', tab: 'history' }).toString()).toBe('source=CINB&tab=history')
    expect(documentSourcesParams({ source: 'CINB', tab: 'source' }).toString()).toBe('source=CINB')
    expect(documentSourcesParams({ source: '', tab: 'source' }).toString()).toBe('')
  })
})

describe('editing a source', () => {
  it('offers blank and C only', () => {
    expect(SOURCE_CATEGORIES).toEqual(['', 'C'])
  })

  it('changes description and category, never the code', () => {
    const before = source()
    expect(setSourceField(before, 'documentSourceCategory', 'C').documentSourceCategory).toBe('C')
    expect(setSourceField(before, 'documentSource' as never, 'XXXX' as never)).toBe(before)
  })

  it('waits for a change, a valid description and a reason, and lists the before/after', () => {
    const before = source()
    expect(sourceEditState(before, before, 'why').blocker).toBe('noChange')
    const draft = setSourceField(setSourceField(before, 'documentSourceCategory', 'C'), 'description', ' Wasfaty CC ')
    const state = sourceEditState(before, draft, '')
    expect(state.changes).toEqual([
      { field: 'description', before: 'Wasfaty', after: ' Wasfaty CC ' },
      { field: 'documentSourceCategory', before: '', after: 'C' },
    ])
    expect(state.blocker).toBe('reason')
    expect(sourceEditState(before, draft, 'moved to the call centre').canSave).toBe(true)
    expect(sourceEditState(before, { ...draft, description: 'وصف' }, 'why').blocker).toBe('description')
    expect(sourceEditState(before, { ...draft, description: 'x'.repeat(51) }, 'why').description).toBe('tooLong')
  })

  it('sends the loaded row as before and the trimmed draft as after', () => {
    const before = source()
    expect(sourceSaveRequest(before, { ...before, description: ' New ' }, ' why ')).toEqual({
      before,
      after: { ...before, description: 'New' },
      reason: 'why',
    })
  })
})

describe('copying a source', () => {
  it('starts blank on code and description, keeping the category', () => {
    expect(sourceCopyDraft(source({ documentSourceCategory: 'C' }))).toEqual({ documentSource: '', description: '', documentSourceCategory: 'C' })
  })

  it('waits for a free code that fits, a description and a reason', () => {
    const existing = ['WSFD', 'CINB']
    const draft = { documentSource: '', description: 'New', documentSourceCategory: 'C' }
    expect(sourceCopyState(draft, 'why', existing).blocker).toBe('codeRequired')
    expect(sourceCopyState({ ...draft, documentSource: 'abcde' }, 'why', existing).blocker).toBe('codeTooLong')
    expect(sourceCopyState({ ...draft, documentSource: ' cinb' }, 'why', existing).blocker).toBe('codeExists')
    expect(sourceCopyState({ ...draft, documentSource: 'CNEW', description: ' ' }, 'why', existing).blocker).toBe('description')
    expect(sourceCopyState({ ...draft, documentSource: 'CNEW' }, ' ', existing).blocker).toBe('reason')
    const ok = sourceCopyState({ ...draft, documentSource: ' cnew ' }, 'why', existing)
    expect([ok.canSave, ok.code]).toEqual([true, 'CNEW'])
    expect(SOURCE_CODE_MAX).toBe(4)
  })

  it('sends the new code normalised', () => {
    expect(sourceCopyRequest({ documentSource: ' cnew ', description: ' New ', documentSourceCategory: 'C' }, ' why ')).toEqual({
      after: { documentSource: 'CNEW', description: 'New', documentSourceCategory: 'C' },
      reason: 'why',
    })
  })

  it('warns for a listed source code and never blocks', () => {
    const lines = [{ entityType: 'DocumentSource', code: 'WSFD', english: 'Delivery only.', arabic: 'توصيل فقط.' }]
    expect(copyWarning(lines)).toEqual({ show: true, lines })
    expect(copyWarning([]).show).toBe(false)
  })
})

describe('the source refusals', () => {
  it('are the server block 70-79', () => {
    expect(DOCUMENT_SOURCE_ERRORS).toEqual({
      unknownDocumentSource: 'SDC-00070',
      descriptionInvalid: 'SDC-00071',
      categoryInvalid: 'SDC-00072',
    })
  })
})

/**
 * The document sources page and its dialogs (BackOffice spec 3148; ticket 3156), as pure functions the components
 * render. A source has a code (locked), a description and a category — blank, or `C` for the call-centre channels (a `C`
 * source is on every agent's source list). Edit changes the description and the category; there is no delete. A new
 * source is made only by copying one under a new code (the server copies every column), with the description and
 * category edited. The copy dialog warns, never blocks, when the source code carries behaviour tied to the code
 * (3153's `copyWarning`). The server re-checks everything. Pure: no React, no `t`.
 */
import { reasonField, type ReasonCheck } from '@/core/reason/reason'
import { descriptionProblem, type DescriptionProblem } from './action-type-edit'
import { normaliseCode } from './copy-form'
import type {
  DocumentSourceCopyRequest,
  DocumentSourceEditableField,
  DocumentSourceSettings,
  DocumentSourceUpdateRequest,
} from './document-source-types'

// ── The address ─────────────────────────────────────────────────────────────────────────────────

/** `?source=` picks one source; `?tab=history` opens its History (the Source tab writes no key). */
export const DOCUMENT_SOURCES_TABS = ['source', 'history'] as const
export type DocumentSourcesTab = (typeof DOCUMENT_SOURCES_TABS)[number]

export interface DocumentSourcesView {
  source: string
  tab: DocumentSourcesTab
}

export function documentSourcesViewFromParams(params: URLSearchParams): DocumentSourcesView {
  const tab = params.get('tab')
  return {
    source: normaliseCode(params.get('source') ?? ''),
    tab: (DOCUMENT_SOURCES_TABS as readonly (string | null)[]).includes(tab) ? (tab as DocumentSourcesTab) : 'source',
  }
}

export function documentSourcesParams(view: DocumentSourcesView): URLSearchParams {
  const params = new URLSearchParams()
  if (view.source) params.set('source', view.source)
  if (view.tab !== 'source') params.set('tab', view.tab)
  return params
}

// ── The edit ────────────────────────────────────────────────────────────────────────────────────

/** `SdDocumentSourceSettings.Categories`: blank (any other entry point) or `C` (call centre). */
export const SOURCE_CATEGORIES = ['', 'C'] as const

/** `SdDocumentSource.DocumentSource` is VARCHAR(4). */
export const SOURCE_CODE_MAX = 4

/** The fields in the order the page and the dialogs show them. */
export const SOURCE_EDITABLE_FIELDS: readonly DocumentSourceEditableField[] = ['description', 'documentSourceCategory']

const EDITABLE = new Set<string>(SOURCE_EDITABLE_FIELDS)

/** The draft with one field changed — or the very same draft for a field that is not editable (the code). */
export function setSourceField(draft: DocumentSourceSettings, field: DocumentSourceEditableField, value: string): DocumentSourceSettings {
  if (!EDITABLE.has(field)) return draft
  return { ...draft, [field]: value }
}

export interface SourceChange {
  field: DocumentSourceEditableField
  before: string
  after: string
}

export type SourceEditBlocker = 'noChange' | 'description' | 'reason'

export interface SourceEditState {
  changes: SourceChange[]
  description: DescriptionProblem | null
  reason: ReasonCheck
  canSave: boolean
  blocker: SourceEditBlocker | null
}

export function sourceEditState(before: DocumentSourceSettings, draft: DocumentSourceSettings, reasonText: string): SourceEditState {
  const changes = SOURCE_EDITABLE_FIELDS.flatMap((field) =>
    before[field].trim() === draft[field].trim() ? [] : [{ field, before: before[field], after: draft[field] }],
  )
  const description = descriptionProblem(draft.description)
  const reason = reasonField(reasonText)
  const blocker: SourceEditBlocker | null =
    changes.length === 0 ? 'noChange' : description !== null ? 'description' : reason.problem !== null ? 'reason' : null
  return { changes, description, reason, canSave: blocker === null, blocker }
}

export function sourceSaveRequest(before: DocumentSourceSettings, draft: DocumentSourceSettings, reasonText: string): DocumentSourceUpdateRequest {
  return { before, after: { ...draft, description: draft.description.trim() }, reason: reasonField(reasonText).reason }
}

// ── The copy ────────────────────────────────────────────────────────────────────────────────────

/** A copy starts from the source with a blank code and description; the category is kept. */
export function sourceCopyDraft(source: DocumentSourceSettings): DocumentSourceSettings {
  return { ...source, documentSource: '', description: '' }
}

export type SourceCopyBlocker = 'codeRequired' | 'codeTooLong' | 'codeExists' | 'description' | 'reason'

export interface SourceCopyState {
  code: string
  description: DescriptionProblem | null
  reason: ReasonCheck
  canSave: boolean
  blocker: SourceCopyBlocker | null
}

export function sourceCopyState(draft: DocumentSourceSettings, reasonText: string, existingCodes: readonly string[]): SourceCopyState {
  const code = normaliseCode(draft.documentSource)
  const description = descriptionProblem(draft.description)
  const reason = reasonField(reasonText)
  const existing = new Set(existingCodes.map(normaliseCode))
  const blocker: SourceCopyBlocker | null =
    code.length === 0
      ? 'codeRequired'
      : code.length > SOURCE_CODE_MAX
        ? 'codeTooLong'
        : existing.has(code)
          ? 'codeExists'
          : description !== null
            ? 'description'
            : reason.problem !== null
              ? 'reason'
              : null
  return { code, description, reason, canSave: blocker === null, blocker }
}

export function sourceCopyRequest(draft: DocumentSourceSettings, reasonText: string): DocumentSourceCopyRequest {
  return {
    after: { ...draft, documentSource: normaliseCode(draft.documentSource), description: draft.description.trim() },
    reason: reasonField(reasonText).reason,
  }
}

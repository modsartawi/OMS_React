/**
 * The copy dialog's rules (BackOffice spec 3148 stories 26-30; ticket 3153), as pure functions the dialog renders.
 * A copy starts from the source with a blank code and description; EVERY setting is editable until the first save —
 * category and engine included, since they lock only once the type exists (`isLocked` governs the edit dialog, not
 * this one). Save waits for a new code (non-blank, at most the column's width, not already a type), a description
 * and the core reason rule. The code-only-behaviour warning is shown when the server lists the source code; it never
 * blocks. The server re-checks everything (SDC-00040..42, SDC-00010). Pure: no React, no `t`.
 */
import { reasonField, type ReasonCheck } from '@/core/reason/reason'
import type { FieldValue } from './diff'
import type { CodeOnlyBehaviourLine, DocumentTypeCopyRequest, DocumentTypeField, DocumentTypeSettings } from './types'

/** `SdDocumentType.DocumentType` is VARCHAR(4). */
export const CODE_MAX = 4

/** A code as the column holds it: trimmed, upper-case. */
export const normaliseCode = (code: string): string => code.trim().toUpperCase()

export function copyDraft(source: DocumentTypeSettings): DocumentTypeSettings {
  return { ...source, documentType: '', description: '' }
}

/** The draft with one field changed — any field, the locked-once-saved ones included. */
export function setCopyField(draft: DocumentTypeSettings, field: DocumentTypeField, value: FieldValue): DocumentTypeSettings {
  return { ...draft, [field]: value }
}

export type CopyBlocker = 'codeRequired' | 'codeTooLong' | 'codeExists' | 'descriptionRequired' | 'reason'

export interface CopyState {
  code: string
  reason: ReasonCheck
  canSave: boolean
  /** Why Save is disabled, or `null` when it may be pressed. */
  blocker: CopyBlocker | null
}

export function copyState(draft: DocumentTypeSettings, reasonText: string, existingCodes: readonly string[]): CopyState {
  const code = normaliseCode(draft.documentType)
  const reason = reasonField(reasonText)
  const existing = new Set(existingCodes.map(normaliseCode))
  const blocker: CopyBlocker | null =
    code.length === 0
      ? 'codeRequired'
      : code.length > CODE_MAX
        ? 'codeTooLong'
        : existing.has(code)
          ? 'codeExists'
          : draft.description.trim().length === 0
            ? 'descriptionRequired'
            : reason.problem !== null
              ? 'reason'
              : null
  return { code, reason, canSave: blocker === null, blocker }
}

export function copyRequest(draft: DocumentTypeSettings, reasonText: string): DocumentTypeCopyRequest {
  return { after: { ...draft, documentType: normaliseCode(draft.documentType) }, reason: reasonField(reasonText).reason }
}

export interface CopyWarning {
  show: boolean
  lines: CodeOnlyBehaviourLine[]
}

/** The code-only-behaviour warning: shown when the server lists the source code. Never a blocker. */
export function copyWarning(lines: CodeOnlyBehaviourLine[] | undefined): CopyWarning {
  const listed = lines ?? []
  return { show: listed.length > 0, lines: listed }
}

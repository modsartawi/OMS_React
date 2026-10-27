/**
 * The edit dialog's rules (BackOffice spec 3148 stories 9-10, 15, 17; ticket 3149), as pure functions the dialog
 * renders: locked fields stay read-only, Save waits for a change AND a reason (the core reason rule, 1-200 characters
 * trimmed — the server keeps up to 500), and a save sends the before-state the screen loaded, so a save over someone
 * else's change is refused (`SDC-00004`) instead of overwriting it. Pure: no React, no `t`.
 */
import { reasonField, type ReasonCheck } from '@/core/reason/reason'
import { changedFields, type FieldChange, type FieldValue } from './diff'
import { isLocked } from './fields'
import type { DocumentTypeField, DocumentTypeSettings, DocumentTypeUpdateRequest } from './types'

/** The draft with one field changed — or the very same draft for a locked field (read-only once the type exists). */
export function setField(draft: DocumentTypeSettings, field: DocumentTypeField, value: FieldValue): DocumentTypeSettings {
  if (isLocked(field)) return draft
  return { ...draft, [field]: value }
}

export type EditBlocker = 'noChange' | 'reason'

export interface EditState {
  changes: FieldChange[]
  reason: ReasonCheck
  canSave: boolean
  /** Why Save is disabled, or `null` when it may be pressed. */
  blocker: EditBlocker | null
}

export function editState(before: DocumentTypeSettings, draft: DocumentTypeSettings, reasonText: string): EditState {
  const changes = changedFields(before, draft)
  const reason = reasonField(reasonText)
  const blocker: EditBlocker | null = changes.length === 0 ? 'noChange' : reason.problem !== null ? 'reason' : null
  return { changes, reason, canSave: blocker === null, blocker }
}

export function saveRequest(before: DocumentTypeSettings, draft: DocumentTypeSettings, reasonText: string): DocumentTypeUpdateRequest {
  return { before, after: draft, reason: reasonField(reasonText).reason }
}

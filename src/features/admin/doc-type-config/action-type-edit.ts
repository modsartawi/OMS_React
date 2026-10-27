/**
 * The action types page and its save dialog (BackOffice spec 3148 stories 38-40, 42-43; ticket 3155), as pure functions
 * the components render. An action type is read by (code, the acting document's category), so an edit reaches EVERY
 * document type and delivery type in the category: the page and the dialog both list them (`affectedTypesView`). Only
 * the description and the five options change; code and category are locked (the key is the code alone), and there is
 * no create. Save waits for a change, a description the column can hold, and a reason. Pure: no React, no `t`.
 */
import { reasonField, type ReasonCheck } from '@/core/reason/reason'
import {
  ACTION_TYPE_OPTIONS,
  type ActionTypeEditableField,
  type ActionTypeSettings,
  type ActionTypeUpdateRequest,
  type AffectedDocumentType,
} from './action-type-types'

// ── The types an edit reaches ───────────────────────────────────────────────────────────────────

/** Document types first, then delivery types; an unknown kind last. */
const KIND_ORDER = ['DocumentType', 'DeliveryDocumentType'] as const

export interface AffectedTypesGroup {
  kind: string
  types: AffectedDocumentType[]
}

export interface AffectedTypesView {
  total: number
  groups: AffectedTypesGroup[]
}

export function affectedTypesView(types: readonly AffectedDocumentType[] | undefined): AffectedTypesView {
  const all = types ?? []
  const kinds = [...KIND_ORDER, ...[...new Set(all.map((t) => t.kind))].filter((k) => !(KIND_ORDER as readonly string[]).includes(k)).sort()]
  const groups = kinds
    .map((kind) => ({
      kind,
      types: all.filter((t) => t.kind === kind).sort((a, b) => (a.documentType < b.documentType ? -1 : a.documentType > b.documentType ? 1 : 0)),
    }))
    .filter((g) => g.types.length > 0)
  return { total: all.length, groups }
}

// ── The edit ────────────────────────────────────────────────────────────────────────────────────

/** `SdActionTypeSettings.Widths.Description` — a VARCHAR(50) the server writes ANSI. */
export const ACTION_DESCRIPTION_MAX = 50

export type DescriptionProblem = 'empty' | 'tooLong' | 'notPlainText'

/** The server's rule (`SDC-00061`): trimmed, 1-50 characters, printable ASCII only (the column cannot hold Arabic). */
export function descriptionProblem(text: string): DescriptionProblem | null {
  const d = text.trim()
  if (d.length === 0) return 'empty'
  if (d.length > ACTION_DESCRIPTION_MAX) return 'tooLong'
  if (!/^[\x20-\x7E]*$/.test(d)) return 'notPlainText'
  return null
}

/** The fields in the order the page and the dialog show them. */
export const ACTION_TYPE_EDITABLE_FIELDS: readonly ActionTypeEditableField[] = ['description', ...ACTION_TYPE_OPTIONS]

const EDITABLE = new Set<string>(ACTION_TYPE_EDITABLE_FIELDS)

/** The draft with one field changed — or the very same draft for a field that is not editable. */
export function setActionTypeField<F extends ActionTypeEditableField>(
  draft: ActionTypeSettings,
  field: F,
  value: ActionTypeSettings[F],
): ActionTypeSettings {
  if (!EDITABLE.has(field)) return draft
  return { ...draft, [field]: value }
}

export interface ActionTypeChange {
  field: ActionTypeEditableField
  before: string | boolean
  after: string | boolean
}

export type ActionTypeEditBlocker = 'noChange' | 'description' | 'reason'

export interface ActionTypeEditState {
  changes: ActionTypeChange[]
  description: DescriptionProblem | null
  reason: ReasonCheck
  /** The types the save reaches — the same list the page shows. */
  affected: AffectedTypesView
  canSave: boolean
  blocker: ActionTypeEditBlocker | null
}

const norm = (v: string | boolean) => (typeof v === 'string' ? v.trim() : v)

export function actionTypeEditState(
  before: ActionTypeSettings,
  draft: ActionTypeSettings,
  reasonText: string,
  affectedTypes: readonly AffectedDocumentType[] | undefined,
): ActionTypeEditState {
  const changes = ACTION_TYPE_EDITABLE_FIELDS.flatMap((field) =>
    norm(before[field]) === norm(draft[field]) ? [] : [{ field, before: before[field], after: draft[field] }],
  )
  const description = descriptionProblem(draft.description)
  const reason = reasonField(reasonText)
  const blocker: ActionTypeEditBlocker | null =
    changes.length === 0 ? 'noChange' : description !== null ? 'description' : reason.problem !== null ? 'reason' : null
  return { changes, description, reason, affected: affectedTypesView(affectedTypes), canSave: blocker === null, blocker }
}

export function actionTypeSaveRequest(before: ActionTypeSettings, draft: ActionTypeSettings, reasonText: string): ActionTypeUpdateRequest {
  return { before, after: { ...draft, description: draft.description.trim() }, reason: reasonField(reasonText).reason }
}

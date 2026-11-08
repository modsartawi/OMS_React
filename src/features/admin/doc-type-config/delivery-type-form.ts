/**
 * The delivery document type pages' rules (BackOffice spec 3148 stories 33-37, ticket 3154), as pure functions the
 * pages render: the settings grouped (identity, callouts) with their widths; code and category locked once the type
 * exists (the server refuses them too, `SDC-00003`); Save waits for a change and a reason on an edit, and for a new
 * unused code, a description and a reason on a copy (every setting editable until the first save). Also the code
 * dropdowns — a delivery type's default document type, and the document type form's default delivery type (story 36).
 * Pure: no React, no `t`.
 */
import { reasonField, type ReasonCheck } from '@/core/reason/reason'
import { CODE_MAX, copyState, normaliseCode, type CopyBlocker, type CopyState } from './copy-form'
import { settingsRefusals, type FieldRefusal } from './settings-refusal'
import type { DeliveryTypeCopyRequest, DeliveryTypeField, DeliveryTypeSettings, DeliveryTypeUpdateRequest } from './delivery-type-types'

export type DeliveryFieldKind = 'text' | 'flag' | 'number'

export interface DeliveryFieldDef {
  field: DeliveryTypeField
  kind: DeliveryFieldKind
  /** The column's width (`DeliveryDocumentType` DDL). */
  maxLength?: number
  /** Free text (shown `<bdi>`), not a code (shown `Ltr`). */
  freeText?: boolean
  /** A whole number (minutes), not a decimal. */
  integer?: boolean
  /** Picked from a list: the delivery categories, the OMS document types, or the callout distance modes. */
  choice?: 'category' | 'documentType' | 'distanceMode'
  /** Editable, but nothing in order processing reads it (labelled like the document type's billing settings). */
  notRead?: boolean
}

export type DeliveryGroupId = 'identity' | 'callouts'

const text = (field: DeliveryTypeField, maxLength: number, extra: Partial<DeliveryFieldDef> = {}): DeliveryFieldDef => ({
  field,
  kind: 'text',
  maxLength,
  ...extra,
})
const flag = (field: DeliveryTypeField): DeliveryFieldDef => ({ field, kind: 'flag' })

export const DELIVERY_FIELD_GROUPS: readonly { group: DeliveryGroupId; fields: readonly DeliveryFieldDef[] }[] = [
  {
    group: 'identity',
    fields: [
      text('documentType', 4),
      text('description', 40, { freeText: true }),
      text('documentCategory', 1, { choice: 'category' }),
      // Delivery numbering never reads it (review of spec 3148): the server no longer checks it against NumberRange.
      text('numberRangeNumber', 2, { notRead: true }),
      text('defaultDocumentType', 4, { choice: 'documentType' }),
    ],
  },
  {
    group: 'callouts',
    fields: [
      flag('isCompeted'),
      { field: 'calloutRadiusKm', kind: 'number' },
      { field: 'calloutExpandedRadiusKm', kind: 'number' },
      text('calloutDistanceMode', 10, { choice: 'distanceMode' }),
      flag('calloutStockCheck'),
      flag('calloutLocksDelivery'),
      { field: 'calloutLifetimeMinutes', kind: 'number', integer: true },
      flag('calloutDutyCheck'),
      text('servingListId', 26),
    ],
  },
]

/** The settings whose meaning is not plain from the label: each shows a hint under its input. */
export const DELIVERY_FIELD_HINTS: readonly DeliveryTypeField[] = ['calloutExpandedRadiusKm']

export const DELIVERY_ALL_FIELDS: readonly DeliveryFieldDef[] = DELIVERY_FIELD_GROUPS.flatMap((g) => g.fields)

/** `DocumentCategoryConstants` Delivery and DeliveryReturn — the only categories a delivery type takes. */
export const DELIVERY_CATEGORIES = ['D', 'T'] as const

/** `DeliveryDocumentType.DocumentType` is VARCHAR(4), like a document type's code. */
export const DELIVERY_CODE_MAX = CODE_MAX

const LOCKED: ReadonlySet<DeliveryTypeField> = new Set<DeliveryTypeField>(['documentType', 'documentCategory'])

export const isDeliveryLocked = (field: DeliveryTypeField): boolean => LOCKED.has(field)

/** `CalloutDistanceModes` (spec 3460, ticket 3471): the only values a delivery type's distance mode may hold. */
export const CALLOUT_DISTANCE_MODES = ['OFF', 'SHADOW', 'ON'] as const
export type CalloutDistanceMode = (typeof CALLOUT_DISTANCE_MODES)[number]

/**
 * A held distance mode as one of the three codes, compared as the server's `Code()` does (trimmed, upper case). A blank
 * — a type the migration has not reached — is `OFF`, the column's default. Null for anything else.
 */
export function calloutDistanceMode(value: unknown): CalloutDistanceMode | null {
  const code = typeof value === 'string' ? value.trim().toUpperCase() : ''
  if (code === '') return 'OFF'
  return (CALLOUT_DISTANCE_MODES as readonly string[]).includes(code) ? (code as CalloutDistanceMode) : null
}

export type DeliveryFieldValue = string | number | boolean

/**
 * The draft with one field changed — or the same draft for a locked field, unless it is a copy's draft, and for a
 * distance mode that is not one of the three codes (the server refuses it too, `SDC-00053`).
 */
export function setDeliveryField(
  draft: DeliveryTypeSettings,
  field: DeliveryTypeField,
  value: DeliveryFieldValue,
  { copy = false }: { copy?: boolean } = {},
): DeliveryTypeSettings {
  if (!copy && isDeliveryLocked(field)) return draft
  if (field === 'calloutDistanceMode') {
    const mode = typeof value === 'string' && value.trim() !== '' ? calloutDistanceMode(value) : null
    return mode === null ? draft : { ...draft, calloutDistanceMode: mode }
  }
  return { ...draft, [field]: value }
}

export interface DeliveryFieldChange {
  field: DeliveryTypeField
  before: DeliveryFieldValue
  after: DeliveryFieldValue
}

const norm = (v: DeliveryFieldValue): DeliveryFieldValue => (typeof v === 'string' ? v.trim() : v)

/** A blank distance mode is Off, so picking Off on a type not yet migrated is no change. */
const normField = (field: DeliveryTypeField, v: DeliveryFieldValue): DeliveryFieldValue =>
  field === 'calloutDistanceMode' ? (calloutDistanceMode(v) ?? norm(v)) : norm(v)

/** The fields whose values differ, in field order, compared as the server compares them. */
export function deliveryChangedFields(before: DeliveryTypeSettings, after: DeliveryTypeSettings): DeliveryFieldChange[] {
  return DELIVERY_ALL_FIELDS.flatMap(({ field }) =>
    normField(field, before[field]) === normField(field, after[field]) ? [] : [{ field, before: before[field], after: after[field] }],
  )
}

export interface DeliveryEditState {
  changes: DeliveryFieldChange[]
  reason: ReasonCheck
  canSave: boolean
  blocker: 'noChange' | 'reason' | null
}

export function deliveryEditState(before: DeliveryTypeSettings, draft: DeliveryTypeSettings, reasonText: string): DeliveryEditState {
  const changes = deliveryChangedFields(before, draft)
  const reason = reasonField(reasonText)
  const blocker = changes.length === 0 ? 'noChange' : reason.problem !== null ? 'reason' : null
  return { changes, reason, canSave: blocker === null, blocker }
}

export function deliverySaveRequest(before: DeliveryTypeSettings, draft: DeliveryTypeSettings, reasonText: string): DeliveryTypeUpdateRequest {
  return { before, after: draft, reason: reasonField(reasonText).reason }
}

// ── copy ────────────────────────────────────────────────────────────────────────────────────────

/** The copy form's code rule and copy state — one rule for document and delivery types (both codes VARCHAR(4)). */
export { normaliseCode as deliveryNormaliseCode, copyState as deliveryCopyState }
export type DeliveryCopyBlocker = CopyBlocker
export type DeliveryCopyState = CopyState

export function deliveryCopyDraft(source: DeliveryTypeSettings): DeliveryTypeSettings {
  return { ...source, documentType: '', description: '' }
}

export function deliveryCopyRequest(draft: DeliveryTypeSettings, reasonText: string): DeliveryTypeCopyRequest {
  return { after: { ...draft, documentType: normaliseCode(draft.documentType) }, reason: reasonField(reasonText).reason }
}

// ── refusals ────────────────────────────────────────────────────────────────────────────────────

/** The refused fields of a save error (`SDC-00010` `data.fields`, the document type's shape), by settings key. */
export function deliveryFieldRefusals(err: unknown): Partial<Record<DeliveryTypeField, FieldRefusal>> {
  return settingsRefusals(err) as Partial<Record<DeliveryTypeField, FieldRefusal>>
}

// ── warnings ────────────────────────────────────────────────────────────────────────────────────

export type DeliveryFieldWarning = 'expandedRadiusNoEffect'

/**
 * Settings the server accepts but that do nothing — warned on their field, never blocking Save. A wider callout radius
 * set (above 0) but not above the callout radius is stored and ignored (spec 3326); a negative one is the server's
 * refusal (`SDC-00053`), not a warning.
 */
export function deliveryFieldWarnings(draft: DeliveryTypeSettings): Partial<Record<DeliveryTypeField, DeliveryFieldWarning>> {
  const wider = Number(draft.calloutExpandedRadiusKm)
  return wider > 0 && wider <= Number(draft.calloutRadiusKm) ? { calloutExpandedRadiusKm: 'expandedRadiusNoEffect' } : {}
}

// ── code dropdowns ──────────────────────────────────────────────────────────────────────────────

export interface CodeChoice {
  value: string
  description: string
}

/**
 * A code dropdown's options: blank first (no reference), then every code by code. A value already held that the list
 * does not know (a legacy row) is kept last, so opening the form never changes it behind the consultant's back — the
 * server refuses only a CHANGE to an unknown code. Null while the list is not loaded (the form shows a text box).
 */
export function codeChoices(rows: readonly { code: string; description: string }[] | undefined | null, current: unknown): CodeChoice[] | null {
  if (!rows) return null
  const sorted = [...rows]
    .map((r) => ({ value: r.code.trim(), description: r.description.trim() }))
    .sort((a, b) => a.value.localeCompare(b.value))
  const held = typeof current === 'string' ? current.trim() : ''
  const known = held === '' || sorted.some((c) => c.value === held)
  return [{ value: '', description: '' }, ...sorted, ...(known ? [] : [{ value: held, description: '' }])]
}

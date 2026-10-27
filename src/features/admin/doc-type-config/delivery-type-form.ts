/**
 * The delivery document type pages' rules (BackOffice spec 3148 stories 33-37, ticket 3154), as pure functions the
 * pages render: the settings grouped (identity, callouts) with their widths; code and category locked once the type
 * exists (the server refuses them too, `SDC-00003`); Save waits for a change and a reason on an edit, and for a new
 * unused code, a description and a reason on a copy (every setting editable until the first save). Also the code
 * dropdowns — a delivery type's default document type, and the document type form's default delivery type (story 36).
 * Pure: no React, no `t`.
 */
import { reasonField, type ReasonCheck } from '@/core/reason/reason'
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
  /** Picked from a list: the delivery categories, or the OMS document types. */
  choice?: 'category' | 'documentType'
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
      text('numberRangeNumber', 2),
      text('defaultDocumentType', 4, { choice: 'documentType' }),
    ],
  },
  {
    group: 'callouts',
    fields: [
      flag('isCompeted'),
      { field: 'calloutRadiusKm', kind: 'number' },
      flag('calloutStockCheck'),
      flag('calloutLocksDelivery'),
      { field: 'calloutLifetimeMinutes', kind: 'number', integer: true },
      flag('calloutDutyCheck'),
      text('servingListId', 26),
    ],
  },
]

export const DELIVERY_ALL_FIELDS: readonly DeliveryFieldDef[] = DELIVERY_FIELD_GROUPS.flatMap((g) => g.fields)

/** `DocumentCategoryConstants` Delivery and DeliveryReturn — the only categories a delivery type takes. */
export const DELIVERY_CATEGORIES = ['D', 'T'] as const

/** `DeliveryDocumentType.DocumentType` is VARCHAR(4). */
export const DELIVERY_CODE_MAX = 4

const LOCKED: ReadonlySet<DeliveryTypeField> = new Set<DeliveryTypeField>(['documentType', 'documentCategory'])

export const isDeliveryLocked = (field: DeliveryTypeField): boolean => LOCKED.has(field)

export type DeliveryFieldValue = string | number | boolean

/** The draft with one field changed — or the same draft for a locked field, unless it is a copy's draft. */
export function setDeliveryField(
  draft: DeliveryTypeSettings,
  field: DeliveryTypeField,
  value: DeliveryFieldValue,
  { copy = false }: { copy?: boolean } = {},
): DeliveryTypeSettings {
  if (!copy && isDeliveryLocked(field)) return draft
  return { ...draft, [field]: value }
}

export interface DeliveryFieldChange {
  field: DeliveryTypeField
  before: DeliveryFieldValue
  after: DeliveryFieldValue
}

const norm = (v: DeliveryFieldValue): DeliveryFieldValue => (typeof v === 'string' ? v.trim() : v)

/** The fields whose values differ, in field order, compared as the server compares them. */
export function deliveryChangedFields(before: DeliveryTypeSettings, after: DeliveryTypeSettings): DeliveryFieldChange[] {
  return DELIVERY_ALL_FIELDS.flatMap(({ field }) =>
    norm(before[field]) === norm(after[field]) ? [] : [{ field, before: before[field], after: after[field] }],
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

const normaliseCode = (code: string): string => code.trim().toUpperCase()

export function deliveryCopyDraft(source: DeliveryTypeSettings): DeliveryTypeSettings {
  return { ...source, documentType: '', description: '' }
}

export type DeliveryCopyBlocker = 'codeRequired' | 'codeTooLong' | 'codeExists' | 'descriptionRequired' | 'reason'

export interface DeliveryCopyState {
  code: string
  reason: ReasonCheck
  canSave: boolean
  blocker: DeliveryCopyBlocker | null
}

export function deliveryCopyState(draft: DeliveryTypeSettings, reasonText: string, existingCodes: readonly string[]): DeliveryCopyState {
  const code = normaliseCode(draft.documentType)
  const reason = reasonField(reasonText)
  const existing = new Set(existingCodes.map(normaliseCode))
  const blocker: DeliveryCopyBlocker | null =
    code.length === 0
      ? 'codeRequired'
      : code.length > DELIVERY_CODE_MAX
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

export function deliveryCopyRequest(draft: DeliveryTypeSettings, reasonText: string): DeliveryTypeCopyRequest {
  return { after: { ...draft, documentType: normaliseCode(draft.documentType) }, reason: reasonField(reasonText).reason }
}

// ── refusals ────────────────────────────────────────────────────────────────────────────────────

/** The refused fields of a save error (`SDC-00010` `data.fields`, the document type's shape), by settings key. */
export function deliveryFieldRefusals(err: unknown): Partial<Record<DeliveryTypeField, FieldRefusal>> {
  return settingsRefusals(err) as Partial<Record<DeliveryTypeField, FieldRefusal>>
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

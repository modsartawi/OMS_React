/**
 * The before/after of a save (BackOffice spec 3148 story 15, ticket 3149): the fields whose values differ, in the
 * detail's group order, compared as the server compares them (strings trimmed at both ends, numbers by value).
 * Pure: no React, no `t`.
 */
import { ALL_FIELDS } from './fields'
import type { DocumentTypeField, DocumentTypeSettings } from './types'

export type FieldValue = string | number | boolean

export interface FieldChange {
  field: DocumentTypeField
  before: FieldValue
  after: FieldValue
}

const norm = (v: FieldValue): FieldValue => (typeof v === 'string' ? v.trim() : v)

export function changedFields(before: DocumentTypeSettings, after: DocumentTypeSettings): FieldChange[] {
  return ALL_FIELDS.flatMap(({ field }) => {
    const b = before[field]
    const a = after[field]
    return norm(b) === norm(a) ? [] : [{ field, before: b, after: a }]
  })
}

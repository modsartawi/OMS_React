/**
 * The settings' server-maintained metadata (BackOffice spec 3148 stories 11 + 16, ticket 3150), as pure functions the
 * edit dialog renders: a coded setting is a dropdown of the server's allowed values, and each changed field in the
 * diff says whether it reaches open orders. The ONE source is `GET SdDocTypeConfigWeb/DocumentTypeFields`
 * (`SdDocumentTypeFieldCatalog`) — the screen keeps no copy of the constants. Pure: no React, no `t`.
 */
import type { FieldChange } from './diff'
import type { DocumentTypeField, DocumentTypeFieldMeta, FieldEffect } from './types'

/** The server's column name → the settings key (`CustomerDeterminationType` → `customerDeterminationType`). */
export const wireField = (name: string): string => (name ? name.charAt(0).toLowerCase() + name.slice(1) : name)

export interface FieldMetaView {
  effect: FieldEffect
  options: readonly string[] | null
  notRead: boolean
}

export type FieldMetaIndex = ReadonlyMap<DocumentTypeField, FieldMetaView>

/** The metadata by settings key; empty while it loads or when it failed (the form then falls back to text boxes). */
export function fieldMetaIndex(metas: readonly DocumentTypeFieldMeta[] | undefined | null): FieldMetaIndex {
  const index = new Map<DocumentTypeField, FieldMetaView>()
  for (const m of metas ?? [])
    index.set(wireField(m.field) as DocumentTypeField, {
      effect: m.effect,
      options: m.options ?? null,
      notRead: m.notReadByOrderProcessing === true,
    })
  return index
}

/**
 * A coded field's dropdown options, or null when it is not coded. A value already held that is outside the list (a
 * legacy row) is kept as the last option, so opening the form never changes it behind the consultant's back — the
 * server refuses only a CHANGE to a value outside the list.
 */
export function optionsFor(index: FieldMetaIndex, field: DocumentTypeField, current: unknown): string[] | null {
  const options = index.get(field)?.options
  if (!options) return null
  const value = typeof current === 'string' ? current.trim() : ''
  return options.includes(value) ? [...options] : [...options, value]
}

export interface ChangeLabel {
  field: DocumentTypeField
  /** `effect.OpenOrders` / `effect.NewOrdersOnly`, or null when the metadata is not loaded. */
  effectKey: string | null
  notRead: boolean
}

/** Each changed field's labels in the diff: open orders / new orders only, and "not read by order processing". */
export function changeLabels(changes: readonly FieldChange[], index: FieldMetaIndex): ChangeLabel[] {
  return changes.map(({ field }) => {
    const meta = index.get(field)
    return { field, effectKey: meta ? `effect.${meta.effect}` : null, notRead: meta?.notRead ?? false }
  })
}

/**
 * A coded setting's option label key (BackOffice ticket 3150): `options.<field>.<value>`, blank as `_blank`. Fields
 * whose values are self-explaining codes (category, engine) carry no labels and show the code. Pure: no React, no `t`.
 */
import { wireField } from './field-meta'

/** Fields whose options carry words; the rest show the bare code. */
const LABELLED = new Set([
  'customerDeterminationType',
  'plantDeterminationType',
  'controlType',
  'notifyOnCreation',
  'notifyOnCancellation',
  'createDeliveryImmediately',
])

/** The i18n key of one option's words, or null when the field shows the bare code. Takes either name spelling. */
export function optionLabelKey(field: string, value: string): string | null {
  const key = wireField(field)
  if (!LABELLED.has(key)) return null
  return `options.${key}.${value === '' ? '_blank' : value}`
}

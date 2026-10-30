import {
  DECLARED_FIELD_SCOPES,
  DECLARED_FIELD_TYPES,
  type DeclaredField,
  type DeclaredFieldScope,
} from '@/core/insurance-rules/guard-formula-guide'
import type { FieldScope, RegistryField } from '@/core/insurance-rules/registry'
import { isPlainObject as isObj } from '@/core/util/plain-object'

// The experiment document's `fields` block (oms 681, ADR 0117): the fields its formulas read, `[{ key, scope, type }]`.
// A registry field is picked into it at its formula scope; a scratch field is only a declaration here — it is never
// posted to the registry. Pure.

type Obj = Record<string, unknown>

/** The registry scope a formula reads at: an item field is the line's (`line.field.Key`). Eligibility facts and the
 * computed `line` facts (`idfPriority`) are read by their own paths, not as fields. */
const FORMULA_SCOPE: Partial<Record<FieldScope, DeclaredFieldScope>> = { item: 'line', request: 'request', patient: 'patient' }

/** A key a formula can read after `.field.`: one plain segment, never the reserved word itself. */
const KEY = /^[A-Za-z_][A-Za-z0-9_]*$/

const sameKey = (a: string, b: string) => a.toLowerCase() === b.toLowerCase()

/** The document's `fields` block, leniently: an entry that is not `{ key, scope, type }` of the known words is left out. */
export function docFields(doc: unknown): DeclaredField[] {
  const raw = isObj(doc) ? doc.fields : undefined
  if (!Array.isArray(raw)) return []
  return raw.filter(
    (f): f is DeclaredField =>
      isObj(f) &&
      typeof f.key === 'string' &&
      (DECLARED_FIELD_SCOPES as readonly unknown[]).includes(f.scope) &&
      (DECLARED_FIELD_TYPES as readonly unknown[]).includes(f.type),
  ).map((f) => ({ key: f.key, scope: f.scope, type: f.type }))
}

/** The document with its `fields` block written (its other keys, and their order, kept). */
export const withFields = (doc: Obj, fields: readonly DeclaredField[]): Obj => ({ ...doc, fields: [...fields] })

/** A registry field as a declaration; null when a formula does not read it as a field. */
export function registryDeclaration(f: RegistryField): DeclaredField | null {
  const scope = FORMULA_SCOPE[f.scope]
  return scope ? { key: f.key, scope, type: f.type } : null
}

/** The registry fields the drawer offers: live, read as a field, and not declared yet. */
export const pickableRegistry = (registry: readonly RegistryField[], declared: readonly DeclaredField[]): RegistryField[] =>
  registry.filter((f) => !f.retired && registryDeclaration(f) !== null && !declared.some((d) => sameKey(d.key, f.key)))

export type AddFieldProblem = 'key' | 'duplicate'

/** One more field, its key trimmed; refused when a formula could not read the key, or the block already has it. */
export function addField(fields: readonly DeclaredField[], f: DeclaredField): { ok: true; fields: DeclaredField[] } | { ok: false; problem: AddFieldProblem } {
  const key = f.key.trim()
  if (!KEY.test(key) || key === 'field') return { ok: false, problem: 'key' }
  if (fields.some((d) => sameKey(d.key, key))) return { ok: false, problem: 'duplicate' }
  return { ok: true, fields: [...fields, { key, scope: f.scope, type: f.type }] }
}

export const removeField = (fields: readonly DeclaredField[], key: string): DeclaredField[] => fields.filter((f) => f.key !== key)

/** Per declared field: whether the registry has it (by key) or it is the experiment's own scratch field. */
export const fieldsSource = (fields: readonly DeclaredField[], registry: readonly RegistryField[]): ('registry' | 'scratch')[] =>
  fields.map((f) => (registry.some((r) => sameKey(r.key, f.key)) ? 'registry' : 'scratch'))

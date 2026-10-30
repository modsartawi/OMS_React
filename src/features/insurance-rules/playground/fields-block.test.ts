/**
 * Ticket 681 — the Fields drawer writes the document's `fields` block `[{ key, scope, type }]` (ADR 0117): a registry
 * field picked and a scratch field declared are written once each; a duplicate key is refused; removing one drops it.
 * Scratch fields are only declarations — nothing here talks to the registry.
 */
import { describe, expect, it } from 'vitest'
import type { RegistryField } from '@/core/insurance-rules/registry'
import { addField, docFields, fieldsSource, pickableRegistry, registryDeclaration, removeField, withFields } from './fields-block'

const reg = (key: string, scope: RegistryField['scope'], type: RegistryField['type'], retired = false): RegistryField => ({
  key,
  label: { en: key, ar: key },
  scope,
  type,
  unit: '',
  source: `ItemInfo.${key}`,
  retired,
})

const REGISTRY = [reg('ECode', 'item', 'text'), reg('daysSupply', 'request', 'number'), reg('age', 'patient', 'number'), reg('OldGroup', 'item', 'text', true), reg('coverage.periodEnd', 'eligibility', 'date'), reg('idfPriority', 'line', 'number')]

describe('fieldsBlock', () => {
  it('a registry field is declared at its formula scope (item → line), with its type', () => {
    expect(registryDeclaration(REGISTRY[0])).toEqual({ key: 'ECode', scope: 'line', type: 'text' })
    expect(registryDeclaration(REGISTRY[1])).toEqual({ key: 'daysSupply', scope: 'request', type: 'number' })
    expect(registryDeclaration(REGISTRY[2])).toEqual({ key: 'age', scope: 'patient', type: 'number' })
    // eligibility facts and the computed line facts are not formula fields; a retired field is not offered
    expect(registryDeclaration(REGISTRY[4])).toBeNull()
    expect(registryDeclaration(REGISTRY[5])).toBeNull()
    expect(pickableRegistry(REGISTRY, []).map((f) => f.key)).toEqual(['ECode', 'daysSupply', 'age'])
    expect(pickableRegistry(REGISTRY, [{ key: 'ecode', scope: 'line', type: 'text' }]).map((f) => f.key)).toEqual(['daysSupply', 'age'])
  })

  it('picking a registry field and declaring a scratch one write { key, scope, type } once each', () => {
    let fields = docFields({ schema: 1, fields: [] })
    const a = addField(fields, registryDeclaration(REGISTRY[0])!)
    expect(a.ok).toBe(true)
    fields = a.ok ? a.fields : fields
    const b = addField(fields, { key: 'HouseBrand', scope: 'line', type: 'flag' })
    expect(b.ok).toBe(true)
    fields = b.ok ? b.fields : fields
    expect(fields).toEqual([
      { key: 'ECode', scope: 'line', type: 'text' },
      { key: 'HouseBrand', scope: 'line', type: 'flag' },
    ])
    const doc = withFields({ schema: 1, kind: 'guard', fields: [], rules: [] }, fields)
    expect(doc).toEqual({ schema: 1, kind: 'guard', fields, rules: [] })
    expect(fieldsSource(fields, REGISTRY)).toEqual(['registry', 'scratch'])
  })

  it('a duplicate key is refused — whatever its scope or case, as the registry compares keys', () => {
    const fields = [{ key: 'HouseBrand', scope: 'line', type: 'flag' }] as const
    expect(addField(fields, { key: 'HouseBrand', scope: 'line', type: 'flag' })).toEqual({ ok: false, problem: 'duplicate' })
    expect(addField(fields, { key: 'housebrand', scope: 'patient', type: 'text' })).toEqual({ ok: false, problem: 'duplicate' })
  })

  it('a key a formula could not read is refused: empty, spaced, dotted, or the reserved word', () => {
    for (const key of ['', '  ', 'House Brand', 'a.b', '1st', 'field']) expect(addField([], { key, scope: 'line', type: 'text' })).toMatchObject({ ok: false })
    expect(addField([], { key: '  Trim ', scope: 'line', type: 'text' })).toEqual({ ok: true, fields: [{ key: 'Trim', scope: 'line', type: 'text' }] })
  })

  it('removing one drops it, and only it', () => {
    const fields = [
      { key: 'A', scope: 'line', type: 'text' },
      { key: 'B', scope: 'request', type: 'number' },
    ] as const
    expect(removeField(fields, 'A')).toEqual([{ key: 'B', scope: 'request', type: 'number' }])
    expect(removeField(fields, 'Z')).toEqual(fields)
  })

  it('reads a document’s block leniently: a malformed entry is left out, an absent block is none', () => {
    expect(docFields({})).toEqual([])
    expect(docFields({ fields: 'x' })).toEqual([])
    expect(docFields({ fields: [{ key: 'A', scope: 'line', type: 'text' }, { key: 'B', scope: 'eligibility', type: 'text' }, { key: 3 }, null] })).toEqual([{ key: 'A', scope: 'line', type: 'text' }])
  })
})

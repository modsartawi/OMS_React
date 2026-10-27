/**
 * Ticket 610 — the `insurance-lists` and `insurance-fields` namespaces ship English and Arabic together; each
 * Arabic file mirrors the English keys, an English plural (`_one` / `_other`) being all SIX Arabic forms. And
 * every key the code builds (tabs, modes, problems, log actions, scopes, types) exists in both.
 */
import { describe, expect, it } from 'vitest'
import listsEn from '@/locales/en/insurance-lists.json'
import listsAr from '@/locales/ar/insurance-lists.json'
import fieldsEn from '@/locales/en/insurance-fields.json'
import fieldsAr from '@/locales/ar/insurance-fields.json'
import rulesEn from '@/locales/en/insurance-rules.json'
import rulesAr from '@/locales/ar/insurance-rules.json'
import { hasLocaleKey } from '@/core/test/locale'
import { FIELD_SCOPES, FIELD_TYPES } from '@/core/insurance-rules/registry'

const EN_PLURAL = ['_one', '_other']
const AR_PLURAL = ['_zero', '_one', '_two', '_few', '_many', '_other']

function leaves(node: unknown, prefix = ''): string[] {
  if (typeof node !== 'object' || node === null) return [prefix]
  return Object.entries(node).flatMap(([k, v]) => leaves(v, prefix ? `${prefix}.${k}` : k))
}
const pluralBase = (key: string, forms: string[]) =>
  forms.map((f) => (key.endsWith(f) ? key.slice(0, -f.length) : null)).find((b) => b !== null) ?? null
function shape(keys: string[], forms: string[]) {
  const plain = new Set<string>()
  const plurals = new Map<string, Set<string>>()
  for (const key of keys) {
    const base = pluralBase(key, forms)
    if (base === null) plain.add(key)
    else plurals.set(base, (plurals.get(base) ?? new Set()).add(key.slice(base.length)))
  }
  return { plain, plurals }
}

for (const [ns, en, ar] of [
  ['insurance-lists', listsEn, listsAr],
  ['insurance-fields', fieldsEn, fieldsAr],
] as const) {
  describe(`${ns} — en and ar mirror each other`, () => {
    const e = shape(leaves(en), EN_PLURAL)
    const a = shape(leaves(ar), AR_PLURAL)
    it('the same non-plural keys', () => {
      expect([...a.plain].sort()).toEqual([...e.plain].sort())
    })
    it('the same plural families, English two forms and Arabic six', () => {
      expect([...a.plurals.keys()].sort()).toEqual([...e.plurals.keys()].sort())
      for (const [base, forms] of e.plurals) expect([base, [...forms].sort()]).toEqual([base, [...EN_PLURAL].sort()])
      for (const [base, forms] of a.plurals) expect([base, [...forms].sort()]).toEqual([base, [...AR_PLURAL].sort()])
    })
  })
}

const LIST_KEYS = [
  ...['items', 'patients', 'policies'].map((t) => `tab.${t}`),
  'mode.anyOf',
  'mode.noneOf',
  ...['include', 'exclude', 'articles', 'categories'].map((k) => `def.${k}`),
  ...['include', 'exclude', 'includeHint', 'excludeHint'].map((k) => `editor.${k}`),
  ...['cycle', 'tooDeep', 'unknownList', 'idTaken', 'idInvalid', 'nameMissing', 'emptyAttribute', 'emptyDefinition'].map((k) => `problem.${k}`),
  ...['keyMissing', 'keyInvalid', 'keyListed', 'reasonMissing', 'reasonTooLong', 'expiryInvalid', 'expiryPast'].map((k) => `entryProblem.${k}`),
  ...['added', 'removed', 'expired'].map((k) => `logAction.${k}`),
  ...['patient', 'policy'].flatMap((k) => ['none', 'lede', 'key'].map((x) => `keyed.${k}.${x}`)),
]
const FIELD_KEYS = [
  ...FIELD_SCOPES.map((s) => `scope.${s}`),
  ...FIELD_TYPES.map((s) => `type.${s}`),
  ...['sourceMissing', 'keyMissing', 'keyInvalid', 'keyTaken', 'labelMissing'].map((k) => `problem.${k}`),
]

describe('the keys the code builds exist', () => {
  it.each([listsEn, listsAr])('insurance-lists', (bundle) => {
    for (const key of LIST_KEYS) expect([key, hasLocaleKey(bundle, key)]).toEqual([key, true])
  })
  it.each([fieldsEn, fieldsAr])('insurance-fields', (bundle) => {
    for (const key of FIELD_KEYS) expect([key, hasLocaleKey(bundle, key)]).toEqual([key, true])
  })
  it.each([rulesEn, rulesAr])('the two menu leaves in insurance-rules', (bundle) => {
    for (const key of ['menu.lists', 'menu.fields']) expect([key, hasLocaleKey(bundle, key)]).toEqual([key, true])
  })
})

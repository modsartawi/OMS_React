/**
 * Ticket 790, the Arabic box (owner walk 2026-11-17): every word on the house-rules screen has Arabic.
 *
 * Why nothing caught it before: `copilot` is a PARTIAL Arabic namespace (`core/i18n.ts`), so it never had the
 * en/ar mirror test the full namespaces carry (`release-queue`, `doc-type-config`), and the copilot's own tests
 * read only the English bundle. The screen shipped with no `rules.*` in `ar/copilot.json` at all, and every word
 * fell back to English. The panel's keys outside this screen stay partial, so this test is scoped to the screen:
 *
 * - the subtrees the screen draws (`rules`, its menu leaf `menu`, and the Try answer's `answer`, `ask`, `refusal`,
 *   `trace`, `box`) mirror the
 *   English keys in Arabic, an English plural (`_one` / `_other`) being all six Arabic forms;
 * - every literal key the screen's sources ask for (`t('…')`, `i18nKey="…"`, the gate's `keyPrefix`) has words in
 *   both bundles, so a new key with no Arabic fails here rather than on the owner's walk.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import en from '@/locales/en/copilot.json'
import ar from '@/locales/ar/copilot.json'
import { hasLocaleKey as has, localeAt } from '@/core/test/locale'

/** The screen's own sources: the page, its starters editor, and the answer rendering its Try panel draws. */
const SOURCES = ['CopilotRulesPage.tsx', 'StartersEditor.tsx', 'AnswerParts.tsx'].map((f) => readFileSync(join(__dirname, f), 'utf8'))

/** The subtrees the screen draws, mirrored in full. */
const SUBTREES = ['rules', 'menu', 'answer', 'ask', 'refusal', 'trace', 'box']

const EN_PLURAL = /_(one|other)$/
const AR_FORMS = ['zero', 'one', 'two', 'few', 'many', 'other']

function leaves(node: unknown, prefix = ''): string[] {
  if (typeof node !== 'object' || node === null) return [prefix]
  return Object.entries(node).flatMap(([k, v]) => leaves(v, prefix ? `${prefix}.${k}` : k))
}

/** The keys a bundle answers for a subtree: a plural family counts once, by its base. */
const bases = (bundle: unknown, tree: string) =>
  [...new Set(leaves(localeAt(bundle, tree), tree).map((k) => k.replace(/_(zero|one|two|few|many|other)$/, '')))].sort()

/** A literal key the sources ask for, in either the plain or the plural shape. */
const answered = (bundle: unknown, key: string) => has(bundle, key) || has(bundle, `${key}_other`)

/** Literal keys only: a key built from a value (`` t(`rules.starters.kind.${kind}`) ``) is covered by the mirror. */
function literalKeys(): string[] {
  const keys = new Set<string>()
  for (const src of SOURCES) {
    for (const m of src.matchAll(/\bt\(\s*'([\w.-]+)'/g)) keys.add(m[1])
    for (const m of src.matchAll(/i18nKey="([\w.-]+)"/g)) keys.add(m[1])
    for (const m of src.matchAll(/keyPrefix="([\w.-]+)"/g))
      for (const k of ['checking', 'deniedTitle', 'deniedHint', 'unreachableTitle', 'unreachableHint']) keys.add(`${m[1]}.${k}`)
  }
  return [...keys].sort()
}

describe('copilot rules screen — Arabic mirrors English', () => {
  it.each(SUBTREES)('%s: the same keys, plural forms aside', (tree) => {
    expect(bases(ar, tree)).toEqual(bases(en, tree))
  })

  it.each(SUBTREES)('%s: Arabic carries all six plural forms wherever English counts', (tree) => {
    const counted = leaves(localeAt(en, tree), tree).filter((k) => k.endsWith('_other')).map((k) => k.replace(EN_PLURAL, ''))
    for (const key of counted) for (const form of AR_FORMS) expect([key, form, has(ar, `${key}_${form}`)]).toEqual([key, form, true])
  })

  it('every Arabic string differs from its English one, except machine tags', () => {
    // A copied English string would pass the mirror and still render English under Arabic.
    const same = SUBTREES.flatMap((tree) => leaves(localeAt(en, tree), tree)).filter((k) => has(ar, k) && localeAt(ar, k) === localeAt(en, k))
    expect(same).toEqual(['rules.versionTag'])
  })
})

describe('copilot rules screen — every key its sources ask for has words', () => {
  const keys = literalKeys()

  it('finds the screen keys (the scan is not empty)', () => {
    expect(keys).toEqual(expect.arrayContaining(['rules.title', 'rules.editor.charCount', 'rules.history.revertedFrom', 'rules.conflict.title', 'box.tooLong']))
  })

  it.each([
    ['en', en],
    ['ar', ar],
  ] as const)('%s', (_, bundle) => {
    const missing = keys.filter((k) => !answered(bundle, k))
    expect(missing).toEqual([])
  })

  it('the version line has all four shapes in both bundles', () => {
    for (const shape of ['full', 'by', 'at', 'bare'])
      for (const bundle of [en, ar]) expect([shape, has(bundle, `rules.editor.versionLine.${shape}`)]).toEqual([shape, true])
  })
})

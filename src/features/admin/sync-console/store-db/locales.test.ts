import { describe, expect, it } from 'vitest'
import en from '@/locales/en/sync-console.json'
import ar from '@/locales/ar/sync-console.json'

/**
 * Arabic beside English for the Store database tab (oms 915–919): every key under `storeDb` is in both bundles, with
 * the same `{{slots}}` and `<tags>`. One walk over the whole subtree, so every later panel's keys are covered too.
 */
const at = (bundle: unknown, key: string): unknown =>
  key.split('.').reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], bundle)

const keys = (bundle: unknown, prefix: string): string[] =>
  Object.entries((bundle ?? {}) as Record<string, unknown>).flatMap(([k, v]) =>
    typeof v === 'object' && v !== null ? keys(v, `${prefix}${k}.`) : [`${prefix}${k}`],
  )

const slots = (text: unknown) => [...String(text).matchAll(/<(\w+)>|\{\{(\w+)\}\}/g)].map((m) => m[1] ?? m[2]).sort()

describe('the Store database words', () => {
  const enKeys = [...keys(at(en, 'storeDb'), 'storeDb.'), 'nav.database']

  it('has every key in English and in Arabic', () => {
    expect(enKeys.length).toBeGreaterThan(20)
    expect([...keys(at(ar, 'storeDb'), 'storeDb.'), 'nav.database'].sort()).toEqual([...enKeys].sort())
    for (const key of enKeys) {
      expect(at(en, key), `en ${key}`).toBeTruthy()
      expect(at(ar, key), `ar ${key}`).toBeTruthy()
    }
  })

  it('keeps the same slots in both languages', () => {
    for (const key of enKeys) expect(slots(at(ar, key)), key).toEqual(slots(at(en, key)))
  })

  it('names every state and engine the door is known to send', () => {
    for (const s of ['Ok', 'Watch', 'Critical', 'DiskLow', 'NotChecked']) expect(at(en, `storeDb.states.${s}`), s).toBeTruthy()
    const engines = (en as { storeDb?: { engines?: Record<string, string> } }).storeDb?.engines ?? {}
    expect(Object.keys(engines).sort()).toEqual(['2008', '2008 R2', '2019', 'other'])
  })
})

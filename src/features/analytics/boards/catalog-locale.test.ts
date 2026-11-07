import { describe, expect, it } from 'vitest'
import en from '@/locales/en/boards.json'
import ar from '@/locales/ar/boards.json'

/** Every leaf key under an object, dotted. */
const leaves = (o: unknown, at = ''): string[] =>
  o && typeof o === 'object' ? Object.entries(o).flatMap(([k, v]) => leaves(v, at ? `${at}.${k}` : k)) : [at]
const valueAt = (o: unknown, path: string): unknown => path.split('.').reduce<unknown>((x, k) => (x && typeof x === 'object' ? (x as Record<string, unknown>)[k] : undefined), o)

describe('catalog words', () => {
  it('every catalog sentence is in both languages', () => {
    const enKeys = leaves(en.catalog).sort()
    expect(leaves(ar.catalog).sort()).toEqual(enKeys)
    for (const k of enKeys) {
      expect(String(valueAt(en.catalog, k)), `en catalog.${k}`).not.toBe('')
      expect(String(valueAt(ar.catalog, k)), `ar catalog.${k}`).not.toBe('')
    }
  })

  it('every unit, shape and mart kind the wire can send has a name', () => {
    for (const u of ['count', 'SAR', 'minutes', 'seconds', 'km', 'share']) expect(valueAt(ar.catalog, `unit.${u}`), u).toBeTruthy()
    for (const s of ['additive', 'rate', 'percentile']) expect(valueAt(ar.catalog, `shape.${s}`), s).toBeTruthy()
    for (const m of ['mart', 'fact', 'dim']) expect(valueAt(ar.catalog, `martKind.${m}`), m).toBeTruthy()
  })
})

/**
 * oms 951 (BackOffice spec 4182): the help's chrome ships in English and Arabic together — the Arabic mirrors the
 * English keys exactly, no value is empty, every key the page builds from data (an access level, an area) exists in
 * both, and the menu leaf `boards:menu.help` has its words in both `boards` bundles.
 */
import { describe, expect, it } from 'vitest'
import en from '@/locales/en/help.json'
import ar from '@/locales/ar/help.json'
import boards from '@/locales/en/boards.json'
import boardsAr from '@/locales/ar/boards.json'
import { HELP_ACCESS } from '@/core/models/help'
import { hasLocaleKey, localeAt } from '@/core/test/locale'

const leaves = (node: unknown, prefix = ''): string[] =>
  typeof node !== 'object' || node === null ? [prefix] : Object.entries(node).flatMap(([k, v]) => leaves(v, prefix ? `${prefix}.${k}` : k))

describe('help — en and ar', () => {
  it('mirror each other, and no value is empty', () => {
    expect(leaves(ar).sort()).toEqual(leaves(en).sort())
    for (const bundle of [en, ar]) for (const key of leaves(bundle)) expect([key, localeAt(bundle, key)]).not.toEqual([key, ''])
  })

  it.each([en, ar])('hold every key the page builds', (locale) => {
    const keys = [...HELP_ACCESS.map((a) => `access.${a}`), 'areas.analytics.title', 'areas.analytics.subtitle', 'areas.analytics.guide', 'print.languages.en', 'print.languages.ar']
    for (const key of keys) expect([key, hasLocaleKey(locale, key)]).toEqual([key, true])
  })

  it('the menu leaf has its label in both boards bundles', () => {
    expect([hasLocaleKey(boards, 'menu.help'), hasLocaleKey(boardsAr, 'menu.help')]).toEqual([true, true])
  })
})

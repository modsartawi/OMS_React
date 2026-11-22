/**
 * oms 946 — `command-center` ships English and Arabic together (the page switches between them, spec 4165 story 7): the
 * Arabic mirrors the English keys exactly, and every key the page builds from data (a section, a run state, a language)
 * and both gate sentences exist in both.
 */
import { describe, expect, it } from 'vitest'
import en from '@/locales/en/command-center.json'
import ar from '@/locales/ar/command-center.json'
import { CC_LANGS, CC_RUN_STATES, CC_SECTION_KEYS } from '@/core/models/command-center'
import { hasLocaleKey } from '@/core/test/locale'

const leaves = (node: unknown, prefix = ''): string[] =>
  typeof node !== 'object' || node === null ? [prefix] : Object.entries(node).flatMap(([k, v]) => leaves(v, prefix ? `${prefix}.${k}` : k))

describe('command-center — en and ar', () => {
  it('mirror each other', () => {
    expect(leaves(ar).sort()).toEqual(leaves(en).sort())
  })

  it.each([en, ar])('hold every key the page builds', (locale) => {
    const gate = ['checking', 'deniedTitle', 'deniedHint', 'unreachableTitle', 'unreachableHint']
    const keys = [
      ...CC_SECTION_KEYS.map((k) => `brief.section.${k}`),
      ...CC_RUN_STATES.map((s) => `status.state.${s}`),
      ...CC_LANGS.map((l) => `lang.${l}`),
      ...gate.map((g) => `access.${g}`),
      ...gate.map((g) => `offer.${g}`),
      'menu.commandCenter',
    ]
    for (const key of keys) expect([key, hasLocaleKey(locale, key)]).toEqual([key, true])
  })

  it('the Arabic is Arabic, not English left in place', () => {
    expect(ar.brief.notAvailable).toMatch(/[؀-ۿ]/)
    expect(ar.brief.more).toMatch(/[؀-ۿ]/)
    expect(ar.title).toMatch(/[؀-ۿ]/)
  })
})

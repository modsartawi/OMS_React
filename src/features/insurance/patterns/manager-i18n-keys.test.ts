/**
 * Oms 924 — every key the manager's screens BUILD has words in English and Arabic: a threshold's name and help, each
 * problem a value or a block form can have, each kind of finding, both gates' sentences, the nav leaves and the log's
 * plural. (922's `./i18n-keys.test.ts` holds the whole `insurance-patterns` namespace to mirror itself in both
 * languages, six Arabic plural forms included.)
 */
import { describe, expect, it } from 'vitest'
import en from '@/locales/en/insurance-patterns.json'
import ar from '@/locales/ar/insurance-patterns.json'
import { hasLocaleKey } from '@/core/test/locale'
import { BLOCK_REASON_KINDS, type BlockProblem } from './block'
import { SETTING_NAMES, type SettingProblem } from './settings'

const GATE = ['checking', 'deniedTitle', 'deniedHint', 'unreachableTitle', 'unreachableHint']
const SETTING_PROBLEMS: SettingProblem[] = ['missing', 'notNumber', 'notWhole', 'outOfRange']
const BLOCK_PROBLEMS: BlockProblem[] = ['reasonKind', 'payerTooLong', 'startInvalid', 'endInvalid', 'endPast', 'startAfterEnd']

describe.each([
  ['en', en],
  ['ar', ar],
])('%s: the manager’s screens', (_lang, locale) => {
  it('the two nav leaves and both gates’ five sentences', () => {
    const keys = ['menu.settings', 'menu.reveals', ...GATE.map((k) => `settings.access.${k}`), ...GATE.map((k) => `revealLog.access.${k}`)]
    for (const key of keys) expect([key, hasLocaleKey(locale, key)]).toEqual([key, true])
  })

  it('each threshold’s name and help, and each problem a value can have', () => {
    const keys = [
      ...SETTING_NAMES.flatMap((n) => [`settings.name.${n}`, `settings.help.${n}`]),
      ...SETTING_PROBLEMS.map((p) => `settings.problem.${p}`),
      'settings.nextRun',
    ]
    for (const key of keys) expect([key, hasLocaleKey(locale, key)]).toEqual([key, true])
  })

  it('each kind of finding and each problem a block form can have', () => {
    const keys = [...BLOCK_REASON_KINDS.map((k) => `block.kind.${k}`), ...BLOCK_PROBLEMS.map((p) => `block.problem.${p}`)]
    for (const key of keys) expect([key, hasLocaleKey(locale, key)]).toEqual([key, true])
  })

  it('the plural the reveal log counts with', () => {
    expect(hasLocaleKey(locale, 'revealLog.count_other')).toBe(true)
  })

  it('a block the grant filter refused, in words that name its grants (review 3)', () => {
    expect(hasLocaleKey(locale, 'block.failure.denied')).toBe(true)
  })
})

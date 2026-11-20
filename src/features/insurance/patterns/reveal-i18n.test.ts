/**
 * Oms 923 — every word the reveal dialog names exists in English and Arabic (ticket 923: "EN and AR copy saying the
 * reveal is logged"). The keys are read off the dialog's source, so a key typed wrong there fails here rather than
 * rendering raw on an investigator's screen. The two bundles mirror each other key for key (`./i18n-keys.test.ts`).
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import en from '@/locales/en/insurance-patterns.json'
import ar from '@/locales/ar/insurance-patterns.json'
import { hasLocaleKey, localeAt } from '@/core/test/locale'

const dialog = readFileSync(new URL('./RevealPatient.tsx', import.meta.url), 'utf8')
const named = [...new Set([...dialog.matchAll(/'(reveal\.[\w.]+)'/g)].map((m) => m[1]))].sort()

describe('the reveal dialog’s words', () => {
  it('names its keys under reveal.* (the scan sees them)', () => {
    expect(named).toEqual(expect.arrayContaining(['reveal.open', 'reveal.logged', 'reveal.problem.short', 'reveal.failure.denied', 'reveal.patientKey', 'reveal.memberId']))
  })

  it.each([
    ['en', en],
    ['ar', ar],
  ])('%s: has every one of them', (_lang, locale) => {
    expect(named.filter((key) => !hasLocaleKey(locale, key))).toEqual([])
  })

  it('both say the reveal is logged, before the reason is asked', () => {
    expect(localeAt(en, 'reveal.logged')).toMatch(/^Each reveal is logged/)
    expect(localeAt(ar, 'reveal.logged')).toMatch(/^يسجل كل كشف/)
  })
})

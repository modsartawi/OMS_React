import { describe, expect, it } from 'vitest'
import en from '@/locales/en/hybris-stock-stores.json'
import ar from '@/locales/ar/hybris-stock-stores.json'
import { modeBanner, modeReading } from './mode'

const at = (locale: unknown, key: string) =>
  key.split('.').reduce<unknown>((n, part) => (n as Record<string, unknown> | undefined)?.[part], locale)

describe('modeBanner', () => {
  it.each(['off', 'shadow', 'live'] as const)('reads %s as itself', (mode) => {
    expect(modeReading({ mode })).toBe(mode)
    expect(modeBanner({ mode })).toMatchObject({ reading: mode, titleKey: `mode.${mode}.title`, bodyKey: `mode.${mode}.body` })
  })

  it.each([null, undefined, { mode: 'LIVE' }, { mode: 'hot' }, { mode: '' }])('never claims live on %j', (s) => {
    expect(modeBanner(s as never).reading).toBe('unknown')
  })

  it('shadow is a warning, live is go', () => {
    expect(modeBanner({ mode: 'shadow' }).sev).toBe('warn')
    expect(modeBanner({ mode: 'live' }).sev).toBe('go')
  })

  it('the shadow banner says Hybris does not import its files, in both languages', () => {
    expect(String(at(en, 'mode.shadow.body'))).toMatch(/not import/i)
    expect(String(at(ar, 'mode.shadow.body'))).toMatch(/لا/)
  })

  it.each([en, ar])('every reading has a title and a body', (locale) => {
    for (const r of ['off', 'shadow', 'live', 'unknown']) {
      expect(typeof at(locale, `mode.${r}.title`)).toBe('string')
      expect(typeof at(locale, `mode.${r}.body`)).toBe('string')
    }
  })

  it('the live body says delivered to the hot folder, never live on the website', () => {
    expect(String(at(en, 'mode.live.body'))).toMatch(/hot folder/i)
    expect(String(at(en, 'mode.live.body'))).not.toMatch(/live on the website/i)
  })
})

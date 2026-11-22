/**
 * oms 946 (BackOffice spec 4165): the command center's links as strings, built in core so the copilot (950) and the
 * shared finding card link a pharmacy or a category without importing the feature. Every link keeps the language.
 */
import { describe, expect, it } from 'vitest'
import { COMMAND_CENTER_PATH, categoryProfileHref, homeHref, storeProfileHref, targetHref } from './command-center-routes'

describe('the command center routes', () => {
  it('the home, with a pharmacy scorecard open and the language kept', () => {
    expect(COMMAND_CENTER_PATH).toBe('/analytics/command-center')
    expect(homeHref()).toBe('/analytics/command-center')
    expect(homeHref({ lang: 'ar' })).toBe('/analytics/command-center?lang=ar')
    expect(homeHref({ store: 'P166', lang: 'en' })).toBe('/analytics/command-center?store=P166&lang=en')
  })

  it('a store profile, with its period and language; a code is escaped', () => {
    expect(storeProfileHref('P166')).toBe('/analytics/command-center/store/P166')
    expect(storeProfileHref('P166', { period: 'ytd', lang: 'ar' })).toBe('/analytics/command-center/store/P166?period=ytd&lang=ar')
    expect(storeProfileHref('P 1/6', { period: 'dates', from: '2026-10-01', to: '2026-10-31' })).toBe(
      '/analytics/command-center/store/P%201%2F6?period=dates&from=2026-10-01&to=2026-10-31',
    )
  })

  it('a category profile at either depth, narrowed to the chain, a region or a pharmacy', () => {
    expect(categoryProfileHref({ level: 'top', code: 'C01' })).toBe('/analytics/command-center/category/top/C01')
    expect(categoryProfileHref({ level: 'second', code: 'C01-02', scope: { kind: 'chain' }, lang: 'ar' })).toBe(
      '/analytics/command-center/category/second/C01-02?lang=ar',
    )
    expect(categoryProfileHref({ level: 'top', code: 'C01', scope: { kind: 'region', region: 'WEST' } })).toBe(
      '/analytics/command-center/category/top/C01?scope=region&region=WEST',
    )
    expect(categoryProfileHref({ level: 'top', code: 'C01', scope: { kind: 'store', storeCode: 'P166' }, lang: 'en' })).toBe(
      '/analytics/command-center/category/top/C01?scope=store&store=P166&lang=en',
    )
  })

  it('a link target: on the home a pharmacy opens its scorecard, elsewhere its profile; a category opens its profile', () => {
    const store = { kind: 'store', storeCode: 'P166' } as const
    expect(targetHref(store, { lang: 'ar', store: 'scorecard' })).toBe('/analytics/command-center?store=P166&lang=ar')
    expect(targetHref(store, { lang: 'ar', store: 'profile' })).toBe('/analytics/command-center/store/P166?lang=ar')
    const category = { kind: 'category', level: 'top', code: 'C01', scope: { kind: 'store', storeCode: 'P166' } } as const
    expect(targetHref(category, { lang: 'en', store: 'scorecard' })).toBe(
      '/analytics/command-center/category/top/C01?scope=store&store=P166&lang=en',
    )
  })
})

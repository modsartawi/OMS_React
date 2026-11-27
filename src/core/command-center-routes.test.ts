/**
 * oms 946 (BackOffice spec 4165): the command center's links as strings, built in core so the copilot (950) and the
 * shared finding card link a pharmacy or a category without importing the feature. Every link keeps the language.
 */
import { describe, expect, it } from 'vitest'
import {
  CATEGORY_PROFILE_PATTERN,
  CC_ROUTES,
  COMMAND_CENTER_PATH,
  STORE_PROFILE_PATTERN,
  categoryProfileHref,
  dirOf,
  homeHref,
  langOf,
  periodOf,
  scopeOf,
  storeProfileHref,
  targetHref,
  withPeriod,
  withScope,
} from './command-center-routes'

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

  it('the router registers the very patterns the links are built for', () => {
    expect(STORE_PROFILE_PATTERN).toBe('/analytics/command-center/store/:storeCode')
    expect(CATEGORY_PROFILE_PATTERN).toBe('/analytics/command-center/category/:level/:code')
    expect(CC_ROUTES).toEqual({
      home: 'analytics/command-center',
      storeProfile: 'analytics/command-center/store/:storeCode',
      categoryProfile: 'analytics/command-center/category/:level/:code',
    })
  })

  it('the home keeps the map filter when a pharmacy opens (all issues names nothing)', () => {
    expect(homeHref({ store: 'P166', lang: 'en', filter: 'sales' })).toBe('/analytics/command-center?filter=sales&store=P166&lang=en')
    expect(homeHref({ store: 'P166', filter: 'all' })).toBe('/analytics/command-center?store=P166')
    const store = { kind: 'store', storeCode: 'P166' } as const
    expect(targetHref(store, { lang: 'ar', store: 'scorecard', filter: 'stock' })).toBe('/analytics/command-center?filter=stock&store=P166&lang=ar')
  })

  it('a profile link carries the period, and a category with no narrowing of its own takes the default one', () => {
    const store = { kind: 'store', storeCode: 'P412' } as const
    const category = { kind: 'category', level: 'top', code: 'C07' } as const
    const dates = { period: 'dates', from: '2026-10-01', to: '2026-10-14' } as const
    expect(targetHref(store, { lang: 'en', store: 'profile', period: dates })).toBe(
      '/analytics/command-center/store/P412?period=dates&from=2026-10-01&to=2026-10-14&lang=en',
    )
    expect(targetHref(category, { lang: 'en', store: 'profile', period: { period: 'ytd' }, scope: { kind: 'store', storeCode: 'P166' } })).toBe(
      '/analytics/command-center/category/top/C07?scope=store&store=P166&period=ytd&lang=en',
    )
    // The server's own narrowing wins over the default.
    const narrowed = { ...category, scope: { kind: 'region', region: 'WEST' } } as const
    expect(targetHref(narrowed, { store: 'profile', scope: { kind: 'store', storeCode: 'P166' } })).toBe(
      '/analytics/command-center/category/top/C07?scope=region&region=WEST',
    )
    // The rolling 4 weeks are the default and name nothing; the home's scorecard takes no period.
    expect(targetHref(store, { store: 'profile', period: { period: 'rolling4' } })).toBe('/analytics/command-center/store/P412')
    expect(targetHref(store, { store: 'scorecard', period: { period: 'ytd' } })).toBe('/analytics/command-center?store=P412')
  })

  it('a category profile carries dates with both ends', () => {
    expect(categoryProfileHref({ level: 'top', code: 'C07', period: 'dates', from: '2026-10-01', to: '2026-10-14', lang: 'en' })).toBe(
      '/analytics/command-center/category/top/C07?period=dates&from=2026-10-01&to=2026-10-14&lang=en',
    )
  })

  it('the URL is read back the way it is written: the narrowing and the period', () => {
    expect(scopeOf(new URLSearchParams('scope=region&region=WEST'))).toEqual({ kind: 'region', region: 'WEST' })
    expect(scopeOf(new URLSearchParams('scope=store&store=P166'))).toEqual({ kind: 'store', storeCode: 'P166' })
    expect(scopeOf(new URLSearchParams('scope=store'))).toEqual({ kind: 'chain' })
    expect(periodOf(new URLSearchParams('period=ytd'))).toEqual({ period: 'ytd' })
    expect(periodOf(new URLSearchParams('period=dates&from=2026-10-01&to=2026-10-14'))).toEqual({ period: 'dates', from: '2026-10-01', to: '2026-10-14' })
    // Dates missing an end, an unknown kind or none: no period named.
    expect(periodOf(new URLSearchParams('period=dates&from=2026-10-01'))).toBeNull()
    expect(periodOf(new URLSearchParams('period=week'))).toBeNull()
    expect(periodOf(new URLSearchParams(''))).toBeNull()
    expect(withScope(new URLSearchParams('lang=ar&period=ytd'), { kind: 'region', region: 'WEST' }).toString()).toBe('lang=ar&period=ytd&scope=region&region=WEST')
    expect(withPeriod(new URLSearchParams('lang=ar&scope=store&store=P1'), { period: 'dates', from: '2026-10-01', to: '2026-10-14' }).toString()).toBe(
      'lang=ar&scope=store&store=P1&period=dates&from=2026-10-01&to=2026-10-14',
    )
  })

  it('the language: anything but ar is English; Arabic is right to left', () => {
    expect(langOf('ar')).toBe('ar')
    expect(langOf('fr')).toBe('en')
    expect(langOf(null)).toBe('en')
    expect(dirOf('ar')).toBe('rtl')
    expect(dirOf('en')).toBe('ltr')
  })
})

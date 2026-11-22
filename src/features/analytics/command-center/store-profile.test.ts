/**
 * oms 948 (BackOffice spec 4165): the store profile — one pharmacy for a period, its sections as the server sends them,
 * and its workbook. BO 4177 is unbuilt: the answer is the fixture's, seeded in the query cache (static render) or handed
 * back by the stubbed `@/core/api`.
 */
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter, Route, Routes } from 'react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, expect, it, vi } from 'vitest'
import '@/core/i18n'
import { storeProfileHref } from '@/core/command-center-routes'
import { PERMISSIONS_KEY, type PermissionsAnswer } from '@/core/permissions'
import type { CcStoreProfile } from '@/core/models/command-center'
import StoreProfilePage from './StoreProfilePage'
import { STORE_PROFILE_PATTERN, storeRequestOf, withPeriod, type StoreProfileRequest } from './store-profile'
import { storeExportName, storeProfileApi, storeProfileQuery } from './store-profile-api'
import { storeFixture } from './__fixtures__/store'

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), blob: vi.fn() }))
vi.mock('@/core/api', async (actual) => ({ ...(await actual<typeof import('@/core/api')>()), api }))

const answer = (screens = ['Analytics:03']): PermissionsAnswer => ({
  screens,
  extras: { fileServerReady: false, notificationCenterOn: false, commandCenterOn: true, nphiesContractVersion: '1.3', canManageRoles: false, canManageUsers: false },
  version: 'v',
})

/** The page at `url`, its route matched as the router matches it, with the answers seeded for the requests named. */
const drawPage = (url: string, answers: [StoreProfileRequest, CcStoreProfile][]) => {
  const client = new QueryClient()
  client.setQueryData(PERMISSIONS_KEY, answer())
  for (const [request, profile] of answers) client.setQueryData(storeProfileQuery(request).queryKey, profile)
  return renderToStaticMarkup(
    createElement(
      QueryClientProvider,
      { client },
      createElement(
        MemoryRouter,
        { initialEntries: [url] },
        createElement(Routes, null, createElement(Route, { path: STORE_PROFILE_PATTERN, element: createElement(StoreProfilePage) })),
      ),
    ),
  )
}

const rolling4: StoreProfileRequest = { storeCode: 'P166', period: 'rolling4', lang: 'en' }

describe('the store profile', () => {
  it('opens on the rolling 4 weeks, and a period change asks the server again', async () => {
    // The scorecard panel's "Open the store profile" link lands on this page's route.
    expect(STORE_PROFILE_PATTERN).toBe('/analytics/command-center/store/:storeCode')
    expect(storeProfileHref('P166', { lang: 'en' })).toBe('/analytics/command-center/store/P166?lang=en')

    // A URL naming no period opens on the rolling 4 weeks; the server is asked for them by name.
    expect(storeRequestOf({ storeCode: 'P166' }, new URLSearchParams('lang=en'))).toEqual(rolling4)
    api.get.mockClear()
    api.get.mockResolvedValueOnce(storeFixture())
    await storeProfileQuery(rolling4).queryFn()
    expect(api.get).toHaveBeenCalledWith('CommandCenter/StoreProfile', { storeCode: 'P166', period: 'rolling4', lang: 'en' })

    // The page names the period and last year beside it, with the rolling 4 weeks' figures.
    const html = drawPage('/analytics/command-center/store/P166', [[rolling4, storeFixture()]])
    expect(html).toContain('P166 · Jeddah')
    expect(html).toContain('Last 4 weeks, with the same weeks last year')
    expect(html).toContain('2026-10-25 – 2026-11-21')
    expect(html).toContain('2025-10-26 – 2025-11-22')
    expect(html).toContain('SAR 412,000')
    expect(html).toMatch(/data-cc-period="rolling4"[^>]*aria-pressed="true"|aria-pressed="true"[^>]*data-cc-period="rolling4"/)

    // Choosing year-to-date moves the URL to it, keeping the language; dates carry their two ends.
    expect(withPeriod(new URLSearchParams('lang=ar'), { period: 'ytd' }).toString()).toBe('lang=ar&period=ytd')
    expect(withPeriod(new URLSearchParams('lang=ar&period=ytd'), { period: 'dates', from: '2026-10-01', to: '2026-10-14' }).toString()).toBe(
      'lang=ar&period=dates&from=2026-10-01&to=2026-10-14',
    )
    expect(withPeriod(new URLSearchParams('period=dates&from=2026-10-01&to=2026-10-14&lang=en'), { period: 'rolling4' }).toString()).toBe('lang=en')

    // That URL is a new request: the server is asked again, for that period.
    const ytd = storeRequestOf({ storeCode: 'P166' }, new URLSearchParams('lang=en&period=ytd'))
    const dates = storeRequestOf({ storeCode: 'P166' }, new URLSearchParams('lang=en&period=dates&from=2026-10-01&to=2026-10-14'))
    api.get.mockClear()
    api.get.mockResolvedValue(storeFixture({ period: 'ytd' }))
    await storeProfileQuery(ytd).queryFn()
    await storeProfileQuery(dates).queryFn()
    expect(api.get.mock.calls).toEqual([
      ['CommandCenter/StoreProfile', { storeCode: 'P166', period: 'ytd', lang: 'en' }],
      ['CommandCenter/StoreProfile', { storeCode: 'P166', period: 'dates', from: '2026-10-01', to: '2026-10-14', lang: 'en' }],
    ])
    // Each period is its own answer in the cache, never the rolling 4 weeks' standing in.
    expect(storeProfileQuery(ytd).queryKey).not.toEqual(storeProfileQuery(rolling4).queryKey)
    expect(storeProfileQuery(dates).queryKey).not.toEqual(storeProfileQuery(ytd).queryKey)

    // Dates missing an end are not a period yet: the page stays on the rolling 4 weeks.
    expect(storeRequestOf({ storeCode: 'P166' }, new URLSearchParams('period=dates&from=2026-10-01')).period).toBe('rolling4')

    const ytdHtml = drawPage('/analytics/command-center/store/P166?period=ytd', [[{ ...rolling4, period: 'ytd' }, storeFixture({ period: 'ytd' })]])
    expect(ytdHtml).toContain('data-cc-period-shown="ytd"')
    expect(ytdHtml).toContain('SAR 4.9 m')
    expect(ytdHtml).not.toContain('SAR 412,000')
  })

  it('a not-available-yet section shows its reason', () => {
    const html = drawPage('/analytics/command-center/store/P166', [[rolling4, storeFixture()]])
    const privateLabel = sectionOf(html, 'mixPrivateLabel')
    expect(privateLabel).toContain('data-cc-state="not-available-yet"')
    expect(privateLabel).toContain('Mix by private label')
    expect(privateLabel).toContain('Not available yet')
    expect(privateLabel).toContain('The item dimension does not carry the private label flag yet.')
    // No figure: a missing section draws no table.
    expect(privateLabel).not.toContain('<table')
    // The sections the warehouse fills are drawn, with every money figure labelled as including VAT.
    for (const key of ['headline', 'mixCategory', 'products']) {
      expect(sectionOf(html, key)).toContain('data-cc-state="ok"')
      expect(sectionOf(html, key)).toContain('Money figures include VAT.')
    }
    // Observations are the stored findings as sentences.
    expect(sectionOf(html, 'observations')).toContain('Insurance is a far larger share of sales here than at its peers.')

    // In Arabic: right to left, the page's words in Arabic, the server's reason as it wrote it.
    const ar = drawPage('/analytics/command-center/store/P166?lang=ar', [[{ ...rolling4, lang: 'ar' }, storeFixture({ lang: 'ar' })]])
    expect(ar).toMatch(/^<div dir="rtl" lang="ar"/)
    expect(sectionOf(ar, 'mixPrivateLabel')).toContain('غير متاح بعد')
    expect(sectionOf(ar, 'mixPrivateLabel')).toContain('بُعد الأصناف لا يحمل علامة العلامة الخاصة بعد.')
    expect(ar).not.toContain('Not available yet')
    expect(ar).toContain('آخر 4 أسابيع')
  })

  it('the category mix links to the category profile filtered to the pharmacy', () => {
    const html = drawPage('/analytics/command-center/store/P166', [[rolling4, storeFixture()]])
    const mix = sectionOf(html, 'mixCategory')
    // The category profile (949) narrowed to this pharmacy, in the page language; the name isolated as free text.
    expect(mix).toMatch(
      /<a [^>]*data-cc-target="category" href="\/analytics\/command-center\/category\/top\/C07\?scope=store&amp;store=P166&amp;lang=en"[^>]*><bdi>Skin care<\/bdi><\/a>/,
    )
    expect(mix).toContain('href="/analytics/command-center/category/top/C09?scope=store&amp;store=P166&amp;lang=en"')
    // Never the chain's profile.
    expect(mix).not.toContain('href="/analytics/command-center/category/top/C07?lang=en"')
    // The link keeps the page language.
    const ar = drawPage('/analytics/command-center/store/P166?lang=ar', [[{ ...rolling4, lang: 'ar' }, storeFixture({ lang: 'ar' })]])
    expect(sectionOf(ar, 'mixCategory')).toContain('href="/analytics/command-center/category/top/C07?scope=store&amp;store=P166&amp;lang=ar"')
  })

  it('Export asks for the same pharmacy and period', async () => {
    const request = storeRequestOf({ storeCode: 'P166' }, new URLSearchParams('lang=ar&period=dates&from=2026-10-01&to=2026-10-14'))
    api.get.mockClear()
    api.get.mockResolvedValueOnce(storeFixture({ lang: 'ar', period: 'dates' }))
    api.blob.mockResolvedValueOnce({ blob: new Blob(['x']), filename: 'store.xlsx' })
    await storeProfileQuery(request).queryFn()
    await expect(storeProfileApi.export(request)).resolves.toMatchObject({ filename: 'store.xlsx' })
    const asked = { storeCode: 'P166', period: 'dates', from: '2026-10-01', to: '2026-10-14', lang: 'ar' }
    expect(api.get).toHaveBeenCalledWith('CommandCenter/StoreProfile', asked)
    expect(api.blob).toHaveBeenCalledWith('CommandCenter/StoreProfile/Export', asked)
    // A file with no name from the server is named for the pharmacy and the period.
    expect(storeExportName(request)).toBe('store-profile_P166_2026-10-01_2026-10-14.xlsx')
    expect(storeExportName(rolling4)).toBe('store-profile_P166_rolling4.xlsx')
    // The page offers it beside the period.
    const html = drawPage('/analytics/command-center/store/P166', [[rolling4, storeFixture()]])
    expect(html).toMatch(/<button[^>]*data-cc-export[^>]*>.*Export<\/button>/)
  })
})

/** The markup of one profile section, from its opening tag to the next section's. */
const sectionOf = (html: string, key: string): string => {
  const at = html.indexOf(`data-cc-profile-section="${key}"`)
  expect(at, key).toBeGreaterThan(-1)
  const next = html.indexOf('data-cc-profile-section="', at + 1)
  return html.slice(at, next === -1 ? undefined : next)
}

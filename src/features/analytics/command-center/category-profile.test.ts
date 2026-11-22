/**
 * oms 949 (BackOffice spec 4165): the category profile — opened at two depths, narrowed to the chain, a region or one
 * pharmacy, its sections as the server sends them, and its workbook. BO 4178 is unbuilt: the answer is the fixture's,
 * seeded in the query cache (static render) or handed back by the stubbed `@/core/api`.
 */
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter, Route, Routes } from 'react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, expect, it, vi } from 'vitest'
import '@/core/i18n'
import { PERMISSIONS_KEY, type PermissionsAnswer } from '@/core/permissions'
import type { CcCategoryProfile } from '@/core/models/command-center'
import CategoryProfilePage from './CategoryProfilePage'
import { CATEGORY_PROFILE_PATTERN, categoryRequestOf, withScope, type CategoryProfileRequest } from './category-profile'
import { categoryProfileApi, categoryProfileQuery } from './category-profile-api'
import { categoryFixture } from './__fixtures__/category'

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), blob: vi.fn() }))
vi.mock('@/core/api', async (actual) => ({ ...(await actual<typeof import('@/core/api')>()), api }))

const answer = (screens = ['Analytics:03']): PermissionsAnswer => ({
  screens,
  extras: { fileServerReady: false, notificationCenterOn: false, commandCenterOn: true, nphiesContractVersion: '1.3', canManageRoles: false, canManageUsers: false },
  version: 'v',
})

/** The page at `url`, its route matched as the router matches it, with the answers seeded for the requests named. */
const drawPage = (url: string, answers: [CategoryProfileRequest, CcCategoryProfile][]) => {
  const client = new QueryClient()
  client.setQueryData(PERMISSIONS_KEY, answer())
  for (const [request, profile] of answers) client.setQueryData(categoryProfileQuery(request).queryKey, profile)
  return renderToStaticMarkup(
    createElement(
      QueryClientProvider,
      { client },
      createElement(
        MemoryRouter,
        { initialEntries: [url] },
        createElement(Routes, null, createElement(Route, { path: CATEGORY_PROFILE_PATTERN, element: createElement(CategoryProfilePage) })),
      ),
    ),
  )
}

const top: CategoryProfileRequest = { level: 'top', code: 'C07', scope: { kind: 'chain' }, lang: 'en' }
const second: CategoryProfileRequest = { level: 'second', code: 'C0701', scope: { kind: 'chain' }, lang: 'en' }

describe('the category profile', () => {
  it('a second-level category opens the same page one level down', async () => {
    // The route names the depth and the category; the query names the narrowing and the language.
    expect(CATEGORY_PROFILE_PATTERN).toBe('/analytics/command-center/category/:level/:code')
    expect(categoryRequestOf({ level: 'second', code: 'C0701' }, new URLSearchParams('lang=ar'))).toEqual({
      level: 'second',
      code: 'C0701',
      scope: { kind: 'chain' },
      lang: 'ar',
    })
    // A level that is not one of the two is the top.
    expect(categoryRequestOf({ level: 'third', code: 'C07' }, new URLSearchParams()).level).toBe('top')

    // The top-level page lists its second-level categories, each a link to the same page one level down.
    const html = drawPage('/analytics/command-center/category/top/C07', [[top, categoryFixture()]])
    expect(html).toContain('data-cc-category-level="top"')
    expect(html).toContain('Skin care')
    expect(html).toContain('href="/analytics/command-center/category/second/C0701?lang=en"')
    expect(html).toContain('href="/analytics/command-center/category/second/C0702?lang=en"')

    // Followed, the same page asks for the second level and names its top-level category above it.
    api.get.mockResolvedValueOnce(categoryFixture({ level: 'second' }))
    await categoryProfileQuery(second).queryFn()
    expect(api.get).toHaveBeenCalledWith('CommandCenter/CategoryProfile', { level: 'second', category: 'C0701', scope: 'chain', lang: 'en' })
    const down = drawPage('/analytics/command-center/category/second/C0701?lang=en', [[second, categoryFixture({ level: 'second' })]])
    expect(down).toContain('data-cc-category-level="second"')
    expect(down).toContain('Face care')
    expect(down).toContain('href="/analytics/command-center/category/top/C07?lang=en"')
    // A second-level profile lists no further level.
    expect(down).not.toContain('data-cc-children')
  })

  it('the filter narrows every section together', async () => {
    // Choosing a narrowing moves the URL to it, keeping the language and the period; the other narrowing's key goes.
    expect(withScope(new URLSearchParams('lang=ar&period=ytd'), { kind: 'region', region: 'WEST' }).toString()).toBe(
      'lang=ar&period=ytd&scope=region&region=WEST',
    )
    expect(withScope(new URLSearchParams('lang=ar&scope=region&region=WEST'), { kind: 'store', storeCode: 'P166' }).toString()).toBe(
      'lang=ar&scope=store&store=P166',
    )
    expect(withScope(new URLSearchParams('scope=store&store=P166&lang=en'), { kind: 'chain' }).toString()).toBe('lang=en')

    // The page asks once for the narrowing, and every section comes from that one answer.
    const region: CategoryProfileRequest = { ...top, scope: { kind: 'region', region: 'WEST' } }
    const store: CategoryProfileRequest = { ...top, scope: { kind: 'store', storeCode: 'P166' } }
    api.get.mockClear()
    api.get.mockResolvedValue(categoryFixture())
    await categoryProfileQuery(region).queryFn()
    await categoryProfileQuery(store).queryFn()
    expect(api.get.mock.calls).toEqual([
      ['CommandCenter/CategoryProfile', { level: 'top', category: 'C07', scope: 'region', region: 'WEST', lang: 'en' }],
      ['CommandCenter/CategoryProfile', { level: 'top', category: 'C07', scope: 'store', storeCode: 'P166', lang: 'en' }],
    ])

    const html = drawPage('/analytics/command-center/category/top/C07?scope=region&region=WEST', [
      [top, categoryFixture()],
      [region, categoryFixture({ scope: region.scope })],
    ])
    // Sales and share, product health and promotion all carry the region's figures, none the chain's.
    expect(sectionOf(html, 'share')).toContain('SAR 1.1 m')
    expect(sectionOf(html, 'health')).toContain('SAR 1.9 m')
    expect(sectionOf(html, 'promotion')).toContain('27%')
    for (const chainFigure of ['SAR 4.2 m', 'SAR 7.6 m', '25%']) expect(html).not.toContain(chainFigure)
    // The filter shows the narrowing; the second level keeps it.
    expect(html).toMatch(/<option value="region:WEST" selected="">/)
    expect(html).toContain('data-cc-scope="region"')
    expect(html).toContain('href="/analytics/command-center/category/second/C0701?scope=region&amp;region=WEST&amp;lang=en"')

    // One pharmacy: its code in the filter, its figures in every section.
    const one = drawPage('/analytics/command-center/category/top/C07?scope=store&store=P166', [[store, categoryFixture({ scope: store.scope })]])
    expect(one).toContain('value="P166"')
    expect(sectionOf(one, 'share')).toContain('SAR 38,400')
    expect(sectionOf(one, 'health')).toContain('SAR 61,000')
    expect(sectionOf(one, 'promotion')).toContain('22%')
  })

  it('the four missing sections show "not available yet" with their reason', () => {
    const html = drawPage('/analytics/command-center/category/top/C07', [[top, categoryFixture()]])
    const missing = [
      ['margin', 'Margin', 'Cost is not in the warehouse yet.'],
      ['availability', 'Availability', 'Stock-outs by day are not captured yet.'],
      ['priceIndex', 'Price index', 'The price survey is not loaded yet.'],
      ['privateLabel', 'Private label', 'The item dimension does not carry the private label flag yet.'],
    ]
    for (const [key, title, reason] of missing) {
      const section = sectionOf(html, key)
      expect(section).toContain('data-cc-state="not-available-yet"')
      expect(section).toContain(title)
      expect(section).toContain('Not available yet')
      expect(section).toContain(reason)
      // No figure: a missing section draws no table.
      expect(section).not.toContain('<table')
    }
    // The sections the warehouse fills are drawn, with their money labelled as including VAT.
    expect(sectionOf(html, 'share')).toContain('data-cc-state="ok"')
    expect(sectionOf(html, 'share')).toContain('Money figures include VAT.')
    expect(sectionOf(html, 'share')).not.toContain('Not available yet')

    // In Arabic: right to left, the page's words in Arabic, the server's reason as it wrote it.
    const ar = drawPage('/analytics/command-center/category/top/C07?lang=ar', [[{ ...top, lang: 'ar' }, categoryFixture({ lang: 'ar' })]])
    expect(ar).toMatch(/^<div dir="rtl" lang="ar"/)
    expect(sectionOf(ar, 'margin')).toContain('غير متاح بعد')
    expect(sectionOf(ar, 'margin')).toContain('التكلفة ليست في المستودع بعد.')
    expect(ar).not.toContain('Not available yet')
  })

  it('a pharmacy in the over- and under-selling list opens its store profile', () => {
    const html = drawPage('/analytics/command-center/category/top/C07', [[top, categoryFixture()]])
    const stores = sectionOf(html, 'overUnderStores')
    // The store profile (948), not the home's scorecard panel; the code isolated as a machine value.
    expect(stores).toMatch(/<a [^>]*data-cc-target="store" href="\/analytics\/command-center\/store\/P166\?lang=en"[^>]*><bdi dir="ltr">P166<\/bdi><\/a>/)
    expect(stores).toContain('href="/analytics/command-center/store/P412?lang=en"')
    expect(stores).not.toContain('?store=P166')
    // A category beside it opens that category's profile, narrowed the same way.
    expect(sectionOf(html, 'share')).toContain('href="/analytics/command-center/category/top/C09?lang=en"')
    // The link keeps the page language.
    const ar = drawPage('/analytics/command-center/category/top/C07?lang=ar', [[{ ...top, lang: 'ar' }, categoryFixture({ lang: 'ar' })]])
    expect(sectionOf(ar, 'overUnderStores')).toContain('href="/analytics/command-center/store/P166?lang=ar"')
  })

  it('Export asks the server for the workbook of the same category, narrowing and language', async () => {
    const request: CategoryProfileRequest = { level: 'second', code: 'C0701', scope: { kind: 'store', storeCode: 'P166' }, period: 'ytd', lang: 'ar' }
    api.get.mockClear()
    api.get.mockResolvedValueOnce(categoryFixture({ level: 'second', lang: 'ar', scope: request.scope }))
    api.blob.mockResolvedValueOnce({ blob: new Blob(['x']), filename: 'category.xlsx' })
    await categoryProfileQuery(request).queryFn()
    await expect(categoryProfileApi.export(request)).resolves.toMatchObject({ filename: 'category.xlsx' })
    const asked = { level: 'second', category: 'C0701', scope: 'store', storeCode: 'P166', period: 'ytd', lang: 'ar' }
    expect(api.get).toHaveBeenCalledWith('CommandCenter/CategoryProfile', asked)
    expect(api.blob).toHaveBeenCalledWith('CommandCenter/CategoryProfile/Export', asked)
    // The page offers it beside the filter.
    const html = drawPage('/analytics/command-center/category/top/C07', [[top, categoryFixture()]])
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

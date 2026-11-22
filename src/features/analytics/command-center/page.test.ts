/**
 * oms 946 (BackOffice spec 4165): the command center home — the morning brief, the status line and the language switch,
 * behind the analytics view grant and the server's `CommandCenter:Home` switch (read off the one permissions answer as
 * `commandCenterOn`, decisions §2). The page is rendered as static markup with the permissions answer and the home
 * answer seeded in the query cache (BO 4176 is unbuilt: the answer is the fixture's).
 */
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, expect, it, vi } from 'vitest'
import '@/core/i18n'
import { PERMISSIONS_KEY, permissionsOf, type PermissionsAnswer } from '@/core/permissions'
import { ANALYTICS_MENU } from '@/layout/menu-analytics'
import { resolveMenu } from '@/layout/useVisibleMenu'
import type { CcLang, CommandCenterHome } from '@/core/models/command-center'
import CommandCenterPage from './CommandCenterPage'
import { canOpenCommandCenter } from './access'
import { CC_KEYS, homeQuery } from './api'
import { withLang } from './lang'
import { homeFixture } from './__fixtures__/home'

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }))
vi.mock('@/core/api', async (actual) => ({ ...(await actual<typeof import('@/core/api')>()), api }))

const answer = (screens: string[], commandCenterOn = true): PermissionsAnswer => ({
  screens,
  extras: { fileServerReady: false, notificationCenterOn: false, commandCenterOn, nphiesContractVersion: '1.3', canManageRoles: false, canManageUsers: false },
  version: 'v',
})

const drawPage = ({
  url = '/analytics/command-center',
  screens = ['Analytics:03'],
  on = true,
  homes = { en: homeFixture('en') } as Partial<Record<CcLang, CommandCenterHome>>,
} = {}) => {
  const client = new QueryClient()
  client.setQueryData(PERMISSIONS_KEY, answer(screens, on))
  for (const [lang, home] of Object.entries(homes)) client.setQueryData(CC_KEYS.home(lang as CcLang), home)
  return renderToStaticMarkup(
    createElement(QueryClientProvider, { client }, createElement(MemoryRouter, { initialEntries: [url] }, createElement(CommandCenterPage))),
  )
}

/** The markup of one brief section, from its opening tag to the next section's. */
const sectionOf = (html: string, key: string): string => {
  const at = html.indexOf(`data-cc-section="${key}"`)
  expect(at, key).toBeGreaterThan(-1)
  const next = html.indexOf('data-cc-section="', at + 1)
  return html.slice(at, next === -1 ? undefined : next)
}

describe('the command center home', () => {
  it('the open sections render and the four others are folded with their summaries', () => {
    const html = drawPage()
    for (const key of ['headline', 'changed', 'risks', 'opportunities']) expect(sectionOf(html, key)).toContain('data-cc-folded="false"')
    // The headline with its four figures, as the server wrote them.
    const headline = sectionOf(html, 'headline')
    for (const figure of ['SAR 12.4 m', '182,340', 'SAR 68.10', '9,812', "Yesterday&#x27;s sales"]) expect(headline).toContain(figure)
    // Every line: its sentence and its SAR figure as sent; a pharmacy code and a category name are links.
    const changed = sectionOf(html, 'changed')
    expect(changed).toContain('is newly flagged: sales growth is 9 points under its peers.')
    expect(changed).toContain('SAR 1.2 m')
    expect(changed).toContain('href="/analytics/command-center?store=P166&amp;lang=en"')
    expect(changed).toContain('href="/analytics/command-center/category/top/C07?lang=en"')
    expect(html).toContain('More in today&#x27;s brief')
    const folded = [
      ['slipped', '3 pharmacies slipped, 2 improved.'],
      ['categories', '2 categories moved share by 0.4 points or more.'],
      ['omni', 'Delivery orders rose 6% on last week.'],
      ['products', 'Not available this morning'],
    ]
    for (const [key, summary] of folded) {
      const section = sectionOf(html, key)
      expect(section).toContain('data-cc-folded="true"')
      expect(section).toMatch(/^[^>]*>/) // the folded section is a closed <details>: no `open` on it
      expect(section.slice(0, section.indexOf('>'))).not.toContain(' open')
      expect(section).toContain(summary)
    }
    // The four folded sections come after "More in today's brief", the open ones before it.
    const more = html.indexOf('More in today&#x27;s brief')
    expect(html.indexOf('data-cc-section="opportunities"')).toBeLessThan(more)
    expect(html.indexOf('data-cc-section="slipped"')).toBeGreaterThan(more)
  })

  it('a not-available section shows its last good date and no figure', () => {
    const home = homeFixture('en')
    // The top risks failed tonight; the server still names the line it would have shown, which the page must not draw.
    const risks = home.brief.sections.find((s) => s.key === 'risks')!
    Object.assign(risks, { state: 'not-available', lastGoodDate: '2026-11-18', dataAsOf: null, reason: 'The scorecard run failed.' })
    const html = drawPage({ homes: { en: home } })
    const section = sectionOf(html, 'risks')
    expect(section).toContain('data-cc-not-available')
    expect(section).toContain('Not available this morning')
    expect(section).toContain('Last good brief: ⁨2026-11-18⁩')
    expect(section).toContain('The scorecard run failed.')
    expect(section).not.toContain('SAR')
    expect(section).not.toContain('data-finding')
    // The folded product health section, not available too: the same sentence and date, no summary of its own.
    const products = sectionOf(html, 'products')
    expect(products).toContain('Last good brief: ⁨2026-11-19⁩')
    expect(products).not.toContain('SAR')
  })

  it('the language switch asks for the other language and lays the page right to left', async () => {
    // The switch moves the URL to the other language, keeping everything else (an open scorecard, 947).
    expect(withLang(new URLSearchParams('store=P166'), 'ar').toString()).toBe('store=P166&lang=ar')
    // The page asks the server for the brief in that language: it translates nothing itself.
    api.get.mockResolvedValueOnce(homeFixture('ar'))
    const query = homeQuery('ar')
    expect(query.queryKey).toEqual(CC_KEYS.home('ar'))
    await query.queryFn()
    expect(api.get).toHaveBeenCalledWith('CommandCenter/Home', { lang: 'ar' })

    const html = drawPage({ url: '/analytics/command-center?store=P166&lang=ar', homes: { ar: homeFixture('ar') } })
    expect(html).toMatch(/^<div dir="rtl" lang="ar"/)
    // The page's own words in Arabic, the server's sentences as it wrote them, the links keeping the language.
    expect(html).toContain('المزيد في موجز اليوم')
    expect(html).toContain('غير متاح هذا الصباح')
    expect(html).toContain('أُشّرت حديثًا')
    expect(html).toContain('href="/analytics/command-center?store=P166&amp;lang=ar"')
    expect(html).not.toContain('More in today')
    // The switch: Arabic pressed, English offered.
    expect(html).toMatch(/aria-pressed="true"[^>]*data-cc-lang="ar"/)
    expect(html).toMatch(/aria-pressed="false"[^>]*data-cc-lang="en"/)

    // English by default: left to right, the switch the other way round.
    const en = drawPage()
    expect(en).toMatch(/^<div dir="ltr" lang="en"/)
    expect(en).toMatch(/aria-pressed="true"[^>]*data-cc-lang="en"/)
  })

  it('the status line shows a red dot for a failed run', () => {
    const html = drawPage()
    const at = html.indexOf('data-cc-status')
    expect(at).toBeGreaterThan(-1)
    const line = html.slice(at, html.indexOf('data-cc-section="'))
    // The data-as-of day, then each run with its finish time and the dot the server chose.
    expect(line).toContain('Data as of ⁨2026-11-20⁩')
    const run = (agent: string) => line.slice(line.indexOf(`data-cc-run="${agent}"`), line.indexOf('</li>', line.indexOf(`data-cc-run="${agent}"`)))
    expect(run('product-health')).toMatch(/bg-danger[^"]*" data-dot="red"/)
    expect(run('product-health')).toContain('Product health')
    expect(run('product-health')).toContain('03:05')
    expect(run('product-health')).toContain('Failed')
    expect(run('scorecard')).toMatch(/bg-success[^"]*" data-dot="green"/)
    expect(run('brief')).toContain('05:40')
    // The status line sits under the title, above the brief.
    expect(at).toBeLessThan(html.indexOf('data-cc-brief'))
    expect(html.indexOf('Command center')).toBeLessThan(at)
  })

  it('the page is absent when the server does not offer it', () => {
    // Switch off (`commandCenterOn` missing or false): no brief, no status line, the not-offered sentence.
    const off = drawPage({ on: false })
    expect(off).toContain('The command center is not switched on')
    expect(off).not.toContain('data-cc-brief')
    expect(off).not.toContain('data-cc-status')
    expect(off).not.toContain('Headline')
    // No analytics view grant, switch on or not: the denial.
    const denied = drawPage({ screens: ['PriceWatch:03'], on: true })
    expect(denied).toContain('No access to the command center')
    expect(denied).not.toContain('data-cc-brief')
    // The menu leaf reads the page gate's own predicate: hidden until both the grant and the switch say yes.
    const leaf = ANALYTICS_MENU.items?.find((i) => i.routerLink === '/analytics/command-center')
    expect(leaf?.requires).toBe(canOpenCommandCenter)
    const offersLeaf = (screens: string[], commandCenterOn: boolean) =>
      resolveMenu([ANALYTICS_MENU], permissionsOf({ screens, extras: answer(screens, commandCenterOn).extras }))
        .items.flatMap((g) => g.items ?? [])
        .some((i) => i.routerLink === '/analytics/command-center')
    expect(offersLeaf(['Analytics:03'], true)).toBe(true)
    expect(offersLeaf(['Analytics:03'], false)).toBe(false)
    expect(offersLeaf([], true)).toBe(false)
  })
})

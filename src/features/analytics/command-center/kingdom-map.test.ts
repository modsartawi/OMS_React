/**
 * oms 947 (BackOffice spec 4165 "The kingdom map", "The scorecard panel"): the home's map half — the filter, the region
 * table, the map's count of pharmacies it cannot place — and the scorecard panel a pharmacy opens. Rendered as static
 * markup with the permissions answer, the home answer and a scorecard seeded in the query cache (BO 4176 is unbuilt).
 */
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, expect, it, vi } from 'vitest'
import '@/core/i18n'
import { homeHref } from '@/core/command-center-routes'
import { useCopilotPanel } from '@/core/copilot-panel'
import { PERMISSIONS_KEY, type PermissionsAnswer } from '@/core/permissions'
import { CC_FILTERS, type CcLang, type CcScorecard, type CommandCenterHome } from '@/core/models/command-center'
import { hasLocaleKey } from '@/core/test/locale'
import en from '@/locales/en/command-center.json'
import ar from '@/locales/ar/command-center.json'
import CommandCenterPage from './CommandCenterPage'
import { CC_KEYS } from './api'
import { withStore } from './home-url'
import { kingdomView } from './map-view'
import { SCORECARD_KEYS, scorecardQuery } from './scorecard-api'
import { mapHomeFixture } from './__fixtures__/map'
import { newPharmacyScorecard, scorecardFixture } from './__fixtures__/scorecard'

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }))
vi.mock('@/core/api', async (actual) => ({ ...(await actual<typeof import('@/core/api')>()), api }))
// The copilot panel's store read as it stands (a static render reads no zustand snapshot), as 950's brief-ask.test does.
vi.mock('@/core/copilot-panel', async (actual) => {
  const real = await actual<typeof import('@/core/copilot-panel')>()
  const panel = real.createCopilotPanel()
  const useCopilotPanel = Object.assign(<T,>(pick: (s: ReturnType<typeof panel.getState>) => T) => pick(panel.getState()), panel)
  return { ...real, useCopilotPanel }
})

const answer: PermissionsAnswer = {
  screens: ['Analytics:03'],
  extras: { fileServerReady: false, notificationCenterOn: false, commandCenterOn: true, nphiesContractVersion: '1.3', canManageRoles: false, canManageUsers: false },
  version: 'v',
}

export const drawPage = ({
  url = '/analytics/command-center',
  lang = 'en' as CcLang,
  home = mapHomeFixture(lang) as CommandCenterHome,
  scorecards = [] as CcScorecard[],
} = {}) => {
  const client = new QueryClient()
  client.setQueryData(PERMISSIONS_KEY, answer)
  client.setQueryData(CC_KEYS.home(lang), home)
  for (const card of scorecards) client.setQueryData(SCORECARD_KEYS.scorecard(card.storeCode, lang), card)
  return renderToStaticMarkup(
    createElement(QueryClientProvider, { client }, createElement(MemoryRouter, { initialEntries: [url] }, createElement(CommandCenterPage))),
  )
}

/** The markup of one region's row in the region table. */
const rowOf = (html: string, region: string): string => {
  const at = html.indexOf(`data-cc-region="${region}"`)
  expect(at, region).toBeGreaterThan(-1)
  return html.slice(at, html.indexOf('</tr>', at))
}

describe('the kingdom map and the region table', () => {
  it('the filter changes the points, the shading and the table together', () => {
    // All issues by default: the chip pressed, the table its all-issues counts.
    const all = drawPage()
    expect(all).toMatch(/aria-pressed="true"[^>]*data-cc-filter="all"/)
    expect(all).toMatch(/aria-pressed="false"[^>]*data-cc-filter="stock"/)
    expect(rowOf(all, 'Center')).toContain('>260<')
    expect(rowOf(all, 'Center')).toContain('>100<')
    expect(rowOf(all, 'Center')).toContain('38%')
    // Stock, from the URL: the chip pressed, the table its stock counts (the map reads the same filter, map-view.test).
    const stock = drawPage({ url: '/analytics/command-center?filter=stock' })
    expect(stock).toMatch(/aria-pressed="true"[^>]*data-cc-filter="stock"/)
    expect(rowOf(stock, 'Center')).toContain('>258<')
    expect(rowOf(stock, 'Center')).toContain('>22<')
    expect(rowOf(stock, 'Center')).toContain('9%')
    expect(rowOf(stock, 'Center')).not.toContain('38%')
    expect(stock).toContain('data-cc-map="stock"')
  })

  it('a pharmacy with no coordinates is counted under the map and not drawn', () => {
    const home = mapHomeFixture('en')
    // The server sends one pharmacy it cannot place, and counts it under the map.
    home.points.push({ storeCode: 'P999', lat: null as unknown as number, lon: null as unknown as number, region: 'East', colour: { all: 'red', sales: 'red', stock: 'red', delivery: 'red' } })
    home.notOnMap = 2
    expect(kingdomView(home, 'all').points.map((p) => p.id)).toEqual(['P166', 'P031', 'P402', 'B002'])
    const html = drawPage({ home })
    const count = html.slice(html.indexOf('data-cc-not-on-map'), html.indexOf('</span>', html.indexOf('data-cc-not-on-map')) + 30)
    expect(count).toContain('Pharmacies not on the map (no coordinates):')
    expect(count).toContain('<bdi dir="ltr">2</bdi>')
    // Every pharmacy placed: no count, the hint to zoom in instead.
    const placed = drawPage({ home: { ...mapHomeFixture('en'), notOnMap: 0 } })
    expect(placed).not.toContain('data-cc-not-on-map')
    expect(placed).toContain('Zoom in to see each pharmacy.')
    // The boundary file's licence is credited under the map.
    expect(placed).toContain('Region borders: geoBoundaries, CC BY 4.0')
  })
})

/** The markup of the scorecard panel, from its dialog to its end. */
const panelOf = (html: string): string => {
  const at = html.indexOf('<dialog')
  expect(at, 'the scorecard panel').toBeGreaterThan(-1)
  return html.slice(at, html.indexOf('</dialog>', at))
}
const measureOf = (panel: string, key: string): string => {
  const at = panel.indexOf(`data-cc-measure="${key}"`)
  expect(at, key).toBeGreaterThan(-1)
  return panel.slice(at, panel.indexOf('</li>', at))
}

describe('the scorecard panel', () => {
  it('selecting a pharmacy opens its scorecard with six measures', () => {
    // A tap on a point is a selection of its pharmacy (core map-panel.test); the page puts it in the URL.
    const url = `/analytics/command-center?${withStore(new URLSearchParams('lang=en'), 'P166')}`
    const panel = panelOf(drawPage({ url, scorecards: [scorecardFixture('en')] }))
    expect(panel).toContain('data-cc-scorecard="P166"')
    expect(panel).toContain('P166 · Riyadh')
    expect(panel).toContain('Size B · Center')
    expect(panel.match(/data-cc-measure="/g)).toHaveLength(6)
    // Each measure: its stored colour, its own figure and its peer figure.
    expect(measureOf(panel, 'salesGrowth')).toMatch(/bg-danger[^"]*" data-tone="red"/)
    expect(measureOf(panel, 'salesGrowth')).toContain('-9.1 pts')
    expect(measureOf(panel, 'salesGrowth')).toContain('Peers')
    expect(measureOf(panel, 'basket')).toMatch(/bg-attention[^"]*" data-tone="amber"/)
    expect(measureOf(panel, 'basket')).toContain('SAR 61.40')
    expect(measureOf(panel, 'basket')).toContain('SAR 68.10')
    expect(measureOf(panel, 'delivery')).toMatch(/bg-success[^"]*" data-tone="green"/)
    expect(panel).toContain('data-cc-flagged')
    // The way on: the store profile, in the page's language. No Ask of its own (950 hands it into the slot).
    expect(panel).toContain('href="/analytics/command-center/store/P166?lang=en"')
    expect(panel).toContain('Open the store profile')
    expect(panel).not.toContain('Why is P166 flagged?')
    // No pharmacy chosen: no panel.
    expect(drawPage()).not.toContain('<dialog')
  })

  it('a pharmacy code in the brief opens the same panel', () => {
    const scorecards = [scorecardFixture('en')]
    // The brief's link to P166 (946's "What changed overnight" line) …
    const briefHtml = drawPage()
    const href = homeHref({ store: 'P166', lang: 'en' })
    expect(briefHtml).toContain(`href="${href.replace('&', '&amp;')}"`)
    // … opens the panel a map tap on P166 opens: one URL, one panel.
    const fromBrief = panelOf(drawPage({ url: href, scorecards }))
    const fromMap = panelOf(drawPage({ url: `/analytics/command-center?${withStore(new URLSearchParams('lang=en'), 'P166')}`, scorecards }))
    expect(fromBrief).toContain('data-cc-scorecard="P166"')
    expect(fromBrief.replace(/id="[^"]*"|aria-labelledby="[^"]*"/g, '')).toBe(fromMap.replace(/id="[^"]*"|aria-labelledby="[^"]*"/g, ''))
  })

  it('a new pharmacy shows "new" on the growth measures', () => {
    const url = '/analytics/command-center?store=P977'
    const panel = panelOf(drawPage({ url, scorecards: [newPharmacyScorecard('en')] }))
    expect(panel).toContain('New pharmacy')
    for (const key of ['salesGrowth', 'receiptsGrowth']) {
      const measure = measureOf(panel, key)
      expect(measure).toContain('data-cc-state="new"')
      expect(measure).toContain('data-cc-new')
      expect(measure).toContain('>New<')
      expect(measure).toContain('data-tone="none"')
      expect(measure).not.toContain('data-cc-own')
    }
    // The other measures are still scored, with their figures; a delivery too thin to score says so.
    expect(measureOf(panel, 'basket')).toContain('SAR 61.40')
    expect(measureOf(panel, 'delivery')).toContain('Not scored')
    // In Arabic, the page's own word for "new", right to left.
    const ar = drawPage({ url: '/analytics/command-center?store=P977&lang=ar', lang: 'ar', scorecards: [newPharmacyScorecard('ar')] })
    expect(ar).toMatch(/^<div dir="rtl" lang="ar"/)
    expect(measureOf(panelOf(ar), 'salesGrowth')).toContain('>جديدة<')
  })

  it('the panel carries 950’s "Ask the copilot" for the pharmacy, only when the server offers it and the reader holds the copilot', () => {
    const url = '/analytics/command-center?store=P166'
    useCopilotPanel.getState().setAvailable(true)
    try {
      const panel = panelOf(drawPage({ url, scorecards: [scorecardFixture('en')] }))
      expect(panel).toContain('data-copilot-ask="f-status-P166"')
      expect(panel).toContain('Ask the copilot')
      // `Copilot:Findings` off: the server leaves `ask` out, and there is no button.
      const off = panelOf(drawPage({ url, scorecards: [{ ...scorecardFixture('en'), ask: undefined }] }))
      expect(off).not.toContain('data-copilot-ask')
    } finally {
      useCopilotPanel.getState().setAvailable(false)
    }
    // No copilot grant: no button either.
    expect(panelOf(drawPage({ url, scorecards: [scorecardFixture('en')] }))).not.toContain('data-copilot-ask')
  })

  it('the panel asks the server for the pharmacy in the page language', async () => {
    api.get.mockResolvedValueOnce(scorecardFixture('ar'))
    await scorecardQuery('P166', 'ar').queryFn()
    expect(api.get).toHaveBeenCalledWith('CommandCenter/Scorecard', { storeCode: 'P166', lang: 'ar' })
    expect(scorecardQuery('P166', 'ar').queryKey).toEqual(SCORECARD_KEYS.scorecard('P166', 'ar'))
  })
})

describe('the map half’s words, en and ar', () => {
  it.each([en, ar])('hold every key the page builds from data', (locale) => {
    for (const key of CC_FILTERS.map((f) => `map.filter.${f}`)) expect([key, hasLocaleKey(locale, key)]).toEqual([key, true])
  })
})

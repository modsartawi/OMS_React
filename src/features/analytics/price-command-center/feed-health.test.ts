/**
 * oms 939 (BackOffice spec 4127, decision 8) — the Feed health tab: each competitor's latest runs per price source, with
 * counts, failures and their error (a Mindsite quota or auth refusal); cross-check flags listing the materials where the two sources disagree, each
 * linked to its drill-down; the authority setting changed only with the Manage grant, after a confirmation naming what
 * changes. Components are rendered as static markup through a real i18next instance (en and ar); the network is stubbed
 * at the `@/core/api` boundary and the confirmation at the core confirm service.
 *
 * Fixtures are BO 4131 / 4128 as shipped (`PriceWatchFeedHealthService.cs`, `PriceWatchSourceAuthorityService.cs`, BO
 * pricing2 d099aac36): `lastRunBySource`, `crossCheck { compared, disagreements, examples }`, the authority door.
 */
import { createElement, type ReactElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router'
import i18next from 'i18next'
import { I18nextProvider } from 'react-i18next'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { FeedHealthCompetitor, FeedRunSummary, PriceWatchFeedHealth } from '@/core/models/price-watch'
import en from '@/locales/en/price-command-center.json'
import ar from '@/locales/ar/price-command-center.json'

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn() }))
vi.mock('@/core/api', async (actual) => ({ ...(await actual<typeof import('@/core/api')>()), api }))
const confirm = vi.hoisted(() => ({ confirmAction: vi.fn() }))
vi.mock('@/core/services/confirm', async (actual) => ({ ...(await actual<typeof import('@/core/services/confirm')>()), ...confirm }))

const fh = await import('./feed-health')
const { FeedHealthView } = await import('./FeedHealthTab')

const NS = 'price-command-center'
const strip = (s: string) => s.replace(/[⁦-⁩]/g, '')
const draw = (element: ReactElement, lng: 'en' | 'ar' = 'en') => {
  const i18n = i18next.createInstance()
  i18n.init({ lng, resources: { [lng]: { [NS]: lng === 'en' ? en : ar } }, ns: [NS], defaultNS: NS, initAsync: false, interpolation: { escapeValue: false } })
  return renderToStaticMarkup(createElement(I18nextProvider, { i18n }, createElement(MemoryRouter, null, element)))
}

const run = (over: Partial<FeedRunSummary> = {}): FeedRunSummary => ({
  scrapeRunId: 'R-1',
  passKind: 'DAILY',
  passSlotAt: '2026-11-21T03:00:00',
  startedAt: '2026-11-21T03:00:05',
  finishedAt: '2026-11-21T03:20:00',
  listingsRead: 480,
  pricesWritten: 471,
  failures: 9,
  listingsGone: 2,
  isBlocked: false,
  blockReason: '',
  source: 'SCRAPER',
  errorMessage: '',
  ...over,
})

const competitor = (over: Partial<FeedHealthCompetitor> = {}): FeedHealthCompetitor => ({
  competitorCode: 'PANDA',
  name: 'Panda',
  kind: 'pharmacy',
  isEnabled: true,
  isBlocked: false,
  blockedAt: null,
  blockReason: '',
  blockClearedAt: null,
  blockClearedBy: '',
  matchedListings: 500,
  staleListings: 12,
  goneListings: 3,
  lastRun: run(),
  authoritativeSource: 'SCRAPER',
  lastRunBySource: [run()],
  crossCheck: { compared: 0, disagreements: 0, examples: [] },
  ...over,
})

const health = (competitors: FeedHealthCompetitor[], over: Partial<PriceWatchFeedHealth> = {}): PriceWatchFeedHealth => ({
  at: '2026-11-21T09:00:00',
  staleAfterHours: 36,
  competitors,
  crossCheckMarginPercent: 10,
  effectivePriceJob: null,
  ...over,
})

const view = (h: PriceWatchFeedHealth, canManage = false, lng: 'en' | 'ar' = 'en') =>
  draw(createElement(FeedHealthView, { health: h, canManage, busyCode: null, onChangeAuthority: () => {} }), lng)

beforeEach(() => {
  api.get.mockReset()
  api.put.mockReset()
  confirm.confirmAction.mockReset()
})

describe('runs are shown per source per competitor', () => {
  const panda = competitor({
    authoritativeSource: 'MINDSITE',
    // Ordered by source on the wire (MINDSITE before SCRAPER): the tab puts the scraper first itself.
    lastRunBySource: [
      run({ scrapeRunId: 'R-M', source: 'MINDSITE', listingsRead: 0, pricesWritten: 0, failures: 1, errorMessage: 'HTTP 429 quota exceeded' }),
      run({ scrapeRunId: 'R-S', source: 'SCRAPER', listingsRead: 480, pricesWritten: 471, failures: 9 }),
    ],
  })
  const nahdi = competitor({
    competitorCode: 'NAHDI',
    name: 'Nahdi',
    authoritativeSource: 'SCRAPER',
    lastRunBySource: [run({ scrapeRunId: 'R-N', source: 'SCRAPER', finishedAt: null })],
  })

  it('orders each competitor’s sources scraper first, and keeps a source that never ran there', () => {
    expect(fh.sourceRuns(panda).map((r) => [r.source, r.run?.scrapeRunId ?? null])).toEqual([
      ['SCRAPER', 'R-S'],
      ['MINDSITE', 'R-M'],
    ])
    expect(fh.sourceRuns(nahdi).map((r) => [r.source, r.run?.scrapeRunId ?? null])).toEqual([
      ['SCRAPER', 'R-N'],
      ['MINDSITE', null],
    ])
  })

  it('a competitor no source ever ran for shows both sources as never run', () => {
    const idle = competitor({ lastRun: null, lastRunBySource: [] })
    expect(fh.sourceRuns(idle).map((r) => [r.source, r.run])).toEqual([
      ['SCRAPER', null],
      ['MINDSITE', null],
    ])
  })

  it('tells a run that ended with an error (e.g. a quota or auth refusal), a run still going and failures apart', () => {
    expect(fh.runState(run({ errorMessage: 'HTTP 401 token expired', failures: 1 }))).toBe('error')
    expect(fh.runState(run({ errorMessage: '   ', failures: 0 }))).toBe('ok')
    expect(fh.runState(run({ isBlocked: true }))).toBe('blocked')
    expect(fh.runState(run({ finishedAt: null }))).toBe('running')
    expect(fh.runState(run({ failures: 9 }))).toBe('failures')
    expect(fh.runState(run({ failures: 0 }))).toBe('ok')
    expect(fh.runState(null)).toBe('never')
  })

  it('draws one row per source per competitor, with its counts, failures and quota error', () => {
    const html = strip(view(health([panda, nahdi])))
    for (const key of ['PANDA:SCRAPER', 'PANDA:MINDSITE', 'NAHDI:SCRAPER', 'NAHDI:MINDSITE']) expect(html).toContain(`data-feed-run="${key}"`)
    const mindsite = html.slice(html.indexOf('data-feed-run="PANDA:MINDSITE"'), html.indexOf('data-feed-run="NAHDI:SCRAPER"'))
    expect(mindsite).toContain('data-run-state="error"')
    expect(mindsite).toContain('Ended with an error')
    expect(mindsite).toContain('HTTP 429 quota exceeded')
    const scraper = html.slice(html.indexOf('data-feed-run="PANDA:SCRAPER"'), html.indexOf('data-feed-run="PANDA:MINDSITE"'))
    expect(scraper).toContain('480')
    expect(scraper).toContain('471')
    expect(scraper).toContain('data-run-failures="9"')
    expect(html).toMatch(/data-feed-run="NAHDI:MINDSITE"[^]*?data-run-state="never"/)
    expect(html).toMatch(/data-feed-run="NAHDI:SCRAPER"[^]*?data-run-state="running"/)
  })

  it('names the authoritative source and shows a block with its reason — nothing clears it', () => {
    const blocked = competitor({ isBlocked: true, blockedAt: '2026-11-20T22:00:00', blockReason: 'Captcha wall on listing pages', authoritativeSource: 'MINDSITE' })
    const html = strip(view(health([blocked]), true))
    expect(html).toContain('data-feed-authority="MINDSITE"')
    expect(html).toContain('data-feed-blocked="PANDA"')
    expect(html).toContain('Captcha wall on listing pages')
    expect(html).not.toMatch(/clear block|unblock/i)
  })

  it('shows the nightly effective-price job’s last run and its watched count', () => {
    const html = strip(
      view(
        health([panda], {
          effectivePriceJob: {
            runId: 'J-1', runDay: '2026-11-21', referenceStore: '1001', startedAt: '2026-11-21T01:00:00', finishedAt: '2026-11-21T01:04:10',
            isFinished: true, materials: 1250, priced: 1238, unpriced: 12, failures: 0, durationSeconds: 250, hasError: false, errorMessage: '',
          },
        }),
      ),
    )
    expect(html).toContain('data-effective-price-job="J-1"')
    expect(html).toContain('1,250')
    expect(html).toContain('1,238')
  })

  it('renders in Arabic with the same rows (runs)', () => {
    const html = view(health([panda, nahdi]), false, 'ar')
    expect(html).toContain('data-feed-run="PANDA:MINDSITE"')
    expect(html).toContain(ar.feedHealth.source.MINDSITE)
    expect(html).toContain(ar.feedHealth.runState.error)
    expect(html).not.toContain('Ended with an error')
  })
})

describe('a cross-check flag lists its materials and links them', () => {
  const flagged = competitor({
    authoritativeSource: 'MINDSITE',
    crossCheck: {
      compared: 40,
      disagreements: 3,
      examples: [
        { materialNumber: '100012345', listingId: 'L-1', day: '2026-11-20T00:00:00', scraperPaidPrice: 19.95, mindsitePaidPrice: 24.5, differencePercent: 22.8 },
        { materialNumber: '100067890', listingId: 'L-2', day: '2026-11-20T00:00:00', scraperPaidPrice: 10, mindsitePaidPrice: 11.5, differencePercent: 15 },
      ],
    },
  })

  it('flags the competitor with its count and the margin, and lists each example material', () => {
    const html = strip(view(health([flagged], { crossCheckMarginPercent: 10 })))
    expect(html).toContain('data-cross-check="PANDA"')
    expect(html).toContain('3 disagreements above 10.0 % between our scraper and Mindsite')
    expect(html).toContain('data-cross-check-material="100012345"')
    expect(html).toContain('data-cross-check-material="100067890"')
    expect(html).toContain('22.8 %')
    expect(html).toContain('2 / 3')
  })

  it('links each material to its drill-down', () => {
    const html = view(health([flagged], { crossCheckMarginPercent: 10 }))
    const link = html.match(/<a[^>]*data-cross-check-material="100012345"[^>]*>/)?.[0] ?? ''
    // 936: the drill-down's own link — the page's address with ?material= (the test router sits at /).
    expect(link).toContain('href="/?material=100012345"')
    expect(link).toContain('data-open-drilldown="100012345"')
  })

  it('says the sources agree only when something was compared; with nothing compared it says so instead (cross-check)', () => {
    expect(strip(view(health([competitor({ crossCheck: { compared: 12, disagreements: 0, examples: [] } })])))).toContain('The two price sources agree here.')
    const none = strip(view(health([competitor({ crossCheck: { compared: 0, disagreements: 0, examples: [] } })])))
    expect(none).not.toContain('The two price sources agree here.')
    expect(none).toContain('No exact match was read by both sources on the same day.')
  })
})

describe('the authority change asks for confirmation and sends the setting, and is hidden without Manage', () => {
  const panda = competitor({ authoritativeSource: 'SCRAPER' })
  const tOf = (lng: 'en' | 'ar' = 'en') => {
    const i18n = i18next.createInstance()
    i18n.init({ lng, resources: { [lng]: { [NS]: lng === 'en' ? en : ar } }, ns: [NS], defaultNS: NS, initAsync: false, interpolation: { escapeValue: false } })
    return i18n.getFixedT(lng, NS)
  }

  it('offers the setting with the Manage grant, on the authoritative source as it stands', () => {
    const html = view(health([panda]), true)
    const control = html.match(/<select[^>]*data-authority-change="PANDA"[^>]*>/)?.[0] ?? ''
    expect(control).not.toBe('')
    expect(html).toMatch(/<option value="SCRAPER" selected="">/)
    expect(html).toContain('<option value="MINDSITE">')
  })

  it('hides the setting without the Manage grant — the authoritative source still shows', () => {
    const html = view(health([panda]), false)
    expect(html).not.toContain('data-authority-change')
    expect(html).toContain('data-feed-authority="SCRAPER"')
  })

  it('names what changes: whose prices will count, and whose will not', () => {
    expect(strip(fh.authorityChangeMessage(tOf(), panda, 'MINDSITE'))).toBe(
      'Mindsite’s prices will count for Panda; our scraper’s will not. Price alerts, the index and the grid follow from the next run.',
    )
    expect(strip(fh.authorityChangeMessage(tOf(), competitor({ authoritativeSource: 'MINDSITE' }), 'SCRAPER'))).toMatch(/^Our scraper’s prices will count for Panda; Mindsite’s will not\./)
    // Every interpolated value is isolated whole (FSI … PDI).
    expect(fh.authorityChangeMessage(tOf(), panda, 'MINDSITE')).toContain('⁨Panda⁩')
    expect(strip(fh.authorityChangeMessage(tOf('ar'), panda, 'MINDSITE'))).toContain('ستُحتسب أسعار مايندسايت لـPanda')
  })

  it('asks first, and sends nothing when the operator cancels', async () => {
    confirm.confirmAction.mockResolvedValue(false)
    expect(await fh.requestAuthorityChange(tOf(), panda, 'MINDSITE')).toBeNull()
    expect(confirm.confirmAction).toHaveBeenCalledWith(fh.authorityChangeMessage(tOf(), panda, 'MINDSITE'), 'Change the authoritative price source')
    expect(api.put).not.toHaveBeenCalled()
  })

  it('sends the setting once confirmed', async () => {
    confirm.confirmAction.mockResolvedValue(true)
    const setting = { competitorCode: 'PANDA', competitorName: 'Panda', isEnabled: true, authoritativeSource: 'MINDSITE', setBy: 'msartawi', setAt: '2026-11-21T10:00:00' }
    api.put.mockResolvedValue(setting)
    expect(await fh.requestAuthorityChange(tOf(), panda, 'MINDSITE')).toEqual(setting)
    expect(api.put).toHaveBeenCalledWith('PriceWatch/Competitors/PANDA/Authority', { source: 'MINDSITE' })
  })

  it('asks nothing when the source picked is the one that already counts', async () => {
    expect(await fh.requestAuthorityChange(tOf(), panda, 'SCRAPER')).toBeNull()
    expect(confirm.confirmAction).not.toHaveBeenCalled()
    expect(api.put).not.toHaveBeenCalled()
  })
})

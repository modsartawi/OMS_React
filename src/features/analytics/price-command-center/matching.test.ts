/**
 * oms 937 (BackOffice spec 4127, decision 8) — the Matching tab: the matching team picks a competitor and works its
 * queue in our sales order. Each action (Exact, Comparable, Not the same, Not carried) sends its own door and the queue
 * moves on; a candidate whose origin is MINDSITE (BO 4135, GUESSED) is labelled "suggested by Mindsite"; coverage shows
 * matched, not carried and still open per competitor; the actions need the Manage grant.
 * Components are rendered as static markup through a real i18next instance; the network is stubbed at `@/core/api`.
 */
import { createElement, type ReactElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import i18next from 'i18next'
import { I18nextProvider } from 'react-i18next'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { MatchingCandidate, MatchingQueueItem } from '@/core/models/price-watch'
import en from '@/locales/en/price-command-center.json'
import ar from '@/locales/ar/price-command-center.json'

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }))
vi.mock('@/core/api', async (actual) => ({ ...(await actual<typeof import('@/core/api')>()), api }))

const m = await import('./matching')

const NS = 'price-command-center'
const draw = (element: ReactElement, lng: 'en' | 'ar' = 'en') => {
  const i18n = i18next.createInstance()
  i18n.init({ lng, resources: { [lng]: { [NS]: lng === 'en' ? en : ar } }, ns: [NS], defaultNS: NS, initAsync: false, interpolation: { escapeValue: false } })
  return renderToStaticMarkup(createElement(I18nextProvider, { i18n }, element))
}

const candidate = (over: Partial<MatchingCandidate> = {}): MatchingCandidate => ({
  candidateId: 'C-1',
  rank: 1,
  listingId: 'L-1',
  url: 'https://www.nahdionline.com/en/panadol-extra-24',
  title: 'Panadol Extra 24 tablets',
  brand: 'Panadol',
  sizeText: '24 tablets',
  sizeValue: 24,
  sizeUnit: 'piece',
  imageUrl: 'https://cdn.example.com/panadol.jpg',
  barcodes: ['6291100080012'],
  regularPrice: 21,
  offerPrice: 19.95,
  currency: 'SAR',
  observedAt: '2026-11-21T08:15:00',
  sellerName: 'Nahdi Online',
  isPlatformSeller: true,
  inStock: true,
  foundAt: '2026-11-20T23:00:00',
  ...over,
})

const item = (materialNumber: string, candidates: MatchingCandidate[], over: Partial<MatchingQueueItem> = {}): MatchingQueueItem => ({
  materialNumber,
  salesRank: 1,
  netSalesValue: 125000,
  isAddition: false,
  ours: {
    title: 'PANADOL EXTRA 24 TAB',
    brand: 'Panadol',
    sizeValue: 24,
    sizeUnit: 'piece',
    imageUrl: '',
    barcodes: ['6291100080012'],
    basicPrice: 25,
    effectivePrice: 22.5,
    currency: 'SAR',
    priceDay: '2026-11-21',
  },
  candidates,
  ...over,
})

beforeEach(() => {
  api.get.mockReset().mockResolvedValue({})
  api.post.mockReset().mockResolvedValue({})
})

describe('each action sends its door and the queue moves to the next candidate', () => {
  const first = item('100000001', [candidate({ candidateId: 'C-1a' }), candidate({ candidateId: 'C-1b', rank: 2 })])
  const second = item('100000002', [candidate({ candidateId: 'C-2a' })], { salesRank: 2 })
  const items = [first, second]

  it.each([
    ['exact', 'PriceWatch/Matching/Candidates/C-1a/Exact', {}],
    ['comparable', 'PriceWatch/Matching/Candidates/C-1a/Comparable', {}],
    ['notTheSame', 'PriceWatch/Matching/Candidates/C-1a/NotTheSame', {}],
    ['notCarried', 'PriceWatch/Matching/NAHDI/NotCarried', { material: '100000001' }],
  ] as const)('%s → POST %s', async (action, path, body) => {
    await m.sendDecision('NAHDI', { action, item: first, candidate: first.candidates[0] })
    expect(api.post).toHaveBeenCalledWith(path, body)
  })

  it('opens on the first material in our sales order, best candidate first', () => {
    expect(m.currentPair(items, m.NO_DECISIONS)).toEqual({ item: first, candidate: first.candidates[0] })
  })

  it('Exact, Comparable and Not carried close the material: the next material comes up', () => {
    for (const action of ['exact', 'comparable', 'notCarried'] as const) {
      const after = m.applyDecision(m.NO_DECISIONS, { action, item: first, candidate: first.candidates[0] })
      expect([action, m.currentPair(items, after)?.candidate?.candidateId]).toEqual([action, 'C-2a'])
    }
  })

  it('Not the same closes only that candidate: the material’s next candidate comes up, then the next material', () => {
    const one = m.applyDecision(m.NO_DECISIONS, { action: 'notTheSame', item: first, candidate: first.candidates[0] })
    expect(m.currentPair(items, one)).toEqual({ item: first, candidate: first.candidates[1] })
    const two = m.applyDecision(one, { action: 'notTheSame', item: first, candidate: first.candidates[1] })
    // No candidate left: the material still stands, to confirm by URL or mark not carried.
    expect(m.currentPair(items, two)).toEqual({ item: first, candidate: null })
  })

  it('a material discovery found nothing for stands with no candidate; the page is done when every material is', () => {
    expect(m.currentPair([item('100000003', [])], m.NO_DECISIONS)?.candidate).toBeNull()
    const done = m.applyDecision(m.NO_DECISIONS, { action: 'notCarried', item: first, candidate: null })
    expect(m.currentPair([first], done)).toBeNull()
  })

  it('confirm by URL sends material, competitor and URL, and closes the material', async () => {
    await m.confirmByUrl('NAHDI', first, ' https://www.nahdionline.com/en/p/1 ')
    expect(api.post).toHaveBeenCalledWith('PriceWatch/Matches/ConfirmByUrl', {
      material: '100000001',
      competitorCode: 'NAHDI',
      url: 'https://www.nahdionline.com/en/p/1',
    })
    const after = m.closeMaterial(m.NO_DECISIONS, first.materialNumber)
    expect(m.currentPair(items, after)?.item.materialNumber).toBe('100000002')
  })

  it('refuses to send a URL that is not absolute https, nor one over 800 characters', () => {
    expect(m.urlProblem('')).toBe('required')
    expect(m.urlProblem('http://www.nahdionline.com/p/1')).toBe('notHttps')
    expect(m.urlProblem('nahdionline.com/p/1')).toBe('notHttps')
    expect(m.urlProblem('https://' + 'a'.repeat(800))).toBe('tooLong')
    expect(m.urlProblem('https://www.nahdionline.com/p/1')).toBeNull()
  })

  it('discovery is asked for the picked competitor (the wire has no single-material door)', async () => {
    await m.requestDiscovery('AMAZON_SA')
    expect(api.post).toHaveBeenCalledWith('PriceWatch/Matching/AMAZON_SA/Discovery', {})
  })
})

describe('a MINDSITE-origin candidate is labelled "suggested by Mindsite", and others are not (BO 4135, GUESSED)', () => {
  it.each([
    [{ origin: 'MINDSITE' }, true],
    [{ candidateOrigin: 'MINDSITE' }, true],
    [{ origin: 'SCRAPER' }, false],
    [{ origin: 'mindsite' }, false],
    [{}, false],
  ] as const)('origin %j → %s', (over, labelled) => {
    expect(m.suggestedByMindsite(candidate(over))).toBe(labelled)
  })

  it('draws the label on a Mindsite suggestion only, in en and ar', async () => {
    const { CandidateSide } = await import('./MatchingTab')
    const shown = draw(createElement(CandidateSide, { candidate: candidate({ origin: 'MINDSITE' }) }))
    expect(shown).toContain('data-mindsite-suggested=""')
    expect(shown).toContain('Suggested by Mindsite')
    expect(draw(createElement(CandidateSide, { candidate: candidate({ origin: 'MINDSITE' }) }), 'ar')).toContain('data-mindsite-suggested=""')
    for (const over of [{ origin: 'SCRAPER' }, {}]) {
      const html = draw(createElement(CandidateSide, { candidate: candidate(over) }))
      expect(html).not.toContain('data-mindsite-suggested')
      expect(html).not.toContain('Mindsite')
    }
  })

  it('shows both sides: image, title, size and barcodes', async () => {
    const { CandidateSide, OurSide } = await import('./MatchingTab')
    const theirs = draw(createElement(CandidateSide, { candidate: candidate() }))
    expect(theirs).toContain('src="https://cdn.example.com/panadol.jpg"')
    expect(theirs).toContain('Panadol Extra 24 tablets')
    expect(theirs).toContain('24 tablets')
    expect(theirs).toContain('6291100080012')
    const ours = draw(createElement(OurSide, { item: item('100000001', []) }))
    expect(ours).toContain('PANADOL EXTRA 24 TAB')
    expect(ours).toContain('6291100080012')
    expect(ours).toContain('100000001')
    expect(ours).toContain('No image') // our side carries no product image today
  })
})

const COVERAGE = [
  { competitorCode: 'NAHDI', competitorName: 'Nahdi', watched: 500, exact: 300, comparable: 20, notCarried: 5, open: 175 },
  { competitorCode: 'AMAZON_SA', competitorName: 'Amazon SA', watched: 500, exact: 120, comparable: 30, notCarried: 10, open: 340 },
]

describe('coverage shows the three counts per competitor', () => {
  it('matched is exact plus comparable; not carried and still open as given', () => {
    expect(m.coverageView(COVERAGE[0])).toEqual({ competitorCode: 'NAHDI', competitorName: 'Nahdi', watched: 500, matched: 320, notCarried: 5, open: 175 })
  })

  it('draws one row per competitor with matched, not carried and still open', async () => {
    const { CoverageTable } = await import('./MatchingTab')
    const html = draw(createElement(CoverageTable, { rows: COVERAGE, picked: 'NAHDI' }))
    expect(html).toContain('Matched')
    expect(html).toContain('Not carried')
    expect(html).toContain('Still open')
    const row = (code: string) => html.match(new RegExp(`<tr[^>]*data-coverage-row="${code}"[\\s\\S]*?</tr>`))?.[0] ?? ''
    expect(row('NAHDI')).toMatch(/data-coverage-matched="320"[\s\S]*data-coverage-not-carried="5"[\s\S]*data-coverage-open="175"/)
    expect(row('AMAZON_SA')).toMatch(/data-coverage-matched="150"[\s\S]*data-coverage-not-carried="10"[\s\S]*data-coverage-open="340"/)
  })
})

describe('the actions need the Manage grant', () => {
  const queue = {
    competitorCode: 'NAHDI',
    competitorName: 'Nahdi',
    open: 175,
    items: [item('100000001', [candidate({ candidateId: 'C-1a', origin: 'MINDSITE' })]), item('100000002', [])],
  }
  /** The whole tab, its permissions answer, coverage and the first competitor's queue seeded in the query cache. */
  const tab = async (screens: string[]) => {
    const { QueryClient, QueryClientProvider } = await import('@tanstack/react-query')
    const { PERMISSIONS_KEY } = await import('@/core/permissions')
    const { default: MatchingTab, COVERAGE_KEY, queueKey } = await import('./MatchingTab')
    const client = new QueryClient()
    client.setQueryData(PERMISSIONS_KEY, { screens, extras: {}, version: 'v' })
    client.setQueryData(COVERAGE_KEY, COVERAGE)
    client.setQueryData(queueKey('NAHDI'), queue)
    return draw(createElement(QueryClientProvider, { client }, createElement(MatchingTab)))
  }

  it('hides every action, confirm by URL and discovery without Manage — the queue and coverage still show', async () => {
    const html = await tab(['PriceWatch:03'])
    expect(html).toContain('data-queue-item="100000001"')
    expect(html).toContain('data-queue-candidate="C-1a"')
    expect(html).toContain('data-coverage-row="NAHDI"')
    expect(html).not.toContain('data-matching-action')
    expect(html).not.toContain('data-matching-url')
    expect(html).not.toContain('data-matching-discovery')
  })

  it('offers the four actions, confirm by URL and discovery with Manage, on the first material in sales order', async () => {
    const html = await tab(['PriceWatch:03', 'PriceWatch:06'])
    for (const action of ['exact', 'comparable', 'notTheSame', 'notCarried']) expect(html).toContain(`data-matching-action="${action}"`)
    expect(html).toContain('data-matching-url-form=""')
    expect(html).toContain('data-matching-discovery=""')
    expect(html).toContain('data-mindsite-suggested=""')
    expect(html).not.toContain('data-queue-item="100000002"')
  })

  it('a material with no candidate offers only Not carried and confirm by URL', async () => {
    const { QueueCard } = await import('./MatchingTab')
    const html = draw(
      createElement(QueueCard, { pair: { item: item('100000002', []), candidate: null }, canManage: true, busy: false, onDecide: () => {}, onConfirmUrl: () => {} }),
    )
    expect(html).toContain('data-queue-no-candidate=""')
    expect(html).toContain('data-matching-action="notCarried"')
    expect(html).not.toContain('data-matching-action="exact"')
    expect(html).toContain('data-matching-url-form=""')
  })
})

describe('the Matching tab’s words', () => {
  it.each([en, ar])('hold every key the tab builds', async (locale) => {
    const { hasLocaleKey } = await import('@/core/test/locale')
    const keys = [
      ...m.MATCHING_ACTIONS.map((a) => `matching.action.${a}`),
      ...m.MATCHING_ACTIONS.map((a) => `matching.done.${a}`),
      'matching.done.confirmed',
      ...['required', 'notHttps', 'tooLong'].map((p) => `matching.url.problem.${p}`),
    ]
    for (const key of keys) expect([key, hasLocaleKey(locale, key)]).toEqual([key, true])
  })
})

describe('the sales rank sentence isolates its value, not the whole sentence (review fix)', () => {
  it('wraps only the rank in an isolate; the sentence keeps its own direction', async () => {
    const { OurSide } = await import('./MatchingTab')
    const html = draw(createElement(OurSide, { item: item('100000001', [], { salesRank: 12 }) }))
    expect(html).toContain('Sales rank ⁨12⁩')
    expect(html).not.toMatch(/<bdi dir="ltr">Sales rank/)
  })
})

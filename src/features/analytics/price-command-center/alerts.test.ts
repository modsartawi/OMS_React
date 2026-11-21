/**
 * oms 934 (BackOffice spec 4127, decision 8) — the Alerts tab: Mine is the default and the list is ranked by value at risk;
 * a price alert whose cost floor is NOT_SET recommends nothing ("awaiting cost") and never gives a profitability verdict;
 * Dismiss refuses to send without a reason, and OTHER without a note; Accept / Dismiss need the Manage grant.
 * Components are rendered as static markup through a real i18next instance (en and ar); the network is stubbed at the
 * `@/core/api` boundary.
 */
import { createElement, type ReactElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import i18next from 'i18next'
import { I18nextProvider } from 'react-i18next'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/core/api'
import type { PriceAlertView } from '@/core/models/price-watch'
import { PERMISSIONS_KEY } from '@/core/permissions'
import en from '@/locales/en/price-command-center.json'
import ar from '@/locales/ar/price-command-center.json'

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }))
vi.mock('@/core/api', async (actual) => ({ ...(await actual<typeof import('@/core/api')>()), api }))

const { priceAlertsApi } = await import('./api')
const al = await import('./alerts')
const { default: AlertsTab, AlertFilters, AlertsTable } = await import('./AlertsTab')
const { DismissDialogView } = await import('./DismissDialog')

const NS = 'price-command-center'
const draw = (element: ReactElement, lng: 'en' | 'ar' = 'en') => {
  const i18n = i18next.createInstance()
  i18n.init({ lng, resources: { [lng]: { [NS]: lng === 'en' ? en : ar } }, ns: [NS], defaultNS: NS, initAsync: false, interpolation: { escapeValue: false } })
  return renderToStaticMarkup(createElement(I18nextProvider, { i18n }, element))
}

const alert = (over: Partial<PriceAlertView> = {}): PriceAlertView => ({
  alertId: 'A-1',
  materialNumber: '100012345',
  competitorCode: 'NAHDI',
  matchId: 'M-1',
  listingId: 'L-1',
  status: 'OPEN',
  isLive: true,
  categoryCode: 'A004',
  thresholdPercent: 5,
  currency: 'SAR',
  ourBasicPrice: 25,
  ourEffectivePrice: 22.5,
  ourPriceDay: '2026-11-21',
  theirRegularPrice: 21,
  theirOfferPrice: 19.95,
  theirPrice: 19.95,
  sellerName: 'Nahdi Online',
  observedAt: '2026-11-21T08:15:00',
  previousObservedAt: null,
  gapAmount: 2.55,
  gapPercent: 11.33,
  thirtyDayUnits: 400,
  unitsSource: 'SALES',
  valueAtRisk: 1020,
  recommendedPrice: 19.95,
  recommendedFrom: 'NAHDI',
  floorStatus: 'NOT_SET',
  floorText: 'floor not set',
  openedAt: '2026-11-21T08:20:00',
  updatedAt: '2026-11-21T08:20:00',
  resolvedAt: null,
  resolvedReason: '',
  dismissedAtGapPercent: 0,
  categoryManager: 'CM01',
  ownerUserId: 'msartawi',
  ...over,
})

beforeEach(() => {
  api.get.mockReset().mockResolvedValue([])
  api.post.mockReset().mockResolvedValue(alert())
})

describe('Mine is the default and the list is ranked by value at risk', () => {
  it('the default filter reads the caller’s own price alerts, live', async () => {
    expect(al.DEFAULT_ALERT_FILTER.scope).toBe('mine')
    const { scope, query } = al.alertsRequest(al.DEFAULT_ALERT_FILTER)
    await priceAlertsApi.list(scope, query)
    expect(api.get).toHaveBeenCalledWith('PriceWatch/Alerts/Mine', { status: 'live' })
  })

  it('All reads every price alert, with the A-level and competitor filters the wire supports', async () => {
    const { scope, query } = al.alertsRequest({ scope: 'all', state: 'resolved', category: ' A004 ', competitor: 'NAHDI' })
    await priceAlertsApi.list(scope, query)
    expect(api.get).toHaveBeenCalledWith('PriceWatch/Alerts', { status: 'resolved', category: 'A004', competitor: 'NAHDI' })
  })

  it('a live state narrows client-side: open, accepted and dismissed read the live list', () => {
    expect(al.alertsRequest({ ...al.DEFAULT_ALERT_FILTER, state: 'dismissed' }).query.status).toBe('live')
    const rows = [alert({ alertId: 'o' }), alert({ alertId: 'a', status: 'ACCEPTED' }), alert({ alertId: 'd', status: 'DISMISSED' })]
    expect(al.shownAlerts(rows, 'accepted').map((r) => r.alertId)).toEqual(['a'])
    expect(al.shownAlerts(rows, 'live').map((r) => r.alertId)).toEqual(['a', 'd', 'o']) // equal value at risk and gap: by id
  })

  it('ranks by value at risk, then gap, then id — whatever order the rows arrive in', () => {
    const rows = [
      alert({ alertId: 'small', valueAtRisk: 50 }),
      alert({ alertId: 'big', valueAtRisk: 5000 }),
      alert({ alertId: 'tie-b', valueAtRisk: 900, gapPercent: 8 }),
      alert({ alertId: 'tie-a', valueAtRisk: 900, gapPercent: 12 }),
    ]
    expect(al.shownAlerts(rows, 'all').map((r) => r.alertId)).toEqual(['big', 'tie-a', 'tie-b', 'small'])
  })

  it('draws the rows in that order, with Mine marked as the open scope', () => {
    const rows = [alert({ alertId: 'small', valueAtRisk: 50 }), alert({ alertId: 'big', valueAtRisk: 5000 })]
    const html = draw(createElement(AlertsTable, { rows: al.shownAlerts(rows, 'live'), canManage: false, onAccept: () => {}, onDismiss: () => {}, busyId: null }))
    expect(html.indexOf('data-alert-row="big"')).toBeLessThan(html.indexOf('data-alert-row="small"'))
    const filters = draw(createElement(AlertFilters, { filter: al.DEFAULT_ALERT_FILTER, competitors: [], onChange: () => {} }))
    expect(filters).toMatch(/data-alert-scope="mine"[^>]*aria-pressed="true"|aria-pressed="true"[^>]*data-alert-scope="mine"/)
  })
})

describe('a price alert whose cost floor is not set', () => {
  it('recommends nothing: awaiting cost, with the lowest competitor price as a fact', () => {
    expect(al.recommendedView(alert())).toEqual({ kind: 'awaitingCost', lowestPrice: 19.95, lowestFrom: 'NAHDI' })
  })

  it('shows "awaiting cost" and never a profitability verdict, nor the server’s English floor text', () => {
    for (const lng of ['en', 'ar'] as const) {
      const html = draw(createElement(AlertsTable, { rows: [alert()], canManage: true, onAccept: () => {}, onDismiss: () => {}, busyId: null }), lng)
      expect(html).toContain('data-alert-recommended="awaiting-cost"')
      expect(html).toContain(lng === 'en' ? 'Awaiting cost' : 'بانتظار التكلفة')
      expect(html).not.toMatch(/profitab|can.t match|floor not set/i)
    }
    // No sentence of the namespace can give the verdict, so no state of the screen can draw it.
    expect(JSON.stringify(en)).not.toMatch(/profitab|can.t match/i)
  })
})

describe('dismiss refuses to send without a reason, and OTHER without a note', () => {
  it.each([
    ['', '', 'reasonRequired'],
    ['', 'a note alone is no reason', 'reasonRequired'],
    ['OTHER', '', 'noteRequired'],
    ['OTHER', '   ', 'noteRequired'],
    ['OTHER', 'x'.repeat(501), 'noteTooLong'],
    ['FLASH_SALE', 'x'.repeat(501), 'noteTooLong'],
    ['OTHER', 'Supplier promo ends Friday', null],
    ['FLASH_SALE', '', null],
    ['WRONG_MATCH', '', null],
    ['STRATEGIC', '', null],
  ] as const)('reason %j, note %j → %s', (reason, note, problem) => {
    expect(al.dismissProblem(reason, note)).toBe(problem)
  })

  it('sends the note trimmed', () => {
    expect(al.dismissBody('OTHER', '  Supplier promo  ')).toEqual({ reason: 'OTHER', note: 'Supplier promo' })
  })

  const dialog = (reason: string, note: string, lng: 'en' | 'ar' = 'en') =>
    draw(
      createElement(DismissDialogView, {
        alert: alert(),
        reason,
        note,
        busy: false,
        error: null,
        onReason: () => {},
        onNote: () => {},
        onConfirm: () => {},
        onClose: () => {},
      }),
      lng,
    )
  const confirm = (html: string) => html.match(/<button[^>]*data-dismiss-confirm=""[^>]*>/)?.[0] ?? ''

  it('keeps Dismiss disabled with no reason, and says why', () => {
    const html = dialog('', '')
    expect(confirm(html)).toContain(' disabled=""')
    expect(html).toContain('Pick a reason.')
  })

  it('keeps Dismiss disabled on OTHER with no note, and says why', () => {
    const html = dialog('OTHER', '')
    expect(confirm(html)).toContain(' disabled=""')
    expect(html).toContain('Other needs a note.')
    expect(dialog('OTHER', '', 'ar')).toContain('خيار أخرى يحتاج إلى ملاحظة.')
  })

  it('enables Dismiss once the reason holds, and warns that a wrong product match is broken too', () => {
    expect(confirm(dialog('FLASH_SALE', ''))).not.toContain(' disabled=""')
    expect(confirm(dialog('OTHER', 'Supplier promo'))).not.toContain(' disabled=""')
    expect(dialog('WRONG_MATCH', '')).toContain('Also breaks the product match')
  })

  it('shows the server’s refusal with its code', () => {
    const msg = 'A note is required when the reason is OTHER.'
    const html = draw(
      createElement(DismissDialogView, {
        alert: alert(),
        reason: 'OTHER',
        note: 'x',
        busy: false,
        error: new ApiError('business', msg, 400, [{ errorMessage: msg, errorCode: 'PWT-00037', internalErrorCode: '' }]),
        onReason: () => {},
        onNote: () => {},
        onConfirm: () => {},
        onClose: () => {},
      }),
    )
    expect(html).toContain(msg)
    expect(html).toContain('data-dismiss-refusal="PWT-00037"')
  })
})

describe('accept and dismiss need the Manage grant', () => {
  const open = alert({ alertId: 'open', valueAtRisk: 900 })
  const taken = alert({ alertId: 'taken', status: 'ACCEPTED', valueAtRisk: 50 })
  /** The whole tab, its permissions answer and its Mine list seeded in the query cache. */
  const tab = (screens: string[]) => {
    const client = new QueryClient()
    client.setQueryData(PERMISSIONS_KEY, { screens, extras: {}, version: 'v' })
    client.setQueryData(['price-watch', 'alerts', 'mine', { status: 'live' }], [taken, open])
    client.setQueryData(['price-watch', 'coverage'], [])
    return draw(createElement(QueryClientProvider, { client }, createElement(AlertsTab)))
  }

  it('hides Accept and Dismiss without the Manage grant — the price alerts still show', () => {
    const html = tab(['PriceWatch:03'])
    expect(html).toContain('data-alert-row="open"')
    expect(html).not.toContain('data-alert-accept')
    expect(html).not.toContain('data-alert-dismiss')
  })

  it('offers Accept and Dismiss with the Manage grant, on an open price alert only', () => {
    const html = tab(['PriceWatch:03', 'PriceWatch:06'])
    expect(html).toContain('data-alert-accept="open"')
    expect(html).toContain('data-alert-dismiss="open"')
    expect(html).not.toContain('data-alert-accept="taken"')
    expect(html).not.toContain('data-alert-dismiss="taken"')
  })
})

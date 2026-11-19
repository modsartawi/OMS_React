import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import '@/core/i18n'
import enMinipos from '@/locales/en/minipos.json'
import arMinipos from '@/locales/ar/minipos.json'
import type { SessionState } from '@/core/models/callcenter'
import { hasLocaleKey } from '@/core/test/locale'
import BasketScreen from './BasketScreen'
import { code128Bars } from './code128'
import SubmittedScreen from './SubmittedScreen'
import type { ShownRefusal } from './refusal'

// Ticket 916 proof (component): the refusal is shown in the server's two languages, and the submitted screen draws
// the order number as a barcode. Static markup in node, as the repo's other component tests (no DOM, no effects).

const state = (lines: Partial<SessionState['lines'][number]>[] = []): SessionState =>
  ({
    contractVersion: '1.1',
    transactionId: 'T1',
    version: 3,
    etag: 'e3',
    status: 'open',
    replayed: false,
    header: { plant: 'S001', plantName: 'Al Olaya', customer: null } as unknown as SessionState['header'],
    lines: lines.map((l, i) => ({
      lineId: `L${i}`,
      itemNumber: '100045',
      description: 'Sunscreen SPF50',
      qty: 1,
      unitPrice: { net: 40, gross: 46 },
      lineTotal: { net: 40, gross: 46 },
      ...l,
    })) as SessionState['lines'],
    totals: { net: 40, vat: 6, gross: 46, payable: 46 } as SessionState['totals'],
    firedPromotions: [],
    nearMisses: [],
    pendingConfirmation: null,
    capabilities: { canSubmit: true } as SessionState['capabilities'],
  }) as SessionState

const noop = () => {}

const basket = (refusal: ShownRefusal | null, s = state([{}])) =>
  renderToStaticMarkup(
    createElement(BasketScreen, {
      state: s,
      busy: false,
      refusal,
      belowStock: false,
      customerSlot: null,
      onScan: noop,
      onKeyed: noop,
      onQty: noop,
      onRemove: noop,
      onSubmit: noop,
      onAbandon: noop,
      onAddAnyway: noop,
      onDontAdd: noop,
    }),
  )

describe('a refusal is shown on the basket, in the server’s words', () => {
  const pharmacistOnly: ShownRefusal = {
    code: 'MINIPOS_ITEM_PHARMACIST_ONLY',
    english: 'Sold by the pharmacist, please direct the customer to the counter.',
    arabic: 'يُباع عن طريق الصيدلي، يرجى توجيه العميل إلى الكاونتر.',
  }

  it('English and Arabic, each isolated in its own direction, as an alert', () => {
    const html = basket(pharmacistOnly)
    expect(html).toMatch(/role="alert"[^>]*data-refusal="MINIPOS_ITEM_PHARMACIST_ONLY"/)
    expect(html).toContain('<bdi dir="ltr">Sold by the pharmacist, please direct the customer to the counter.</bdi>')
    expect(html).toContain('<bdi dir="rtl">يُباع عن طريق الصيدلي، يرجى توجيه العميل إلى الكاونتر.</bdi>')
  })

  it('a refusal with English only draws no empty Arabic line', () => {
    const html = basket({ code: 'NO_CUSTOMER_ATTACHED', english: 'Attach a customer first.', arabic: null })
    expect(html).toContain('Attach a customer first.')
    expect(html).not.toContain('lang="ar"')
  })

  it('no refusal, no alert; the basket keeps its line and the server’s total', () => {
    const html = basket(null)
    expect(html).not.toContain('role="alert"')
    expect(html).toContain('data-line="100045"')
    expect(html).toContain('46.00')
  })
})

describe('the submitted screen shows the order number as a barcode', () => {
  it('the barcode encodes the number, with one bar per Code 128 bar, and the digits are shown under it', () => {
    const html = renderToStaticMarkup(createElement(SubmittedScreen, { documentNo: '1000001181', onNewBasket: noop }))
    expect(html).toMatch(/<svg[^>]*role="img"[^>]*data-barcode="1000001181"/)
    expect(html.match(/<rect /g)).toHaveLength(code128Bars('1000001181').length)
    expect(html).toContain('data-order-no="1000001181"')
    expect(html).toContain('<bdi dir="ltr">1000001181</bdi>')
  })
})

describe('the phone’s words exist in both languages', () => {
  const leaves = (node: unknown, prefix = ''): string[] =>
    Object.entries(node as Record<string, unknown>).flatMap(([k, v]) =>
      typeof v === 'string' ? [prefix + k] : leaves(v, `${prefix}${k}.`),
    )

  it('every English key has its Arabic, and no Arabic key is stray', () => {
    const en = leaves(enMinipos)
    for (const key of en) expect(hasLocaleKey(arMinipos, key), key).toBe(true)
    expect(leaves(arMinipos).sort()).toEqual(en.sort())
  })
})

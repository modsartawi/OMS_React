import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, expect, it } from 'vitest'
import '@/core/i18n'
import { ApiError } from '@/core/api'
import type { SessionState } from '@/core/models/callcenter'
import { MEMBER_NOT_FOUND, miniPosApi, type MiniPosOrder } from './api'
import BasketScreen from './BasketScreen'
import CustomerScreen from './CustomerScreen'
import CustomerSlot from './CustomerSlot'
import { basketView, createSubmitGuard, isNoConnection } from './flow'
import OrdersScreen, { offersEdit } from './OrdersScreen'
import { readRefusal, withPhoneArabic, type ShownRefusal } from './refusal'

// Ticket 917 proof (component): the customer is required before the basket; a reopen refused while a till holds the
// order shows the server's refusal; no double submit, offline or not. Static markup in node, as the repo's other
// component tests (no DOM, no effects); the rules behind the screens are pure and tested directly.

const customer = { customerId: 'L77', name: 'Sara Al-Qahtani', mobile: '0551234567', loyaltyAttached: true }

const state = (withCustomer: boolean, lineCount = 1): SessionState =>
  ({
    contractVersion: '1.1',
    transactionId: 'T1',
    version: 3,
    etag: 'e3',
    status: 'open',
    replayed: false,
    header: { plant: 'S001', plantName: 'Al Olaya', customer: withCustomer ? customer : null } as unknown as SessionState['header'],
    lines: Array.from({ length: lineCount }, (_, i) => ({
      lineId: `L${i}`,
      itemNumber: '100045',
      description: 'Sunscreen SPF50',
      qty: 1,
      unitPrice: { net: 40, gross: 46 },
      lineTotal: { net: 40, gross: 46 },
    })) as SessionState['lines'],
    totals: { net: 40, vat: 6, gross: 46, payable: 46 } as SessionState['totals'],
    firedPromotions: [],
    nearMisses: [],
    pendingConfirmation: null,
    capabilities: { canSubmit: true } as SessionState['capabilities'],
  }) as SessionState

const noop = () => {}
const refusal = (code: string, status: number, en: string, ar: string | null = null) =>
  new ApiError('business', en, status, [{ errorCode: code, internalErrorCode: '', errorMessage: en }], ar ? { messageEn: en, messageAr: ar } : null)
const network = () => new ApiError('network', 'Network error', 0)

const withQueries = (el: ReturnType<typeof createElement>) =>
  renderToStaticMarkup(createElement(QueryClientProvider, { client: new QueryClient() }, el))

describe('the customer is required before the basket', () => {
  it('a session with no customer shows the customer step; one with a member shows the basket', () => {
    expect(basketView(state(false))).toBe('customer')
    expect(basketView(state(true))).toBe('basket')
  })

  it('the customer step offers the mobile and the Arbahi QR, and no basket (no scan of an item, no submit)', () => {
    const html = withQueries(
      createElement(CustomerScreen, { attaching: false, refusal: null, noConnection: false, found: null, onMember: noop, onAbandon: noop }),
    )
    expect(html).toContain('data-screen="customer"')
    expect(html).toContain('type="tel"')
    expect(html).toContain('Arbahi app QR')
    expect(html).not.toContain('data-submit')
    expect(html).not.toContain('Barcode or item number')
  })

  it('the server’s English-only no-customer refusal is shown with the phone’s own Arabic line', () => {
    const shown = withPhoneArabic(readRefusal(refusal('NO_CUSTOMER_ATTACHED', 409, 'Attach a customer first.'), 'x'), () => 'أضف العميل أولاً')
    expect(shown).toEqual({ code: 'NO_CUSTOMER_ATTACHED', english: 'Attach a customer first.', arabic: 'أضف العميل أولاً' })
    // Any other English-only refusal keeps the server's words alone.
    const other = withPhoneArabic(readRefusal(refusal('SESSION_BUSY', 409, 'Busy.'), 'x'), () => 'never')
    expect(other.arabic).toBeNull()
  })

  it('once attached, the basket shows the member’s name, and the tier of the member the phone found', () => {
    const member = { loyId: 'L77', mobile: '0551234567', fullName: 'Sara Al-Qahtani', tier: 'Gold', pointsBalance: 10, email: null }
    const html = renderToStaticMarkup(createElement(CustomerSlot, { state: state(true), member }))
    expect(html).toContain('data-customer="L77"')
    expect(html).toContain('<bdi class="font-medium">Sara Al-Qahtani</bdi>')
    expect(html).toContain('<bdi>Gold</bdi>')
    // A found member who is not the one on the order lends it no tier (a reopened order's customer is the server's).
    const other = renderToStaticMarkup(createElement(CustomerSlot, { state: state(true), member: { ...member, loyId: 'L99' } }))
    expect(other).not.toContain('data-tier')
  })
})

describe('the member lookup reads "not a member" as absence, not as a failure', () => {
  it('LOY-00100 → null (the sign-up is offered); any other refusal is thrown to be shown', async () => {
    const original = globalThis.fetch
    const answer = (code: string) =>
      new Response(JSON.stringify({ statusCode: 404, success: false, message: 'm', errors: [{ errorCode: code, errorMessage: 'm' }], data: null }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      })
    try {
      globalThis.fetch = (async () => answer(MEMBER_NOT_FOUND)) as typeof fetch
      expect(await miniPosApi.memberByMobile('0551234567')).toBeNull()
      globalThis.fetch = (async () => answer('LOY-00999')) as typeof fetch
      await expect(miniPosApi.memberByMobile('0551234567')).rejects.toBeInstanceOf(ApiError)
    } finally {
      globalThis.fetch = original
    }
  })
})

describe('my orders today: a reopen refused while a till holds the order', () => {
  const orders: MiniPosOrder[] = [
    { documentNo: '1000001190', status: 'held', enteredAt: '2026-11-19T10:12:00', netTotal: 46, storeCode: 'S001', customerId: 'L77' },
    { documentNo: '1000001181', status: 'open', enteredAt: '2026-11-19T09:05:00', netTotal: 92, storeCode: 'S001', customerId: 'L77' },
    { documentNo: '1000001170', status: 'paid', enteredAt: '2026-11-19T08:41:00', netTotal: 23, storeCode: 'S001', customerId: 'L12' },
    { documentNo: '1000001160', status: 'closed', enteredAt: '2026-11-19T08:02:00', netTotal: 10, storeCode: 'S001', customerId: 'L12' },
  ]
  const atTill: ShownRefusal = readRefusal(
    refusal('MINIPOS_ORDER_AT_TILL', 409, 'This order is open at a till. Ask the cashier to cancel it first.', 'هذا الطلب مفتوح لدى الكاشير.'),
    'x',
  )
  const render = (r: ShownRefusal | null, noConnection = false) =>
    renderToStaticMarkup(
      createElement(OrdersScreen, { orders, loading: false, refusal: r, noConnection, reopening: null, onReopen: noop, onRefresh: noop, onBack: noop }),
    )

  it('each order shows the status the server gave it', () => {
    const html = render(null)
    expect(html).toMatch(/data-order="1000001190" data-status="held"/)
    expect(html).toContain('At a till')
    expect(html).toContain('Open')
    expect(html).toContain('Paid')
    expect(html).toContain('Closed')
  })

  it('edit is offered on open and held orders only; paid and closed are past editing', () => {
    expect(orders.filter(offersEdit).map((o) => o.documentNo)).toEqual(['1000001190', '1000001181'])
  })

  it('the refusal is shown in the server’s two languages, over the list', () => {
    const html = render(atTill)
    expect(html).toMatch(/role="alert"[^>]*data-refusal="MINIPOS_ORDER_AT_TILL"/)
    expect(html).toContain('<bdi dir="ltr">This order is open at a till. Ask the cashier to cancel it first.</bdi>')
    expect(html).toContain('<bdi dir="rtl">هذا الطلب مفتوح لدى الكاشير.</bdi>')
  })
})

describe('no double submit, offline or not', () => {
  it('a second tap while a submit is in flight sends nothing', () => {
    const guard = createSubmitGuard(() => 'R1')
    expect(guard.begin('T1')).toBe('R1')
    expect(guard.begin('T1')).toBeNull()
  })

  it('a submit lost to the connection is retried with the SAME request id (the server replays it, never mints twice)', () => {
    let n = 0
    const guard = createSubmitGuard(() => `R${++n}`)
    expect(guard.begin('T1')).toBe('R1')
    guard.end('noConnection')
    expect(guard.begin('T1')).toBe('R1')
  })

  it('a submit the server answered is done: the next is a new action with a new id', () => {
    let n = 0
    const guard = createSubmitGuard(() => `R${++n}`)
    guard.begin('T1')
    guard.end('refused')
    expect(guard.begin('T1')).toBe('R2')
    guard.end('done')
    expect(guard.begin('T2')).toBe('R3')
  })

  it('only a call that never reached the server is "no connection"', () => {
    expect(isNoConnection(network())).toBe(true)
    expect(isNoConnection(refusal('MINIPOS_ORDER_PAID', 409, 'Paid.'))).toBe(false)
    expect(isNoConnection(new Error('boom'))).toBe(false)
  })

  const basket = (offline: boolean, editing: string | null = null) =>
    renderToStaticMarkup(
      createElement(BasketScreen, {
        state: state(true),
        busy: false,
        refusal: null,
        belowStock: false,
        editing,
        offline,
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
  const submitButton = (html: string) => /<button[^>]*data-submit[^>]*>/.exec(html)?.[0] ?? ''

  it('offline, the basket says "no connection" and its submit is held', () => {
    const html = basket(true)
    expect(html).toContain('data-screen="no-connection"')
    expect(submitButton(html)).toContain(' disabled=""')
  })

  it('online, submit is open; a reopened order’s basket resubmits it under its number', () => {
    expect(submitButton(basket(false))).not.toContain(' disabled=""')
    const editing = basket(false, '1000001181')
    expect(editing).toContain('data-editing="1000001181"')
    expect(editing).toContain('Resubmit order')
    expect(editing).not.toContain('data-screen="no-connection"')
  })
})

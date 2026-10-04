/**
 * The order header as a sentence over a ledger (spec 380 C3–C6, ticket 408), asserted at
 * its edge: the session in, the words of each line out — and the sentence keys rendered
 * through react-i18next's `<Trans components>` on the repo's own i18next.
 *
 * Every state below is set by the test from the open fixture's shape (CONTRACT.md §11 —
 * a fixture value is never evidence).
 */
import { createElement, type ReactElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import i18next from 'i18next'
import { Trans } from 'react-i18next'
import { describe, expect, it } from 'vitest'
import type { SessionState } from '@/core/models/callcenter'
import callcenter from '@/locales/en/callcenter.json'
import { EMPTY_SESSION } from './__fixtures__/payloads'
import { headerSentence, SENTENCE_KEY, wordTag, type HeaderWord } from './header-sentence'

/** A delivery order with every sentence fact present — a caller, an address, a window. */
const DELIVERING: SessionState = {
  ...EMPTY_SESSION,
  header: {
    ...EMPTY_SESSION.header,
    deliveryType: 'Delivery',
    plant: '1101',
    plantName: 'Al Malqa',
    plantSource: 'derivedFromAddress',
    customer: { customerId: 'C-1', name: 'فاطمة العتيبي', mobile: '966501076360', loyaltyAttached: true },
    address: {
      addressNumber: 'A1',
      label: 'Home',
      cityCode: 'RUH',
      cityName: 'Riyadh',
      districtCode: 'MLQ',
      districtName: 'Al Malqa',
      line: 'Anas Ibn Malik Rd',
    },
    slot: { slotId: 'S1', from: '18:00', to: '21:00', isActive: true },
    documentSource: 'CLCN',
    sourceReference: 'CRM-889231',
    orderNote: 'Call before arrival',
    coupons: [],
  },
  capabilities: { ...EMPTY_SESSION.capabilities, canOpenAddressBook: true, submitBlockers: [] },
}

/** The same order, collected. */
const COLLECTING: SessionState = {
  ...DELIVERING,
  header: { ...DELIVERING.header, deliveryType: 'PickInStore', address: null, slot: null },
}

const byId = (words: HeaderWord[]) => Object.fromEntries(words.map((w) => [w.id, w]))

describe('headerSentence — one shape per mode (C3)', () => {
  it('🚩 delivery has the address and the window; collection drops both and makes the store a control', () => {
    const delivery = headerSentence(DELIVERING)
    expect(delivery.shape).toBe('delivery')
    expect(delivery.words.map((w) => w.id)).toEqual(['fulfilment', 'address', 'caller', 'store', 'slot', 'payment'])
    const d = byId(delivery.words)
    expect(d.address.value).toBe('Home · Al Malqa · Riyadh')
    expect(d.slot.value).toBe('18:00–21:00')
    // On a delivery order the store follows the address — a readout, never a control.
    expect(d.store.control).toBe(false)
    expect(d.store.look).toBe('readout')
    expect(d.store.follows).toBe(true)

    const collection = headerSentence(COLLECTING)
    expect(collection.shape).toBe('collection')
    // Absent, not disabled (176): the address and the window leave the sentence.
    expect(collection.words.map((w) => w.id)).toEqual(['fulfilment', 'store', 'caller', 'payment'])
    const c = byId(collection.words)
    expect(c.store.control).toBe(true)
    expect(c.store.look).toBe('settled')
    expect(c.store.follows).toBeUndefined()
  })

  it('names the mode and the payment with their own words, which follow the mode', () => {
    expect(byId(headerSentence(DELIVERING).words).fulfilment.valueKey).toBe('sentence.mode.delivery')
    expect(byId(headerSentence(DELIVERING).words).payment.valueKey).toBe('sentence.payment.cashOnDelivery')
    expect(byId(headerSentence(COLLECTING).words).fulfilment.valueKey).toBe('sentence.mode.pickInStore')
    expect(byId(headerSentence(COLLECTING).words).payment.valueKey).toBe('sentence.payment.payOnCollection')
  })

  it('the ledger carries Source · Ref · Coupon · Note, in that order, in both modes', () => {
    for (const state of [DELIVERING, COLLECTING])
      expect(headerSentence(state).ledger.map((w) => w.id)).toEqual(['source', 'reference', 'coupon', 'note'])
  })

  it('the store readout says it follows the address only while the order is open', () => {
    const placed = headerSentence({ ...DELIVERING, status: 'submitted' })
    expect(byId(placed.words).store.look).toBe('readout')
    expect(byId(placed.words).store.follows).toBeUndefined()
  })
})

describe('headerSentence — slot looks (C4)', () => {
  it('🚩 settled, blocked from submitBlockers, ghost when optional and empty, readout for the caller and the delivery store', () => {
    const settled = byId([...headerSentence(DELIVERING).words, ...headerSentence(DELIVERING).ledger])
    expect(settled.address.look).toBe('settled')
    expect(settled.slot.look).toBe('settled')
    expect(settled.source.look).toBe('settled')
    expect(settled.note.look).toBe('settled')
    expect(settled.caller.look).toBe('readout')
    expect(settled.caller.control).toBe(false)
    expect(settled.store.look).toBe('readout')

    // Blocked comes from the server's list and only from it — even over a value.
    const blocked = headerSentence({
      ...DELIVERING,
      header: { ...DELIVERING.header, slot: null, sourceReference: 'CRM-1' },
      capabilities: {
        ...DELIVERING.capabilities,
        submitBlockers: ['MISSING_SLOT', 'SOURCE_REFERENCE_REQUIRED', 'NO_LINES'],
      },
    })
    const b = byId([...blocked.words, ...blocked.ledger])
    expect(b.slot.look).toBe('blocked')
    expect(b.reference.look).toBe('blocked')
    expect(b.reference.value).toBe('CRM-1')
    // NO_LINES is the basket's: nothing in the sentence takes it.
    expect([...blocked.words, ...blocked.ledger].filter((w) => w.look === 'blocked').map((w) => w.id)).toEqual([
      'slot',
      'reference',
    ])

    // An empty field the server is not waiting on is optional, and reads as a ghost word.
    const empty = headerSentence({
      ...DELIVERING,
      header: { ...DELIVERING.header, documentSource: null, sourceReference: null, orderNote: '  ', coupons: [] },
    })
    const e = byId(empty.ledger)
    for (const id of ['source', 'reference', 'coupon', 'note']) expect(e[id].look, id).toBe('ghost')
    expect(e.coupon.emptyKey).toBe('ledger.addCoupon')
    expect(e.note.emptyKey).toBe('ledger.addNote')
  })

  it('the opening order: the caller and the address are blocked by the server, and the address is not a door yet', () => {
    // The capture's own list: NO_CUSTOMER and NO_ADDRESS, with no caller attached.
    const opening = byId(headerSentence(EMPTY_SESSION).words)
    expect(opening.caller.look).toBe('blocked')
    expect(opening.caller.control).toBe(false)
    expect(opening.address.look).toBe('blocked')
    // 166: the book is the caller's, so the address word opens it only once there is one.
    expect(opening.address.control).toBe(false)
    expect(byId(headerSentence(DELIVERING).words).address.control).toBe(true)
    // STORE_NOT_CHOSEN is said once, by the store word.
    expect(opening.store.look).toBe('blocked')
  })

  it('an attached caller with a blank name reads by their mobile, never "no caller yet"', () => {
    const nameless = byId(
      headerSentence({
        ...DELIVERING,
        header: { ...DELIVERING.header, customer: { ...DELIVERING.header.customer!, name: '  ' } },
      }).words,
    ).caller
    expect(nameless.value).toBe('966501076360')
    // A mobile is a machine value.
    expect(nameless.isolate).toBe('ltr')
    expect(nameless.look).toBe('readout')
  })

  it('a shut gate turns the mode word and the payment word into readouts', () => {
    const shut = byId(
      headerSentence({
        ...DELIVERING,
        capabilities: { ...DELIVERING.capabilities, canChangeFulfilment: false, canChangePaymentType: false },
      }).words,
    )
    expect(shut.fulfilment.look).toBe('readout')
    expect(shut.fulfilment.control).toBe(false)
    expect(shut.payment.look).toBe('readout')
    expect(shut.payment.control).toBe(false)
  })

  it('a lapsed window stays settled and says so', () => {
    const lapsed = byId(
      headerSentence({
        ...DELIVERING,
        header: { ...DELIVERING.header, slot: { slotId: 'S1', from: '18:00', to: '21:00', isActive: false } },
      }).words,
    )
    expect(lapsed.slot.look).toBe('settled')
    expect(lapsed.slot.lapsed).toBe(true)
  })

  it('a payment it cannot word stays a readout with no value, never a control', () => {
    const payment = byId(
      headerSentence({ ...DELIVERING, header: { ...DELIVERING.header, paymentType: 'Receivable' } }).words,
    ).payment
    expect(payment.valueKey).toBeUndefined()
    expect(payment.control).toBe(false)
    expect(payment.emptyKey).toBe('sentence.unworded')
  })

  it('isolates by kind: codes, the reference, coupons and the window left-to-right; names, the address and the note in their own direction', () => {
    const s = headerSentence(DELIVERING)
    const w = byId([...s.words, ...s.ledger])
    for (const id of ['store', 'slot', 'source', 'reference', 'coupon']) expect(w[id].isolate, id).toBe('ltr')
    for (const id of ['caller', 'address', 'note']) expect(w[id].isolate, id).toBe('auto')
  })

  it('🚩 every key a word can name exists in the callcenter bundle', () => {
    // The keys are COMPUTED, so no grep finds the call site — the guard runs over every
    // word the model can emit, in every state the tests above draw.
    const states = [DELIVERING, COLLECTING, EMPTY_SESSION, { ...DELIVERING, header: { ...DELIVERING.header, paymentType: 'Receivable' as const } }]
    const has = (key: string) =>
      key.split('.').reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], callcenter)
    for (const state of states) {
      const s = headerSentence(state)
      expect(has(SENTENCE_KEY[s.shape]), SENTENCE_KEY[s.shape]).toBeTypeOf('string')
      for (const word of [...s.words, ...s.ledger]) {
        if (word.valueKey) expect(has(word.valueKey), word.valueKey).toBeTypeOf('string')
        expect(has(word.emptyKey), word.emptyKey).toBeTypeOf('string')
      }
    }
  })
})

describe('the sentence keys under <Trans components> (C6)', () => {
  const instance = i18next.createInstance()
  instance.init({ lng: 'en', resources: { en: { callcenter } }, ns: ['callcenter'], defaultNS: 'callcenter', initAsync: false })

  /** A stand-in for each slot: its own content arrives as a PROP, because `<Trans>` drops
   *  a self-closing slot component's children. */
  const Slot = ({ name }: { name: string }) => createElement('i', { 'data-slot': name }, `[${name}]`)
  const slotsOf = (shape: 'delivery' | 'collection') =>
    Object.fromEntries(
      headerSentence(shape === 'delivery' ? DELIVERING : COLLECTING).words.map((w) => [
        wordTag(w.id),
        createElement(Slot, { name: wordTag(w.id) }),
      ]),
    ) as Record<string, ReactElement>

  const render = (key: string, components: Record<string, ReactElement>) =>
    renderToStaticMarkup(createElement(Trans, { i18n: instance, ns: 'callcenter', i18nKey: key, components }))
  const order = (html: string) => [...html.matchAll(/data-slot="([a-z]+)"/g)].map((m) => m[1])

  it('🚩 each shape key names exactly the model\'s words, each once', () => {
    for (const shape of ['delivery', 'collection'] as const) {
      const template = instance.t(SENTENCE_KEY[shape])
      const tags = [...template.matchAll(/<([a-z]+)\/>/g)].map((m) => m[1]).sort()
      expect(tags).toEqual(Object.keys(slotsOf(shape)).sort())
    }
  })

  it('renders its slots in the translation\'s order, with each slot\'s own content intact', () => {
    const english = render(SENTENCE_KEY.delivery, slotsOf('delivery'))
    expect(order(english)).toEqual(['mode', 'address', 'caller', 'store', 'window', 'payment'])
    expect(english).toContain('[caller]')
    // Template punctuation is the template's, outside every slot.
    expect(english).toMatch(/<\/i>\.$/)

    // A translation in another order renders the SAME components in ITS order — the
    // translation owns the word order, and DOM (so Tab) order follows it. (A test
    // template, not shipped copy.)
    instance.addResource('en', 'callcenter', 'test.reordered', '<caller/> — <mode/> <store/>، <payment/>.')
    const reordered = render('test.reordered', slotsOf('collection'))
    expect(order(reordered)).toEqual(['caller', 'mode', 'store', 'payment'])
    expect(render(SENTENCE_KEY.collection, slotsOf('collection'))).toMatch(/^<i data-slot="mode">\[mode\]<\/i> from /)
  })
})

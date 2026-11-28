/**
 * Ticket 984 (spec 983 D3): the step rail and the *Before you place it* checklist are
 * ONE pure read of `SessionState` plus the server's submit blockers, so neither can
 * disagree with *Place order*'s own refusal.
 *
 * Expected values are literals off the fixtures' own fields (fixture 01 is the opened
 * empty order, fixture 02 the attached, half-done one), never re-derived the way the
 * module derives them.
 */
import { describe, expect, it } from 'vitest'
import callcenter from '@/locales/en/callcenter.json'
import ar from '@/locales/ar/callcenter.json'
import type { SessionState } from '@/core/models/callcenter'
import { ATTACHED_SESSION, EMPTY_SESSION } from './__fixtures__/payloads'
import { beforeYouPlace, stepRail, type RailSegment } from './step-rail'

/** The ready order: fixture 02 with an address and a slot, and nothing left blocking. */
const READY: SessionState = {
  ...ATTACHED_SESSION,
  header: {
    ...ATTACHED_SESSION.header,
    address: {
      addressNumber: '2',
      label: 'Home',
      cityCode: 'RUH',
      cityName: 'Riyadh',
      districtCode: '011',
      districtName: 'Malqa',
      line: 'King Fahd Rd',
    },
    slot: { slotId: 'S16', from: '16:00', to: '18:00', isActive: true },
  },
  capabilities: { ...ATTACHED_SESSION.capabilities, submitBlockers: [], canSubmit: true },
}

/** A segment as a short readable string, for the expectations below. */
const read = (segment: RailSegment) =>
  segment.kind === 'text' ? `${segment.isolate}:${segment.text}` : `key:${segment.key}${segment.count != null ? `#${segment.count}` : ''}`

const rail = (state: SessionState) =>
  Object.fromEntries(stepRail(state).map((step) => [step.id, { state: step.state, answer: step.answer.map(read) }]))

/**
 * Whether a locale holds a key. The Arabic callcenter file holds only what has been
 * translated so far (the rest falls back to English), so Arabic is asked only for the keys
 * this ticket adds — `rail.*` and `checklist.*`.
 */
const lookup = (locale: unknown, key: string) =>
  key.split('.').reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], locale)
/** A counted key is held as its plural forms (`_other` is the one every language has). */
const has = (locale: unknown, key: string) =>
  lookup(locale, key) !== undefined || lookup(locale, `${key}_other`) !== undefined

describe('eachStepReadsItsOwnAnswer', () => {
  it('reads the five steps, in the order the agent works', () => {
    expect(stepRail(EMPTY_SESSION).map((step) => step.id)).toEqual([
      'caller',
      'items',
      'fulfilment',
      'payment',
      'review',
    ])
  })

  it('an empty order: everything amber but the payment, which the order holds from the start', () => {
    expect(rail(EMPTY_SESSION)).toEqual({
      caller: { state: 'missing', answer: ['key:rail.caller.none'] },
      items: { state: 'missing', answer: ['key:rail.items.none'] },
      fulfilment: { state: 'missing', answer: ['key:rail.fulfilment.noAddress'] },
      payment: { state: 'done', answer: ['key:sentence.payment.cashOnDelivery'] },
      // Six blockers, six rows: the reference row shows only while it blocks.
      review: { state: 'missing', answer: ['key:rail.review.left#6'] },
    })
  })

  it('a half-done order: the caller and the items are green, the delivery still wants an address and a slot', () => {
    expect(rail(ATTACHED_SESSION)).toEqual({
      caller: { state: 'done', answer: ['auto:Redacted Customer'] },
      items: { state: 'done', answer: ['key:rail.items.count#2'] },
      fulfilment: { state: 'missing', answer: ['key:rail.fulfilment.noAddress'] },
      payment: { state: 'done', answer: ['key:sentence.payment.cashOnDelivery'] },
      review: { state: 'missing', answer: ['key:rail.review.left#2'] },
    })
  })

  it('a ready order: every step green, the fulfilment reads "Home · 16:00–18:00"', () => {
    expect(rail(READY)).toEqual({
      caller: { state: 'done', answer: ['auto:Redacted Customer'] },
      items: { state: 'done', answer: ['key:rail.items.count#2'] },
      fulfilment: { state: 'done', answer: ['auto:Home', 'ltr:16:00–18:00'] },
      payment: { state: 'done', answer: ['key:sentence.payment.cashOnDelivery'] },
      review: { state: 'done', answer: ['key:rail.review.ready'] },
    })
  })

  it('a collection order reads the store, and pays on collection', () => {
    const collect: SessionState = {
      ...READY,
      header: { ...READY.header, deliveryType: 'PickInStore', address: null, slot: null },
    }
    expect(rail(collect).fulfilment).toEqual({
      state: 'done',
      answer: ['key:rail.fulfilment.collect', 'ltr:1001 · King AbdelAziz Road'],
    })
    expect(rail(collect).payment.answer).toEqual(['key:sentence.payment.payOnCollection'])
  })

  it('points a fulfilment click at the first thing it is missing', () => {
    const fulfilment = (state: SessionState) => stepRail(state).find((step) => step.id === 'fulfilment')!
    expect(fulfilment(EMPTY_SESSION).focus).toBe('address')
    expect(fulfilment(READY).focus).toBe('fulfilment')
  })

  it('names only keys both locales hold', () => {
    for (const state of [EMPTY_SESSION, ATTACHED_SESSION, READY])
      for (const step of stepRail(state)) {
        for (const locale of [callcenter, ar]) {
          expect(has(locale, `rail.steps.${step.id}`), `rail.steps.${step.id}`).toBe(true)
          for (const segment of step.answer)
            if (segment.kind === 'key' && (locale === callcenter || segment.key.startsWith('rail.')))
              expect(has(locale, segment.key), segment.key).toBe(true)
        }
      }
  })
})

/** Every code the contract names (CONTRACT.md §2/§7), as `submit-blockers.test.ts` lists them. */
const CONTRACT_CODES = [
  'NO_LINES',
  'NO_CUSTOMER',
  'NO_ADDRESS',
  'STORE_NOT_CHOSEN',
  'MISSING_SLOT',
  'MISSING_SOURCE',
  'MISSING_SOURCE_REFERENCE',
  'SOURCE_REFERENCE_REQUIRED',
  'ALREADY_SUBMITTED',
]

const withBlockers = (codes: string[]): SessionState => ({
  ...READY,
  capabilities: { ...READY.capabilities, submitBlockers: codes, canSubmit: codes.length === 0 },
})

describe('theChecklistAndPlaceOrderAgree', () => {
  it('maps every server blocker code to exactly one checklist row, which says it in the blocker words', () => {
    const owner: Record<string, string> = {}
    for (const code of CONTRACT_CODES) {
      const list = beforeYouPlace(withBlockers([code]))
      const missing = list.rows.filter((row) => row.state === 'missing')
      expect(missing, code).toHaveLength(1)
      expect(missing[0].codes).toEqual([code])
      expect(list.ready, code).toBe(false)
      owner[code] = missing[0].id
    }
    expect(owner).toEqual({
      NO_LINES: 'items',
      NO_CUSTOMER: 'caller',
      NO_ADDRESS: 'address',
      STORE_NOT_CHOSEN: 'store',
      MISSING_SLOT: 'slot',
      MISSING_SOURCE: 'source',
      MISSING_SOURCE_REFERENCE: 'reference',
      SOURCE_REFERENCE_REQUIRED: 'reference',
      ALREADY_SUBMITTED: 'placed',
    })
    expect(beforeYouPlace(withBlockers(['SOURCE_REFERENCE_REQUIRED'])).rows.find((r) => r.id === 'reference')?.key).toBe(
      'blockers.MISSING_SOURCE_REFERENCE',
    )
  })

  it('an unknown code still blocks, with blockers.unknown, and turns Review amber', () => {
    const state = withBlockers(['MISSING_PAYMENT_TYPE'])
    const list = beforeYouPlace(state)
    expect(list.ready).toBe(false)
    expect(list.rows.filter((row) => row.state === 'missing')).toEqual([
      { id: 'unknown', state: 'missing', key: 'blockers.unknown', codes: ['MISSING_PAYMENT_TYPE'], step: 'review' },
    ])
    expect(stepRail(state).find((step) => step.id === 'review')?.state).toBe('missing')
  })

  it('a clear list is ready, and the done rows say what was settled', () => {
    const list = beforeYouPlace(READY)
    expect(list.ready).toBe(true)
    expect(list.rows.map((row) => `${row.id}:${row.state}:${row.key}`)).toEqual([
      'caller:done:checklist.done.caller',
      'items:done:checklist.done.items',
      'address:done:checklist.done.address',
      'store:done:checklist.done.store',
      'slot:done:checklist.done.slot',
      'source:done:checklist.done.source',
    ])
  })

  it('the rail Review step is green exactly when the checklist is ready', () => {
    for (const codes of [[], ...CONTRACT_CODES.map((c) => [c]), ['SOMETHING_NEW']]) {
      const state = withBlockers(codes)
      const review = stepRail(state).find((step) => step.id === 'review')!
      expect(review.state === 'done', codes.join()).toBe(beforeYouPlace(state).ready)
    }
  })

  it('names only keys both locales hold', () => {
    for (const codes of [[], ...CONTRACT_CODES.map((c) => [c]), ['SOMETHING_NEW']])
      for (const row of beforeYouPlace(withBlockers(codes)).rows)
        for (const locale of [callcenter, ar])
          if (locale === callcenter || row.key.startsWith('checklist.'))
            expect(has(locale, row.key), row.key).toBe(true)
  })
})

describe('a prescription order (1008, spec 1006 D2, D4)', () => {
  const NPHIES: SessionState = {
    ...READY,
    lines: [],
    header: { ...READY.header, orderType: 'Nphies', prescription: null },
    capabilities: { ...READY.capabilities, submitBlockers: ['MISSING_PRESCRIPTION'], canSubmit: false },
  }
  it('names the missing prescription on the checklist, in the blocker words', () => {
    const rows = beforeYouPlace(NPHIES).rows.filter((row) => row.state === 'missing')
    expect(rows.map((row) => [row.id, row.key, row.codes])).toEqual([
      ['prescription', 'blockers.MISSING_PRESCRIPTION', ['MISSING_PRESCRIPTION']],
    ])
    expect(rail(NPHIES).review.state).toBe('missing')
  })
  it('an empty basket is fine: the Items step stays green', () => {
    expect(rail(NPHIES).items.state).toBe('done')
    // …and on a phone order it is still amber.
    expect(rail({ ...NPHIES, header: { ...NPHIES.header, orderType: 'Ordinary' } }).items.state).toBe('missing')
  })
  // Review finding 6: "Items added" over an empty basket is a claim the basket contradicts.
  it('an empty basket is worded as the pharmacist’s to complete, never as items added', () => {
    const row = beforeYouPlace(NPHIES).rows.find((r) => r.id === 'items')
    expect(row).toMatchObject({ state: 'done', key: 'checklist.done.itemsByPharmacist' })
    expect(lookup(callcenter, 'checklist.done.itemsByPharmacist')).toBe('No items — the pharmacist completes it')
    expect(has(ar, 'checklist.done.itemsByPharmacist')).toBe(true)
    const withLines = { ...NPHIES, lines: READY.lines }
    expect(beforeYouPlace(withLines).rows.find((r) => r.id === 'items')).toMatchObject({ key: 'checklist.done.items' })
  })
  it('once both are held, the row says so; a phone order has no such row', () => {
    const settled: SessionState = {
      ...NPHIES,
      header: { ...NPHIES.header, prescription: { patientId: '1023456789', reference: 'PA-1' } },
      capabilities: { ...NPHIES.capabilities, submitBlockers: [] },
    }
    const row = beforeYouPlace(settled).rows.find((r) => r.id === 'prescription')
    expect(row).toMatchObject({ state: 'done', key: 'checklist.done.prescription' })
    expect(has(ar, 'checklist.done.prescription')).toBe(true)
    const phone = { ...settled, header: { ...settled.header, orderType: 'Ordinary' } }
    expect(beforeYouPlace(phone).rows.map((r) => r.id)).not.toContain('prescription')
  })
})

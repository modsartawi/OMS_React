/**
 * The LF return panel's pure projection (spec 759 F4, ticket 762): outcome → chip + meaning, the
 * attention banner, pending vs zero, and when the panel is drawn at all. Expected values are the
 * shipped English written out as literals, never re-derived from the JSON the way the code reads it.
 */
import { describe, expect, it } from 'vitest'
import documentEn from '@/locales/en/document.json'
import documentAr from '@/locales/ar/document.json'
import type { LfReturnDetailModel, LfReturnLineModel } from '@/core/models/lf-return'
import { asksLfReturn, attentionKey, lfReturnRows, outcomeChip, showsLfReturnPanel } from './lf-return'

const resolve = (bundle: unknown, key: string): unknown =>
  key.split('.').reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], bundle)
const en = (key: string) => resolve(documentEn, key)
const ar = (key: string) => resolve(documentAr, key)

describe('each outcome projects to its chip and meaning', () => {
  it.each([
    ['open', 'go', 'Open', 'The pickup is booked. The refund waits for the warehouse to confirm what arrived.'],
    ['refunded', 'ok', 'Refunded', 'The warehouse confirmed everything asked, and the customer was refunded.'],
    ['short', 'warn', 'Short', 'The warehouse confirmed less than was asked. Only what arrived was refunded.'],
    ['nothingReceived', 'warn', 'Nothing received', 'The warehouse confirmed it received nothing. No refund was made.'],
    ['unanswered', 'warn', 'Unanswered', 'The warehouse never confirmed this return. No refund was made.'],
    ['forced', 'ok', 'Forced', 'An operator forced the refund by the quantity received. The automatic refund is stopped.'],
  ])('%s → %s chip', (outcome, sev, label, meaning) => {
    const chip = outcomeChip(outcome)
    expect(chip.sev).toBe(sev)
    expect(en(chip.labelKey)).toBe(label)
    expect(en(chip.meaningKey)).toBe(meaning)
    // Arabic carries every one too.
    expect(typeof ar(chip.labelKey)).toBe('string')
    expect(typeof ar(chip.meaningKey)).toBe('string')
  })

  it('an outcome the client has not learned is a neutral chip with the generic meaning, and keeps its code', () => {
    const chip = outcomeChip('somethingNew')
    expect(chip.sev).toBe('mute')
    expect(chip.known).toBe(false)
    expect(en(chip.labelKey)).toBe('Unknown')
    expect(en(chip.meaningKey)).toBe('The server reported an outcome this screen does not know.')
    expect(outcomeChip(' refunded ').known).toBe(true)
  })
})

describe('only unanswered, nothingReceived and short raise the banner', () => {
  it.each([
    ['unanswered', 'The warehouse never answered. Chase Starlinks, or force the refund by what the customer handed over.'],
    ['nothingReceived', 'The warehouse says nothing arrived. Check with the driver and Starlinks before telling the customer.'],
    ['short', 'Less arrived than was asked. Check the missing items with Starlinks before telling the customer.'],
  ])('%s raises it, saying what kind of action', (outcome, sentence) => {
    const key = attentionKey(outcome)
    expect(key).not.toBeNull()
    expect(en(key!)).toBe(sentence)
    expect(typeof ar(key!)).toBe('string')
  })

  it.each(['open', 'refunded', 'forced', 'somethingNew', '', null, undefined])('%s raises none', (outcome) => {
    expect(attentionKey(outcome)).toBeNull()
  })
})

describe('an unconfirmed quantity is pending, not zero', () => {
  const line = (over: Partial<LfReturnLineModel> = {}): LfReturnLineModel => ({
    itemNumber: '10',
    sku: '100200300',
    quantityAsked: 2,
    quantityConfirmed: null,
    quantityRefunded: null,
    returnedToStock: null,
    reasonName: 'Damaged',
    ...over,
  })
  const detail = (over: Partial<LfReturnDetailModel>): LfReturnDetailModel => ({
    outcome: 'open',
    bookedAt: '2026-11-02T10:00:00',
    collectedAt: null,
    confirmedAt: null,
    lines: [line()],
    ...over,
  })
  const PENDING = { pending: true }
  const qty = (value: number) => ({ pending: false, value })
  const flag = (value: boolean) => ({ pending: false, value })

  it('an open return: confirmed, refunded and restocked are all pending — even when the server sends 0 and false', () => {
    for (const zeros of [line(), line({ quantityConfirmed: 0, quantityRefunded: 0, returnedToStock: false })]) {
      const [row] = lfReturnRows(detail({ lines: [zeros] }))
      expect(row.asked).toEqual(qty(2))
      expect(row.confirmed).toEqual(PENDING)
      expect(row.refunded).toEqual(PENDING)
      expect(row.restocked).toEqual(PENDING)
    }
  })

  it('an unanswered return: the warehouse never confirmed, so confirmed stays pending', () => {
    const [row] = lfReturnRows(detail({ outcome: 'unanswered', lines: [line({ quantityConfirmed: 0, quantityRefunded: 0 })] }))
    expect(row.confirmed).toEqual(PENDING)
    expect(row.refunded).toEqual(PENDING)
  })

  it('a confirmed nothing-received return: a real 0, not pending', () => {
    const [row] = lfReturnRows(
      detail({
        outcome: 'nothingReceived',
        confirmedAt: '2026-11-05T09:00:00',
        lines: [line({ quantityConfirmed: 0, quantityRefunded: 0, returnedToStock: false })],
      }),
    )
    expect(row.confirmed).toEqual(qty(0))
    expect(row.refunded).toEqual(qty(0))
    expect(row.restocked).toEqual(flag(false))
  })

  it('a short return reads what was confirmed; an absent field is still pending, never 0', () => {
    const [row] = lfReturnRows(
      detail({
        outcome: 'short',
        confirmedAt: '2026-11-05T09:00:00',
        lines: [line({ quantityAsked: 3, quantityConfirmed: 1, quantityRefunded: 1, returnedToStock: undefined })],
      }),
    )
    expect(row.asked).toEqual(qty(3))
    expect(row.confirmed).toEqual(qty(1))
    expect(row.refunded).toEqual(qty(1))
    expect(row.restocked).toEqual(PENDING)
  })

  it('a forced return with no warehouse confirmation: refunded is real, confirmed is pending', () => {
    const [row] = lfReturnRows(
      detail({ outcome: 'forced', confirmedAt: '0001-01-01T00:00:00', lines: [line({ quantityConfirmed: 0, quantityRefunded: 2, returnedToStock: false })] }),
    )
    expect(row.confirmed).toEqual(PENDING)
    expect(row.refunded).toEqual(qty(2))
    expect(row.restocked).toEqual(flag(false))
  })

  it('restocked is the server flag once settled — a line back in stock reads yes, a non-boolean is pending', () => {
    const settled = (returnedToStock: unknown) =>
      lfReturnRows(
        detail({
          outcome: 'refunded',
          confirmedAt: '2026-11-05T09:00:00',
          lines: [line({ quantityConfirmed: 2, quantityRefunded: 2, returnedToStock: returnedToStock as boolean })],
        }),
      )[0].restocked
    expect(settled(true)).toEqual(flag(true))
    expect(settled(false)).toEqual(flag(false))
    // The pre-765 transcription's count is not a flag: never read as yes or no.
    expect(settled(2)).toEqual(PENDING)
    expect(en('lfReturn.lines.restockedYes')).toBe('Yes')
    expect(en('lfReturn.lines.restockedNo')).toBe('Not restocked')
    expect(typeof ar('lfReturn.lines.restockedYes')).toBe('string')
    expect(typeof ar('lfReturn.lines.restockedNo')).toBe('string')
  })

  it('carries item, SKU and reason through, and survives absent lines', () => {
    const [row] = lfReturnRows(detail({}))
    expect([row.itemNumber, row.sku, row.reasonName]).toEqual(['10', '100200300', 'Damaged'])
    expect(lfReturnRows({ outcome: 'open', lines: undefined as unknown as LfReturnLineModel[] })).toEqual([])
  })
})

describe('the panel is drawn only on an LF return delivery with grant 03', () => {
  /** A return delivery (category `T`, the 9000000003 capture), opened as a delivery, by a 03 holder. */
  const RETURN = { openedAs: 'delivery' as const, documentCategory: 'T', canCreateLocalFulfillmentReturn: true }
  /** What 3376's read answers for an LF return delivery. */
  const WATCH: LfReturnDetailModel = { outcome: 'open', bookedAt: '2026-11-02T10:00:00', lines: [] }

  it('an LF return delivery with 03: asked, and drawn from the read', () => {
    expect(asksLfReturn(RETURN)).toBe(true)
    expect(showsLfReturnPanel(RETURN, WATCH)).toBe(true)
  })

  it('not on the forward delivery: a delivery (category D) — LF or not — is never asked', () => {
    expect(asksLfReturn({ ...RETURN, documentCategory: 'D' })).toBe(false)
    expect(showsLfReturnPanel({ ...RETURN, documentCategory: 'D' }, WATCH)).toBe(false)
  })

  it('not on a bonded return: the read answers no watch, so nothing is drawn', () => {
    expect(showsLfReturnPanel(RETURN, null)).toBe(false)
    // Still loading: nothing yet.
    expect(showsLfReturnPanel(RETURN, undefined)).toBe(false)
  })

  it('not without 03: never asked, and a watch in hand is not drawn either', () => {
    for (const grant of [false, undefined]) {
      const ctx = { ...RETURN, canCreateLocalFulfillmentReturn: grant }
      expect(asksLfReturn(ctx)).toBe(false)
      expect(showsLfReturnPanel(ctx, WATCH)).toBe(false)
    }
  })

  it('not on a return opened as a document, nor on an order', () => {
    expect(asksLfReturn({ ...RETURN, openedAs: 'document' })).toBe(false)
    expect(asksLfReturn({ ...RETURN, documentCategory: 'O' })).toBe(false)
    expect(asksLfReturn({ ...RETURN, documentCategory: ' T ' })).toBe(true)
  })
})

describe("3369's prose spelling nothing-received reads the same as nothingReceived", () => {
  const watchOf = (outcome: string): LfReturnDetailModel => ({
    outcome,
    confirmedAt: '2026-11-03T09:00:00',
    lines: [{ itemNumber: '000010', sku: '100200', quantityAsked: 2, quantityConfirmed: 0, quantityRefunded: 0, returnedToStock: false }],
  })

  it('the chip, its code and its meaning', () => {
    expect(outcomeChip('nothing-received')).toEqual(outcomeChip('nothingReceived'))
    expect(outcomeChip(' nothing-received ')).toMatchObject({ known: true, code: 'nothingReceived', sev: 'warn' })
    expect(outcomeChip('somethingNew').code).toBe('unknown')
  })

  it('the attention banner', () => {
    expect(attentionKey('nothing-received')).toBe('lfReturn.attention.nothingReceived')
  })

  it('the line quantities', () => {
    expect(lfReturnRows(watchOf('nothing-received'))).toEqual(lfReturnRows(watchOf('nothingReceived')))
  })
})

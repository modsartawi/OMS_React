/**
 * The two rulings the item search exists to hold, asserted at their edge:
 * availability has three states and `unknown` is not `zero`, and the estimate
 * never enters the money column.
 *
 * Both are properties of the VIEW MODEL rather than of a component, which is the
 * point of testing them here: a rule that lives in JSX is re-decided by the next
 * person who edits the row.
 */
import { describe, expect, it } from 'vitest'
import type { ItemSearchRow } from '@/core/models/callcenter'
import {
  ESTIMATE_MARK,
  MIN_QUERY_LENGTH,
  availabilityOf,
  isSearchable,
  searchRowView,
  searchRowViews,
} from './item-search'

/** A row's SHAPE is 799's; every value is set by the test. */
const row = (over: Partial<ItemSearchRow> = {}): ItemSearchRow => ({
  materialNumber: '200145',
  descriptionEn: 'Panadol Extra 500mg 24 Tablets',
  descriptionAr: 'بنادول إكسترا ٥٠٠ مجم ٢٤ قرص',
  estimatePriceExVat: 9.13,
  atp: 12,
  ...over,
})

/** Every currency word that could turn an estimate into a quote. The rule is
 *  *no currency word*, not "no SAR" — an agent reading `9.13 SR` out loud has
 *  made exactly the mistake the ruling exists to prevent. */
const CURRENCY = /\bSAR\b|\bSR\b|ريال/i

describe('availabilityOf — three states, and unknown is not zero', () => {
  it('reads a positive count as a count', () => {
    expect(availabilityOf(12)).toMatchObject({ kind: 'count', quantity: 12 })
  })

  it('reads nought as none at the store', () => {
    expect(availabilityOf(0)).toMatchObject({ kind: 'none', quantity: 0 })
  })

  it('reads a degraded stock read as unknown', () => {
    expect(availabilityOf(null)).toMatchObject({ kind: 'unknown', quantity: null })
  })

  it('🚩 never collapses unknown onto zero — three distinct classifications', () => {
    const three = [availabilityOf(12), availabilityOf(0), availabilityOf(null)]
    // Distinct kind, distinct WORDS and distinct ground: they are opposite
    // decisions for the agent, so colour alone may never be the difference.
    expect(new Set(three.map((a) => a.kind)).size).toBe(3)
    expect(new Set(three.map((a) => a.labelKey)).size).toBe(3)
    expect(new Set(three.map((a) => a.tone)).size).toBe(3)
  })

  it('🚩 an unknown count is not a number the agent could read as none', () => {
    // The one collapse that would be invisible on screen: a `null` quantity
    // rendered through the same slot as a count would draw a blank where the
    // count goes and read as nothing in stock.
    expect(availabilityOf(null).quantity).toBeNull()
    expect(availabilityOf(0).quantity).toBe(0)
  })

  it('treats an absent field and a negative count as their honest states', () => {
    // Unknown fields are ignored by rule (§9), so a row that carries no `atp` at
    // all is the degraded read — not a zero. A negative stock figure is a real
    // master-data state and is none, not a count to show.
    expect(availabilityOf(undefined).kind).toBe('unknown')
    expect(availabilityOf(-3).kind).toBe('none')
  })
})

describe('searchRowView — the estimate never enters the money column', () => {
  it('puts the estimate on the meta line, beside the item number', () => {
    const view = searchRowView(row())
    expect(view.meta.map((part) => part.id)).toEqual(['itemNumber', 'description2', 'estimate'])
    expect(view.meta.find((part) => part.id === 'estimate')?.text).toBe(`${ESTIMATE_MARK}9.13`)
  })

  it('🚩 exposes no money-formatted figure anywhere on the row', () => {
    const view = searchRowView(row())
    // `SAR` is reserved for engine money (135 amendment 1). Nothing the row
    // model carries may make a figure readable as what the caller pays.
    expect(JSON.stringify(view)).not.toMatch(CURRENCY)
    const estimate = view.meta.find((part) => part.id === 'estimate')!.text
    expect(estimate.startsWith(ESTIMATE_MARK)).toBe(true)
    expect(estimate).not.toMatch(CURRENCY)
  })

  it('🚩 keeps the estimate off the row’s end edge, which carries availability alone', () => {
    // The end edge is where a price would be read as money, and the view model
    // is what guarantees nothing else can be put there: it is one field, and it
    // is the classification.
    const view = searchRowView(row())
    expect(Object.keys(view).sort()).toEqual(['availability', 'itemNumber', 'meta', 'title'])
    expect(JSON.stringify(view.availability)).not.toContain('9.13')
    expect(view.title).not.toContain('9.13')
  })

  it('drops the estimate entirely rather than inventing a nought price', () => {
    const view = searchRowView(row({ estimatePriceExVat: null }))
    expect(view.meta.map((part) => part.id)).toEqual(['itemNumber', 'description2'])
  })

  it('drops the Arabic name when the master carries none', () => {
    const view = searchRowView(row({ descriptionAr: null }))
    expect(view.meta.map((part) => part.id)).toEqual(['itemNumber', 'estimate'])
  })

  it('carries the item number addItem is given, and the name the agent reads', () => {
    const view = searchRowView(row())
    expect(view.itemNumber).toBe('200145')
    expect(view.title).toBe('Panadol Extra 500mg 24 Tablets')
  })

  it('maps a whole answer, keeping the server’s ranking', () => {
    const views = searchRowViews({
      truncated: false,
      atpAvailable: true,
      rows: [row({ materialNumber: '1' }), row({ materialNumber: '2' })],
    })
    expect(views.map((v) => v.itemNumber)).toEqual(['1', '2'])
  })

  it('survives an answer with no rows at all', () => {
    expect(searchRowViews(undefined)).toEqual([])
    expect(searchRowViews({ truncated: false, atpAvailable: true, rows: [] })).toEqual([])
  })
})

describe('isSearchable', () => {
  it('holds the search until the server would accept the term', () => {
    // The endpoint rejects a term under three characters with a 400, so a
    // console that fired anyway would spend a round trip to be told off.
    expect(isSearchable('ab')).toBe(false)
    expect(isSearchable('abc')).toBe(true)
    expect(MIN_QUERY_LENGTH).toBe(3)
  })

  it('counts what the agent typed, not the whitespace around it', () => {
    expect(isSearchable('  ab  ')).toBe(false)
    expect(isSearchable('  abc  ')).toBe(true)
  })

  it('counts Arabic the same as English', () => {
    expect(isSearchable('بنا')).toBe(true)
    expect(isSearchable('بن')).toBe(false)
  })
})

import { describe, expect, it } from 'vitest'
import type { SimulateRequest } from '@/core/models/simulation'
import { isStaleRun } from './staleness'

/**
 * The staleness predicate (ticket 114, spec 110) — the request the inputs on
 * screen currently describe, compared against the request that produced the
 * result on screen. Pure, and a module rather than an inline `.tsx` rule
 * precisely so a node-environment runner can reach it.
 *
 * Two things are under test, and the second is the load-bearing one:
 *
 * 1. **Every input counts** — determination field, lever, checkbox, item row and
 *    manual-condition row — because every one of them feeds the request.
 * 2. **No false positive.** `''`, `null` and `undefined` on an optional field
 *    must not read as a change; the mark would otherwise stick on permanently
 *    and stop meaning anything.
 */

/** The ordinary run: the header defaults every capture in the 098 corpus used. */
function request(patch: Partial<SimulateRequest> = {}): SimulateRequest {
  return {
    header: {
      plant: 'P001',
      salesOrganization: '1000',
      distributionChannel: '20',
      pricingDate: '2026-07-25T00:00:00',
      documentPricingProcedureKey: '',
      loyGroups: null,
      loyTier: null,
      isPromotionApplicable: true,
      ...patch.header,
    },
    items: patch.items ?? [
      { materialNumber: '107255', quantity: 2, qtyUnit: 'EA', itemConditionControl: null },
    ],
    includeConditions: patch.includeConditions ?? true,
    includePricingElements: patch.includePricingElements ?? false,
    ...('manualConditions' in patch ? { manualConditions: patch.manualConditions } : {}),
  }
}

describe('isStaleRun marks the results as describing an older basket', () => {
  it('is not stale when no run has happened yet — silence is the healthy state', () => {
    expect(isStaleRun(request(), null)).toBe(false)
  })

  it('is not stale when the inputs on screen produced the results on screen', () => {
    expect(isStaleRun(request(), request())).toBe(false)
  })

  it('is stale on a changed determination field', () => {
    expect(isStaleRun(request({ header: { plant: 'P002' } as never }), request())).toBe(true)
  })

  it('is stale on a changed lever — as stale as a changed determination field', () => {
    const edited = request()
    edited.header.loyGroups = '0001'
    expect(isStaleRun(edited, request())).toBe(true)
  })

  it('is stale on either checkbox — the promotion flag and the elements flag', () => {
    const promoOff = request()
    promoOff.header.isPromotionApplicable = false
    expect(isStaleRun(promoOff, request())).toBe(true)
    expect(isStaleRun(request({ includePricingElements: true }), request())).toBe(true)
  })

  it('is stale on an item-row edit — a changed quantity, a changed unit, a new row', () => {
    expect(
      isStaleRun(
        request({
          items: [{ materialNumber: '107255', quantity: 3, qtyUnit: 'EA', itemConditionControl: null }],
        }),
        request(),
      ),
    ).toBe(true)
    expect(
      isStaleRun(
        request({
          items: [{ materialNumber: '107255', quantity: 2, qtyUnit: 'CS', itemConditionControl: null }],
        }),
        request(),
      ),
    ).toBe(true)
    expect(
      isStaleRun(
        request({
          items: [
            { materialNumber: '107255', quantity: 2, qtyUnit: 'EA', itemConditionControl: null },
            { materialNumber: '107256', quantity: 1, qtyUnit: 'EA', itemConditionControl: null },
          ],
        }),
        request(),
      ),
    ).toBe(true)
  })

  it('is stale on a reordering of otherwise-equal item rows — order IS the item number', () => {
    // The server assigns `itemNumber` by array order ((index+1)*10), so two rows
    // swapped are a different basket even though the multiset is identical.
    const rows = [
      { materialNumber: '107255', quantity: 2, qtyUnit: 'EA', itemConditionControl: null },
      { materialNumber: '107256', quantity: 1, qtyUnit: 'EA', itemConditionControl: null },
    ]
    expect(isStaleRun(request({ items: [...rows].reverse() }), request({ items: rows }))).toBe(true)
  })

  it('is stale on a manual-condition row — added, edited or removed', () => {
    const withRow = request({
      manualConditions: [{ itemNumber: 0, conditionType: 'ZDIS', rate: -5, rateUnit: '%' }],
    })
    expect(isStaleRun(withRow, request())).toBe(true)
    expect(isStaleRun(request(), withRow)).toBe(true)
    expect(
      isStaleRun(
        request({
          manualConditions: [{ itemNumber: 0, conditionType: 'ZDIS', rate: -7, rateUnit: '%' }],
        }),
        withRow,
      ),
    ).toBe(true)
  })

  describe('the false positive that would stick the mark on permanently', () => {
    it('reads blank, null and undefined on an optional lever as the same absence', () => {
      const blank = request()
      blank.header.loyGroups = ''
      blank.header.loyTier = ''
      const nulled = request() // loyGroups/loyTier null
      const missing = request()
      // The shape a captured request can arrive in: the key simply absent.
      delete (missing.header as Partial<typeof missing.header>).loyGroups
      delete (missing.header as Partial<typeof missing.header>).loyTier

      expect(isStaleRun(blank, nulled)).toBe(false)
      expect(isStaleRun(nulled, missing)).toBe(false)
      expect(isStaleRun(blank, missing)).toBe(false)
    })

    it('reads an absent manualConditions array and an empty one as the same absence', () => {
      expect(isStaleRun(request({ manualConditions: [] }), request())).toBe(false)
      expect(isStaleRun(request(), request({ manualConditions: [] }))).toBe(false)
      expect(isStaleRun(request({ manualConditions: undefined }), request())).toBe(false)
    })

    it('reads a blank and a null itemConditionControl as the same absence', () => {
      const blank = request({
        items: [{ materialNumber: '107255', quantity: 2, qtyUnit: 'EA', itemConditionControl: '' }],
      })
      expect(isStaleRun(blank, request())).toBe(false)
    })

    it('ignores surrounding whitespace — trimming is not an edit', () => {
      const padded = request()
      padded.header.plant = ' P001 '
      expect(isStaleRun(padded, request())).toBe(false)
    })

    it('is stable under key order — a rebuilt request is not a changed one', () => {
      // The Page rebuilds the request object on every render; a predicate that
      // compared serialised key order would mark every keystroke as stale.
      const rebuilt: SimulateRequest = {
        includePricingElements: false,
        includeConditions: true,
        items: [
          { qtyUnit: 'EA', itemConditionControl: null, quantity: 2, materialNumber: '107255' },
        ],
        header: {
          isPromotionApplicable: true,
          loyTier: null,
          loyGroups: null,
          documentPricingProcedureKey: '',
          pricingDate: '2026-07-25T00:00:00',
          distributionChannel: '20',
          salesOrganization: '1000',
          plant: 'P001',
        },
      }
      expect(isStaleRun(rebuilt, request())).toBe(false)
    })
  })
})

import { describe, expect, it } from 'vitest'
import type { SimulationResultCondition } from '@/core/models/simulation'
import { aggregateConditions } from './aggregate'
import { PAYLOADS, SCENARIOS, conditionsOf, type CapturedScenario } from './__fixtures__/payloads'

/**
 * A safety net under the condition aggregator (ticket 111) — the client-side port
 * of the WPF `PosSimulationController`'s grouping, and the sole producer of the
 * rule list the reworked result line expands into (ticket 103).
 *
 * Every case is driven from the ticket-098 captures. Where a case needs a shape
 * the corpus does not contain, a captured row is spread and one field overridden
 * — the deviation is stated at the call site rather than a whole object being
 * invented. The module's behaviour is the contract here: a disagreement is a
 * finding recorded on the ticket, not a fix.
 */

/** The corpus rows for a line, cloned so an override can't leak between tests. */
function rows(scenario: CapturedScenario, itemIndex: number): SimulationResultCondition[] {
  return conditionsOf(scenario, itemIndex).map((c) => ({ ...c }))
}

describe('aggregateConditions folds rows sharing type, rate, unit and origin', () => {
  it('folds the two-piece bonus-buy into one summed group', () => {
    // `05-pricing-elements` line 0: four raw rows, of which the two ZB03 rows are
    // the same promotion charged against each piece (bbyItemIndex 0 and 1).
    const raw = rows('pricing-elements', 0)
    expect(raw).toHaveLength(4)

    const groups = aggregateConditions(raw)
    expect(groups.map((g) => g.conditionType)).toEqual(['VKP0', 'ZB03', 'MWST'])

    const [, promo] = groups
    expect(promo.count).toBe(2)
    expect(promo.conditionBaseValue).toBe(182.52) // 91.26 + 91.26
    expect(promo.conditionValue).toBe(-63.88) // -31.94 + -31.94
    expect(promo.conditionRate).toBe(-35) // the rate is a key part, never summed
    expect(promo.subs).toEqual(raw.slice(1, 3))
    expect(promo.subs.map((s) => s.bbyItemIndex)).toEqual([0, 1])
  })

  it('leaves an unfolded row a group of one carrying its own values', () => {
    const [base] = aggregateConditions(rows('pricing-elements', 0))
    expect(base.count).toBe(1)
    expect(base.conditionBaseValue).toBe(2)
    expect(base.conditionValue).toBe(182.52)
    expect(base.subs).toHaveLength(1)
  })

  it('keeps rows apart that differ in origin, rate or unit alone', () => {
    // `06-manual-conditions` line 0 is the corpus's discriminating line: two ZB01
    // rows that share a type and differ in rate, unit AND origin (M vs B).
    const groups = aggregateConditions(rows('manual-conditions', 0))
    expect(groups).toHaveLength(4)

    const zb01 = groups.filter((g) => g.conditionType === 'ZB01')
    expect(zb01).toHaveLength(2)
    expect(zb01.map((g) => [g.conditionRate, g.conditionRateUnit, g.conditionOrigin])).toEqual([
      [-5, '%', 'M'],
      [-18.24, 'SAR', 'B'],
    ])
    expect(zb01.map((g) => g.count)).toEqual([1, 2])
  })

  it('never folds two rows a naive space-joined key would collide', () => {
    // The unit-separator the key joins on exists for this: with a space, the
    // tuples ('SAR X', 'A') and ('SAR', 'X A') would both render "… SAR X A".
    // No capture carries a field with a space, so two corpus rows are re-tagged.
    const [a, b] = rows('plain-multiline', 0)
    const collidable: SimulationResultCondition[] = [
      { ...a, conditionType: 'ZZ01', conditionRate: 1, conditionRateUnit: 'SAR X', conditionOrigin: 'A' },
      { ...b, conditionType: 'ZZ01', conditionRate: 1, conditionRateUnit: 'SAR', conditionOrigin: 'X A' },
    ]
    const groups = aggregateConditions(collidable)
    expect(groups).toHaveLength(2)
    expect(groups.map((g) => g.count)).toEqual([1, 1])
  })

  it('carries the origin-derived badge and category through the fold', () => {
    const groups = aggregateConditions(rows('manual-conditions', 0))
    expect(groups.map((g) => [g.conditionOrigin, g.badge, g.category])).toEqual([
      ['A', null, 'pricing'], // base pricing step — unbadged
      ['M', 'manual', 'manual'],
      ['B', 'promotion', 'promotion'],
      ['A', null, 'pricing'],
    ])
    // `isBonusBuy` is the one boolean that ORs across the fold.
    expect(groups.map((g) => g.isBonusBuy)).toEqual([false, false, true, false])
  })

  it('groups every corpus line without dropping or inventing a row', () => {
    for (const scenario of SCENARIOS) {
      PAYLOADS[scenario].items.forEach((_item, index) => {
        const raw = rows(scenario, index)
        const groups = aggregateConditions(raw)
        expect(groups.reduce((sum, g) => sum + g.count, 0)).toBe(raw.length)
        // The flattened subs are the raw rows as a MULTISET, not as a sequence:
        // two interleaved groups (rows A, B, A) flatten to A, A, B by design. Rows
        // are cloned per test, so reference identity is an exact multiset check.
        const flattened = groups.flatMap((g) => g.subs)
        expect(flattened).toHaveLength(raw.length)
        expect(raw.every((row) => flattened.includes(row))).toBe(true)
        // Wire order IS a property within a group.
        for (const g of groups) {
          const positions = g.subs.map((s) => raw.indexOf(s))
          expect(positions).toEqual([...positions].sort((a, b) => a - b))
        }
        expect(groups.length).toBeLessThanOrEqual(raw.length)
      })
    }
  })
})

describe('aggregateConditions numbers non-statistical groups before statistical ones', () => {
  /**
   * No ticket-098 capture carries `isStatistics: true` — recorded on ticket 111 as
   * a corpus gap, not a code finding. The two-pass index is still load-bearing
   * (ticket 103 hangs the `STAT` key off the flag), so the case is built by
   * flipping the flag on captured rows and saying so.
   */
  function withStatistical(types: string[]): SimulationResultCondition[] {
    return rows('pricing-elements', 0).map((c) =>
      types.includes(c.conditionType) ? { ...c, isStatistics: true } : c,
    )
  }

  it('pushes a statistical group to the end of the numbering, not of the list', () => {
    // VKP0 is the FIRST row on the wire — so an index that ignored the flag would
    // read 1 here.
    const groups = aggregateConditions(withStatistical(['VKP0']))
    expect(groups.map((g) => g.conditionType)).toEqual(['VKP0', 'ZB03', 'MWST'])
    expect(groups.map((g) => g.index)).toEqual([3, 1, 2])
    expect(groups.map((g) => g.isStatistics)).toEqual([true, false, false])
  })

  it('numbers several statistical groups after all the others, in wire order', () => {
    const groups = aggregateConditions(withStatistical(['VKP0', 'MWST']))
    expect(groups.map((g) => [g.conditionType, g.index])).toEqual([
      ['VKP0', 2],
      ['ZB03', 1],
      ['MWST', 3],
    ])
  })

  it('numbers a corpus line 1..n in first-appearance order when nothing is statistical', () => {
    for (const scenario of SCENARIOS) {
      PAYLOADS[scenario].items.forEach((_item, index) => {
        const groups = aggregateConditions(rows(scenario, index))
        expect(groups.some((g) => g.isStatistics)).toBe(false)
        expect(groups.map((g) => g.index)).toEqual(groups.map((_g, i) => i + 1))
      })
    }
  })

  it('takes the fold’s flag from the first row of the group', () => {
    // Both ZB03 rows are one group; flagging only the second leaves the group
    // non-statistical — the WPF `GroupBy(...).Select(g => g.First())` shape.
    const raw = rows('pricing-elements', 0)
    raw[2] = { ...raw[2], isStatistics: true }
    const promo = aggregateConditions(raw).find((g) => g.conditionType === 'ZB03')
    expect(promo?.isStatistics).toBe(false)
    expect(promo?.count).toBe(2)
  })
})

describe('aggregateConditions keeps distinct non-empty bbyNumbers and survives empty input', () => {
  it('collects the bonus-buy number once for a group folded from two rows', () => {
    const promo = aggregateConditions(rows('fired-bonus-buy', 0)).find((g) => g.isBonusBuy)
    expect(promo?.count).toBe(2)
    expect(promo?.bbyNumbers).toEqual(['000100000131'])
  })

  it('leaves a plain pricing group with no bonus-buy numbers at all', () => {
    const groups = aggregateConditions(rows('plain-multiline', 0))
    expect(groups.every((g) => g.bbyNumbers.length === 0)).toBe(true)
  })

  it('collects distinct numbers in first-appearance order', () => {
    // The corpus never folds two DIFFERENT bonus buys into one group (they differ
    // in rate), so the second number is re-tagged onto a captured row.
    const raw = rows('fired-bonus-buy', 0)
    raw[2] = { ...raw[2], bbyNumber: '000100000132' }
    const promo = aggregateConditions(raw).find((g) => g.isBonusBuy)
    expect(promo?.bbyNumbers).toEqual(['000100000131', '000100000132'])
  })

  it('rejects a blank or missing number rather than listing it', () => {
    const raw = rows('fired-bonus-buy', 0)
    raw[1] = { ...raw[1], bbyNumber: '' }
    raw[2] = { ...raw[2], bbyNumber: null }
    const promo = aggregateConditions(raw).find((g) => g.conditionType === 'ZB03')
    expect(promo?.bbyNumbers).toEqual([])
    expect(promo?.count).toBe(2)
  })

  it('returns an empty list for empty, null and undefined input', () => {
    expect(aggregateConditions([])).toEqual([])
    expect(aggregateConditions(null)).toEqual([])
    expect(aggregateConditions(undefined)).toEqual([])
  })
})

// The `countStatistical` block retired with the function (ticket 116) — the
// show/hide-statistical toggle was its only call site, and the expansion now lists
// every group and marks the statistical ones. The flag itself stays under test above:
// it survives the fold, it is never inferred from a sibling row, and it drives the
// two-pass numbering.

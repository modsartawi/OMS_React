import { describe, expect, it } from 'vitest'
import type { SimulationResultItem } from '@/core/models/simulation'
import { PAYLOADS, SCENARIOS } from './__fixtures__/payloads'
import { lineMoney } from './line-money'

/**
 * The result line's money projection (ticket 115, spec 110 — ruled in 104 §1/§4/§5
 * against the 098 captures). This is the rework's highest-risk rule, because every
 * failure mode is a *plausible-looking number*: a blank column that prints `0.00`
 * says "we checked, it was nothing"; a `W` line that prints its five zeros says
 * "priced at zero" when the truth is "did not price".
 *
 * The corpus is the evidence, not a hypothesis — every case below names the capture
 * it is asserted against.
 */

/** Every priced line in the corpus, with the capture it came from, for the sweeps. */
function everyLine(): { scenario: string; item: SimulationResultItem }[] {
  return SCENARIOS.flatMap((scenario) =>
    PAYLOADS[scenario].items.map((item) => ({ scenario, item })),
  )
}

describe('an undiscounted line renders was and saved blank rather than 0.00', () => {
  it('blanks both on every plain line of 01-plain-multiline', () => {
    const lines = PAYLOADS['plain-multiline'].items
    expect(lines).toHaveLength(3)
    for (const item of lines) {
      // The capture's premise: no promotion touched any of these lines.
      expect(item.promotionDiscount).toBe(0)
      const money = lineMoney(item)
      expect(money.was).toBeNull()
      expect(money.saved).toBeNull()
      // Net total is never blank on a priced line — it is the one emphasised figure.
      expect(money.netTotal).toBe(item.netTotal)
    }
  })

  it('prints both on the discounted line of 02-fired-bonus-buy, saved as a magnitude', () => {
    const item = PAYLOADS['fired-bonus-buy'].items[0]
    expect(item.promotionDiscount).toBeLessThan(0)
    const money = lineMoney(item)
    // `was` ← grossValue (the PRE-discount figure), `saved` ← the magnitude of the
    // discount: 104 §4 — every real discount is negative, and the column that is
    // labelled "saved" must not read `-63.88`.
    expect(money.was).toBe(item.grossValue)
    expect(money.saved).toBe(Math.abs(item.promotionDiscount))
    expect(money.saved).toBeGreaterThan(0)
    expect(money.netTotal).toBe(item.netTotal)
  })

  it('blanks was and saved on exactly the lines the corpus leaves undiscounted', () => {
    for (const { scenario, item } of everyLine()) {
      const money = lineMoney(item)
      const discounted = item.promotionDiscount !== 0
      expect({ scenario, item: item.itemNumber, blank: money.was === null }).toEqual({
        scenario,
        item: item.itemNumber,
        blank: !discounted,
      })
      expect(money.saved === null).toBe(!discounted)
    }
  })

  it('never blanks was without blanking saved — they are one decision', () => {
    for (const { item } of everyLine()) {
      const money = lineMoney(item)
      expect(money.was === null).toBe(money.saved === null)
    }
  })
})

describe('a W line suppresses all five zeros the wire sent and reports not priced', () => {
  /** 04b #10 `COUP01` — the corpus's only non-ok line (098 produced no per-line `E`). */
  const coup01 = PAYLOADS['no-price'].items[0]

  it('the capture really does send five zeros under a W', () => {
    expect(coup01.materialNumber).toBe('COUP01')
    expect(coup01.pricingStatus).toBe('W')
    expect([
      coup01.netPrice,
      coup01.grossValue,
      coup01.netValue,
      coup01.taxValue,
      coup01.netTotal,
    ]).toEqual([0, 0, 0, 0, 0])
  })

  it('suppresses every money figure and reports notPriced', () => {
    const money = lineMoney(coup01)
    expect(money.notPriced).toBe(true)
    expect(money.was).toBeNull()
    expect(money.saved).toBeNull()
    // Net total is suppressed too — the line reads `not priced`, not `0.00`.
    expect(money.netTotal).toBeNull()
    expect(money.unitPrice).toBeNull()
  })

  it('leaves the healthy line of the same capture priced', () => {
    const money = lineMoney(PAYLOADS['no-price'].items[1])
    expect(money.notPriced).toBe(false)
    expect(money.netTotal).toBe(35.95)
    expect(money.unitPrice).toBe(31.26)
  })

  it('reports notPriced on no other line in the corpus', () => {
    const flagged = everyLine()
      .filter(({ item }) => lineMoney(item).notPriced)
      .map(({ scenario, item }) => `${scenario}#${item.itemNumber}`)
    expect(flagged).toEqual(['no-price#10'])
  })

  it('treats an E line the same way — the reasoning is the status, not the letter', () => {
    // The corpus carries no `E`, so this is the one case built from a capture rather
    // than taken from one: a line that failed to price must not print zeros as money,
    // and an error is not a weaker failure than a warning.
    const money = lineMoney({ ...coup01, pricingStatus: 'E' })
    expect(money.notPriced).toBe(true)
    expect(money.netTotal).toBeNull()
  })
})

describe('the promotion slot resolves to exactly one of four states', () => {
  it('is none on a plain line — an em-dash, no mark of any kind (01-plain-multiline)', () => {
    for (const item of PAYLOADS['plain-multiline'].items) {
      expect(lineMoney(item).promoSlot).toEqual({ state: 'none' })
    }
  })

  it('is fired on a bonus-buy line (02-fired-bonus-buy)', () => {
    expect(lineMoney(PAYLOADS['fired-bonus-buy'].items[0]).promoSlot).toEqual({
      state: 'fired',
      manual: false,
    })
  })

  it('stacks MANUAL onto fired when both touch the line (06-manual-conditions)', () => {
    // Both lines of capture 06 carry a hand-entered condition alongside the bonus
    // buy, and the wire folds both into one `promotionDiscount` — without the MANUAL
    // mark the analyst cannot tell this run from an ordinary one (104 §3).
    for (const item of PAYLOADS['manual-conditions'].items) {
      expect(lineMoney(item).promoSlot).toEqual({ state: 'fired', manual: true })
    }
  })

  it('is manual alone when a hand-entered condition fires without a promotion', () => {
    const base = PAYLOADS['manual-conditions'].items[0]
    const item: SimulationResultItem = {
      ...base,
      conditions: base.conditions.filter((c) => c.conditionOrigin !== 'B'),
    }
    expect(lineMoney(item).promoSlot).toEqual({ state: 'manual' })
  })

  it('is warned on the W line, where the badge takes the slot (04b-no-price)', () => {
    expect(lineMoney(PAYLOADS['no-price'].items[0]).promoSlot).toEqual({ state: 'warned' })
  })

  it('lets warned win over a promotion — the two can never legitimately collide', () => {
    // A line that failed to price never fires a promotion (104 §2), so this is a
    // guard, not a case: the slot must resolve to ONE state whatever the wire sends.
    const fired = PAYLOADS['fired-bonus-buy'].items[0]
    const slot = lineMoney({ ...fired, pricingStatus: 'W' }).promoSlot
    expect(slot).toEqual({ state: 'warned' })
  })

  it('resolves to one of the four states on every line in the corpus', () => {
    const states = new Set(everyLine().map(({ item }) => lineMoney(item).promoSlot.state))
    for (const state of states) {
      expect(['none', 'fired', 'manual', 'warned']).toContain(state)
    }
    // The corpus exercises three of the four; `manual` alone is not in it.
    expect([...states].sort()).toEqual(['fired', 'none', 'warned'])
  })
})

describe('the projection carries the line messages it must never hide', () => {
  it('surfaces the [070] message of the W line — it rides the line, not a disclosure', () => {
    const money = lineMoney(PAYLOADS['no-price'].items[0])
    expect(money.messages).toHaveLength(1)
    expect(money.messages[0]).toContain('[070]')
  })

  it('is empty on a healthy line', () => {
    expect(lineMoney(PAYLOADS['plain-multiline'].items[0]).messages).toEqual([])
  })
})

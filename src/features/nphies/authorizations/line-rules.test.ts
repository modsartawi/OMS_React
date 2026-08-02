/**
 * The four pure Proof bullets of ticket 218, at the seam that owns them.
 *
 * Each states an external behaviour and would survive the form being rebuilt:
 * which fields an agent may touch at all, what happens when a days supply outside
 * the range is typed, which lines offer a selection reason, and what the cap cell
 * says when it is given a value the engine will silently ignore. None of them
 * asserts which hook fired or how a component is shaped internally.
 */
import { describe, expect, it } from 'vitest'
import type { NphiesSessionInsurance } from '@/core/models/nphies'
import {
  AGENT_EDITABLE_FIELDS,
  DAYS_SUPPLY_MAX,
  DAYS_SUPPLY_MIN,
  REQUEST_FIELDS,
  daysSupplyEntry,
  insuranceChanged,
  isAgentEditable,
  maxCoverageEntry,
  readInsuranceDraft,
  selectionReasonEditableForCategory,
  selectionReasonEnabled,
} from './line-rules'

describe('onlyFiveInputsAreEditable', () => {
  it('admits exactly the five inputs plus Selection Reason', () => {
    expect([...AGENT_EDITABLE_FIELDS].sort()).toEqual(
      [
        'headerDeductibleRate',
        'headerDeductibleMax',
        'headerPaidOutside',
        'lineQuantity',
        'lineMaxCoverage',
        'lineDaysSupply',
        'lineSelectionReason',
      ].sort(),
    )
  })

  it('refuses every derived money field — the agent corrects insurance, not merchandise', () => {
    const derived = REQUEST_FIELDS.filter((field) => !isAgentEditable(field))
    // §2.2's "out" list, whole: there is no verb for any of these and the screen
    // must not offer a control for one either.
    expect(derived).toEqual(
      expect.arrayContaining([
        'lineUnitPrice',
        'lineExtendedPrice',
        'lineAmount',
        'lineNetAmount',
        'lineVat',
        'lineDiscountPercentage',
        'lineDiscountAmount',
        'lineActualPatientShare',
        'lineDeductibleG',
        'lineDeductibleGroupName',
        'lineItemNumber',
        'plant',
      ]),
    )
  })

  it('leaves nothing unclassified — every field the form draws has an owner', () => {
    for (const field of REQUEST_FIELDS) {
      expect(typeof isAgentEditable(field)).toBe('boolean')
    }
    expect(new Set(REQUEST_FIELDS).size).toBe(REQUEST_FIELDS.length)
  })
})

describe('daysSupplyOutsideOneToOneHundredCannotBeEntered', () => {
  it('sends a value inside the range', () => {
    expect(daysSupplyEntry('60', 30)).toEqual({ kind: 'send', value: 60 })
    expect(daysSupplyEntry(String(DAYS_SUPPLY_MIN), 30)).toEqual({ kind: 'send', value: 1 })
    expect(daysSupplyEntry(String(DAYS_SUPPLY_MAX), 30)).toEqual({ kind: 'send', value: 100 })
  })

  it('refuses one outside it AT THE CELL, so no sweep exists anywhere', () => {
    expect(daysSupplyEntry('0', 30)).toEqual({ kind: 'refused', reason: 'outOfRange' })
    expect(daysSupplyEntry('101', 30)).toEqual({ kind: 'refused', reason: 'outOfRange' })
    expect(daysSupplyEntry('-5', 30)).toEqual({ kind: 'refused', reason: 'outOfRange' })
    // WPF's own three ranges (180 / 90 / 100) are gone: one range, and the widest
    // of the old ones is refused here rather than swept at submit.
    expect(daysSupplyEntry('180', 30)).toEqual({ kind: 'refused', reason: 'outOfRange' })
  })

  it('refuses a value that is not a whole number of days', () => {
    expect(daysSupplyEntry('30.5', 30)).toEqual({ kind: 'refused', reason: 'notWhole' })
    expect(daysSupplyEntry('abc', 30)).toEqual({ kind: 'refused', reason: 'notWhole' })
    expect(daysSupplyEntry('', 30)).toEqual({ kind: 'refused', reason: 'notWhole' })
  })

  it('sends nothing when the value did not change', () => {
    expect(daysSupplyEntry('30', 30)).toEqual({ kind: 'unchanged' })
    expect(daysSupplyEntry(' 30 ', 30)).toEqual({ kind: 'unchanged' })
  })
})

describe('selectionReasonIsDisabledOnGenericLinesOnly', () => {
  it('is disabled on Generic', () => {
    expect(selectionReasonEditableForCategory('Generic')).toBe(false)
    expect(selectionReasonEditableForCategory('generic')).toBe(false)
  })

  it('is enabled on every other category, including the ones that look excluded', () => {
    // `NonMed` is not a medicine and `Brand-IR` is the one the service overwrites
    // at submit — both still offer the control, because the till's rule is
    // Generic-only and this screen applies exactly that rule and no broader one.
    for (const category of ['Brand', 'Brand-IR', 'NonMed', '', 'Something new']) {
      expect(selectionReasonEditableForCategory(category)).toBe(true)
    }
  })

  it('takes the server flag as the authority when it carries one', () => {
    expect(
      selectionReasonEnabled({ deductibleGroupName: 'Brand', selectionReasonEditable: false }),
    ).toBe(false)
    expect(
      selectionReasonEnabled({ deductibleGroupName: 'Generic', selectionReasonEditable: true }),
    ).toBe(true)
  })

  it('falls back to the category rule when the projection omits the flag', () => {
    expect(
      selectionReasonEnabled({
        deductibleGroupName: 'Generic',
        selectionReasonEditable: undefined as unknown as boolean,
      }),
    ).toBe(false)
    expect(
      selectionReasonEnabled({
        deductibleGroupName: 'Brand-IR',
        selectionReasonEditable: undefined as unknown as boolean,
      }),
    ).toBe(true)
  })
})

describe('aZeroCapWarnsRatherThanSilentlyDoingNothing', () => {
  it('warns instead of sending a cap of zero', () => {
    expect(maxCoverageEntry('0', 250)).toEqual({ kind: 'refused', reason: 'zeroWillNotApply' })
  })

  it('refuses a negative cap outright', () => {
    expect(maxCoverageEntry('-1', 250)).toEqual({ kind: 'refused', reason: 'negative' })
  })

  it('refuses something that is not an amount', () => {
    expect(maxCoverageEntry('', 250)).toEqual({ kind: 'refused', reason: 'notANumber' })
    expect(maxCoverageEntry('lots', 250)).toEqual({ kind: 'refused', reason: 'notANumber' })
  })

  it('sends a positive cap, decimals and all', () => {
    expect(maxCoverageEntry('300', 250)).toEqual({ kind: 'send', value: 300 })
    expect(maxCoverageEntry('312.50', 250)).toEqual({ kind: 'send', value: 312.5 })
  })

  it('says nothing about the engine default of zero in an UNTOUCHED cell', () => {
    // The engine lands `maxCoverage: 0` on every line. Warning there would put a
    // warning on every row of an untouched request and train the agent past it.
    expect(maxCoverageEntry('0', 0, false)).toEqual({ kind: 'unchanged' })
    expect(maxCoverageEntry('300', 300, false)).toEqual({ kind: 'unchanged' })
  })

  it('🚩 but warns when the agent TYPES a zero over a stored zero', () => {
    // The case the rule exists for: the agent means "cap this at nothing", the
    // value already reads 0, and a silent no-op would leave them believing it
    // took effect.
    expect(maxCoverageEntry('0', 0, true)).toEqual({ kind: 'refused', reason: 'zeroWillNotApply' })
  })
})

describe('the header insurance block', () => {
  const DRAFT = {
    g1: { rate: '20', max: '500', paid: '0' },
    g2: { rate: '30', max: '500', paid: '200' },
    g3: { rate: '100', max: '0', paid: '0' },
  }

  it('reads three groups of rate, cap and paid-outside', () => {
    const read = readInsuranceDraft(DRAFT)
    expect(read.ok).toBe(true)
    expect(read.ok && read.insurance).toEqual({
      g1: { rate: 20, max: 500, paid: 0 },
      g2: { rate: 30, max: 500, paid: 200 },
      g3: { rate: 100, max: 0, paid: 0 },
    })
  })

  it('refuses a rate outside 0–100 and names the field that holds it', () => {
    const read = readInsuranceDraft({ ...DRAFT, g2: { rate: '130', max: '500', paid: '0' } })
    expect(read.ok).toBe(false)
    expect(read.ok === false && read.refusals).toEqual([
      { group: 'g2', field: 'rate', reason: 'rateOutOfRange' },
    ])
  })

  it('refuses a negative cap or paid-outside', () => {
    const read = readInsuranceDraft({ ...DRAFT, g1: { rate: '20', max: '-1', paid: '-2' } })
    expect(read.ok === false && read.refusals).toEqual([
      { group: 'g1', field: 'max', reason: 'negative' },
      { group: 'g1', field: 'paid', reason: 'negative' },
    ])
  })

  it('refuses a blank amount rather than reading it as zero', () => {
    const read = readInsuranceDraft({ ...DRAFT, g3: { rate: '100', max: '', paid: '0' } })
    expect(read.ok === false && read.refusals).toEqual([
      { group: 'g3', field: 'max', reason: 'notANumber' },
    ])
  })

  it('knows when nothing was actually changed, so an idle blur sends no verb', () => {
    const current: NphiesSessionInsurance = {
      g1: { rate: 20, max: 500, paid: 0 },
      g2: { rate: 30, max: 500, paid: 200 },
      g3: { rate: 100, max: 0, paid: 0 },
    }
    const read = readInsuranceDraft(DRAFT)
    expect(read.ok && insuranceChanged(current, read.insurance)).toBe(false)
    const bumped = readInsuranceDraft({ ...DRAFT, g1: { rate: '25', max: '500', paid: '0' } })
    expect(bumped.ok && insuranceChanged(current, bumped.insurance)).toBe(true)
  })
})

/**
 * 🔑 **The amount, read back in words** — the unit test ticket 271's Proof names by
 * hand: *"amount-in-words, including grouping, the rounded figure, and both
 * currencies"*.
 *
 * What is really under test is one property: **the sentence and the digits can never
 * disagree**. Every assertion below pairs `grouped` with the words, because a guard
 * that printed `50,000.57` beside *fifty thousand riyals and fifty-six halalas*
 * would be worse than no guard — it would teach an accountant to stop reading it.
 */
import { describe, expect, it } from 'vitest'
import { amountInWords, numberToWords } from './amount-words'

describe('numberToWords', () => {
  it('spells the small numbers a halala count lands in', () => {
    expect(numberToWords(0)).toBe('zero')
    expect(numberToWords(7)).toBe('seven')
    expect(numberToWords(15)).toBe('fifteen')
    expect(numberToWords(20)).toBe('twenty')
    // Hyphenated, so `21` and `2100` are unmistakable read aloud on a phone call.
    expect(numberToWords(57)).toBe('fifty-seven')
    expect(numberToWords(99)).toBe('ninety-nine')
  })

  it('spells hundreds and thousands in en-US style — no "and"', () => {
    expect(numberToWords(100)).toBe('one hundred')
    expect(numberToWords(105)).toBe('one hundred five')
    expect(numberToWords(250)).toBe('two hundred fifty')
    expect(numberToWords(1_000)).toBe('one thousand')
    expect(numberToWords(1_234)).toBe('one thousand two hundred thirty-four')
  })

  it('🔑 keeps five hundred and fifty thousand a whole sentence apart', () => {
    // The two figures the guard exists for: one keystroke apart as digit strings.
    expect(numberToWords(500)).toBe('five hundred')
    expect(numberToWords(50_000)).toBe('fifty thousand')
  })

  it('spells the scales above a branch difference, in case one is typed', () => {
    expect(numberToWords(1_000_000)).toBe('one million')
    expect(numberToWords(2_500_000)).toBe('two million five hundred thousand')
    expect(numberToWords(1_000_000_000)).toBe('one billion')
  })
})

describe('amountInWords — SAR, two decimals', () => {
  it('groups the figure and words both magnitudes', () => {
    const a = amountInWords(50_000.57, 'SAR')
    expect(a.grouped).toBe('50,000.57')
    expect(a.majorValue).toBe(50_000)
    expect(a.majorWords).toBe('fifty thousand')
    expect(a.minorValue).toBe(57)
    expect(a.minorWords).toBe('fifty-seven')
  })

  it('🚩 splits in integer minor units — 50000.57 is fifty-SEVEN halalas', () => {
    // `50000.57 * 100` is 5000056.999… in IEEE-754. A naive floor of the remainder
    // reads back fifty-SIX beside a figure printed as .57 — the exact disagreement
    // between the words and the digits this guard exists to make impossible.
    const a = amountInWords(50_000.57, 'SAR')
    expect(a.minorValue).toBe(57)
    expect(a.grouped.endsWith('.57')).toBe(true)
  })

  it('🔑 reads back the ROUNDED figure a 2-decimal branch can physically count', () => {
    // The Proof bullet: type a fractional amount at a SAR branch and watch it. The
    // words describe what will be posted, not the third decimal that cannot be.
    const a = amountInWords(50.567, 'SAR')
    expect(a.value).toBe(50.57)
    expect(a.grouped).toBe('50.57')
    expect(a.minorValue).toBe(57)
    expect(a.minorWords).toBe('fifty-seven')
    expect(a.decimals).toBe(2)
  })

  it('has no minor magnitude on a whole amount', () => {
    const a = amountInWords(500, 'SAR')
    expect(a.grouped).toBe('500.00')
    expect(a.majorWords).toBe('five hundred')
    expect(a.minorValue).toBe(0)
  })

  it('has no major magnitude on an amount under one unit', () => {
    const a = amountInWords(0.5, 'SAR')
    expect(a.majorValue).toBe(0)
    expect(a.minorValue).toBe(50)
    expect(a.minorWords).toBe('fifty')
  })
})

describe('amountInWords — BHD, three decimals', () => {
  it('🔑 keeps full fils rather than rounding a Bahraini branch to two', () => {
    // D10's whole constituency: 95.250 at a BHD branch is 95.250, and the words say
    // two hundred fifty fils — not twenty-five of anything.
    const a = amountInWords(95.25, 'BHD')
    expect(a.decimals).toBe(3)
    expect(a.grouped).toBe('95.250')
    expect(a.majorWords).toBe('ninety-five')
    expect(a.minorValue).toBe(250)
    expect(a.minorWords).toBe('two hundred fifty')
  })

  it('keeps the third decimal a SAR branch would lose', () => {
    const bhd = amountInWords(50.567, 'BHD')
    expect(bhd.value).toBe(50.567)
    expect(bhd.minorValue).toBe(567)
    // …and the same typed figure at a SAR branch is a different sentence.
    expect(amountInWords(50.567, 'SAR').minorValue).toBe(57)
  })

  it('groups a large dinar amount', () => {
    const a = amountInWords(12_345.678, 'BHD')
    expect(a.grouped).toBe('12,345.678')
    expect(a.majorWords).toBe('twelve thousand three hundred forty-five')
    expect(a.minorWords).toBe('six hundred seventy-eight')
  })
})

describe('amountInWords — what is not an amount', () => {
  it('reads an unusable figure as zero rather than throwing', () => {
    // The form refuses to commit one; a review step that crashed on a stray `-`
    // would be a broken screen instead of a refused entry.
    for (const bad of [null, undefined, Number.NaN, -500, 0]) {
      const a = amountInWords(bad as number, 'SAR')
      expect(a.value).toBe(0)
      expect(a.majorWords).toBe('zero')
      expect(a.minorValue).toBe(0)
    }
  })

  it('🚩 reads a figure below the branch’s smallest unit as ZERO — the form refuses it', () => {
    // `0.004` at a SAR branch parses as a number and is not money that branch can
    // count: it would post as zero and read back as *zero riyals*. The form measures
    // its refusal against this same `value`, so the sentence and the rule agree.
    expect(amountInWords(0.004, 'SAR').value).toBe(0)
    expect(amountInWords(0.004, 'SAR').majorWords).toBe('zero')
    // …while the same figure at a BHD branch is four fils, and perfectly postable.
    expect(amountInWords(0.004, 'BHD').value).toBe(0.004)
    expect(amountInWords(0.004, 'BHD').minorValue).toBe(4)
  })

  it('🔑 words an UNKNOWN currency at three decimals — the scale money is held at', () => {
    // ⚠️ **The opposite of what 271 asserted, and 274 is why.** No read door carries
    // `currencyKey` (`.afk/FINDINGS-274.md` §B6). At two decimals a Bahraini `95.505`
    // would be read back as *95.51*, approved, and stored as `95.505` — the words and
    // the ledger disagreeing, which is the failure D4's read-back exists to prevent.
    expect(amountInWords(10.006, '').decimals).toBe(3)
    expect(amountInWords(95.505, '').grouped).toBe('95.505')
    expect(amountInWords(95.505, '').minorValue).toBe(505)
    // …and a named currency still rules, so nothing regresses the day §B6 lands.
    expect(amountInWords(10.006, 'KWD').grouped).toBe('10.01')
    expect(amountInWords(10.006, 'KWD').decimals).toBe(2)
  })
})

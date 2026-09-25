import { describe, expect, it } from 'vitest'
import type { VoucherPage } from '@/core/models/collection'
import {
  SETTLEMENT_DESCRIPTION,
  SURPLUS_DESCRIPTION,
  VOUCHER_SCENARIOS,
} from './voucher-fixture'
import { voucherBox } from './voucher-box'

/**
 * Ticket 312's pure Proof: what the collection voucher's red box carries.
 *
 * BackOffice 1984 put the accountant's description on the receipt page as
 * `deductionDescriptionText` — the box's third line, under the entry number, on
 * both page kinds. The failures this guards are both silent in a typecheck:
 *
 * - ⚠ **`''` must draw no line.** An empty third line grows the box on every
 *   ordinary receipt and on every entry posted before the description was
 *   required; the slot 246 signed off would move.
 * - ⚠ **The description is the server's, verbatim.** Up to 200 characters,
 *   wrapped by the sheet — a client that cut, trimmed or re-derived it would
 *   print words the accountant did not post.
 */

const page = (key: string): VoucherPage => {
  const scenario = VOUCHER_SCENARIOS.find((s) => s.key === key)
  if (!scenario) throw new Error(`no voucher scenario '${key}'`)
  return scenario.document.pages[0]
}

describe('voucherBox', () => {
  it('an ordinary day keeps the empty hand-fill slot — the caption and nothing else', () => {
    expect(voucherBox(page('posted'))).toEqual({
      label: 'خصم فائض : ',
      amount: null,
      entry: null,
      description: null,
    })
  })

  it('a day that spent a surplus carries the description UNDER the amount and the entry', () => {
    expect(voucherBox(page('surplus-described'))).toEqual({
      label: 'خصم فائض : ',
      amount: '200.00',
      entry: 'رقم القيد / Entry No. 143',
      description: SURPLUS_DESCRIPTION,
    })
  })

  it('a settlement page carries the shortage’s description under its entry, with no amount', () => {
    expect(voucherBox(page('settlement-described'))).toEqual({
      label: 'تسوية عجز : ',
      amount: null,
      entry: 'رقم القيد / Entry No. 144',
      description: SETTLEMENT_DESCRIPTION,
    })
  })

  it.each(['surplus', 'settlement'])(
    'a %s page without a description prints the entry number alone — no blank third line',
    (key) => {
      const box = voucherBox(page(key))
      expect(box.entry).toBe('رقم القيد / Entry No. 143')
      expect(box.description).toBeNull()
    },
  )

  it('a surplus whose entry was never stamped keeps its amount alone', () => {
    const box = voucherBox(page('surplus-unnumbered'))
    expect(box.amount).toBe('200.00')
    expect(box.entry).toBeNull()
    expect(box.description).toBeNull()
  })

  it('passes the full 200 characters through — never cut, on either page kind', () => {
    // The fixtures sit AT the ceiling a post accepts; the drive proves they wrap.
    expect(SURPLUS_DESCRIPTION).toHaveLength(200)
    expect(SETTLEMENT_DESCRIPTION).toHaveLength(200)
    expect(voucherBox(page('surplus-described')).description).toHaveLength(200)
    expect(voucherBox(page('settlement-described')).description).toHaveLength(200)
  })

  it('never re-derives the text: no trim, no collapse of inner spaces, no prefix', () => {
    const raw = '  عجز  نقدية / Cash  short '
    const box = voucherBox({ ...page('settlement-described'), deductionDescriptionText: raw })
    expect(box.description).toBe(raw)
  })

  it('a server without BackOffice 1984 (no such field at all) still draws no third line', () => {
    const { deductionDescriptionText: _omitted, ...older } = page('surplus')
    expect(voucherBox(older as VoucherPage).description).toBeNull()
  })

  it('draws the caption even when every occupant is empty — it is the form’s own label', () => {
    const box = voucherBox({
      ...page('settlement'),
      deductionEntryText: '',
      deductionDescriptionText: '',
    })
    expect(box).toEqual({ label: 'تسوية عجز : ', amount: null, entry: null, description: null })
  })
})

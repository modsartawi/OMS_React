/* Four collection receipts (سند قبض), as TEST DATA. Graduated out of
 * `__prototype__/voucher/voucher-mock.ts` (ticket 246).
 *
 * ⚠ **These are no longer what the screen renders.** Ticket 259 put
 * `CollectionWeb/Receipt/{collectionReceiptId}` behind the print route, and the
 * CONTRACT these scenarios are typed against moved with it, to
 * `@/core/models/collection`. What is left here is four documents the drives
 * serve over a stubbed wire — which is exactly what a fixture was always for,
 * now that it is no longer standing in for a door.
 *
 * The values are not invented. Every split and every amount-in-words below is a
 * value PINNED BY A TEST in `Tests\Data.Tests\` (`CollectionVoucherFormatTests`,
 * `ArabicTafqeetTests`) and transcribed from §7 of the fidelity inventory — so a
 * wrong-looking string on screen is a rendering fault, never a made-up datum.
 * The SHAPES are contractual; the values are not (spec 249, story 98): live data
 * carries longer names, a 3dp minor cell, and legitimately empty pharmacists.
 * 259 confirmed that against the real door rather than assuming it.
 */

import type { VoucherDocument, VoucherPage } from '@/core/models/collection'

const BASE: VoucherPage = {
  noText: '0000000005',
  storeCode: '1042',
  collectedAtText: '2026-08-06 21:14',
  collectorName: 'عبدالله بن ناصر القحطاني',
  collectorId: '30417',
  pharmacistName: 'محمد سمير الحلبي',
  pharmacistId: '81265',
  // cash 10000.23 + card 3333.00 = grand 13333.23 — and `13333.23 SAR → 13333 | 23`
  // is itself a pinned split (§7.1), so the whole scenario is test-backed.
  grand: { whole: '13333', minor: '23' },
  cash: { whole: '10000', minor: '23' },
  card: { whole: '3333', minor: '00' },
  cashWords: 'فقط عشرة آلاف ريال و ثلاث و عشرون هللة لا غير',
  cardWords: 'فقط ثلاثة آلاف و ثلاثمائة و ثلاثة و ثلاثون ريالا لا غير',
  shiftDayName: 'الخميس',
  shiftDayText: '2026-08-06',
  // Empty on the everyday receipt, which is the point: the خصم فائض box is a
  // hand-fill slot until a close spends a surplus (spec 1173 D9/D10).
  deductionLabelText: 'خصم فائض : ',
  surplusAmountText: '',
  deductionEntryText: '',
}

/**
 * A fixture case, keyed by the id that stands in for `:collectionReceiptId`
 * until the door lands: `/collection/receipt/posted` renders the first one.
 *
 * What each case proves is a COMMENT, not a field: the prototype's switcher read
 * `label`/`proves` off the model, and carrying them into shipped code would ship
 * a screenful of prose to every user for a switcher that no longer exists.
 */
export type VoucherScenario = {
  key: string
  document: VoucherDocument
}

export const VOUCHER_SCENARIOS: VoucherScenario[] = [
  {
    // The everyday receipt, one shift: the خصم فائض box shows its red label and
    // nothing else (a hand-fill slot), and there is no POSTED banner because
    // taking a number IS the posted state.
    key: 'posted',
    document: { pages: [BASE] },
  },
  {
    // One receipt covering two shifts prints TWO A4 blocks, stamped -1 and -2:
    // MarkPosted runs over the whole page set (245 §3), and page order is
    // contractual (the shift's OpenedAt ascending), not cosmetic.
    key: 'multishift',
    document: {
      pages: [
        // Both sheets carry BASE's amounts deliberately: every money string here
        // is a §7.1/§7.5 pinned pair, and inventing a second pair would put a
        // figure on the page whose amount-in-words nobody has ever computed —
        // exactly the fabricated datum this fixture exists to rule out. What the
        // two pages differ in is what the multi-shift case is ABOUT: the stamp.
        { ...BASE, noText: '0000000005-1', collectedAtText: '2026-08-06 14:02' },
        { ...BASE, noText: '0000000005-2' },
      ],
    },
  },
  {
    // A 3-decimal currency: the minor cells carry three digits and the tafqeet
    // switches nouns. The cell sizes to the VALUE — the client holds no currency
    // lookup — and must not clip `005`.
    key: 'bhd',
    document: {
      pages: [
        {
          ...BASE,
          storeCode: '7301',
          grand: { whole: '5', minor: '005' },
          cash: { whole: '3', minor: '005' },
          card: { whole: '2', minor: '000' },
          cashWords: 'فقط ثلاثة دنانير و خمسة فلوس لا غير',
          cardWords: 'فقط ديناران لا غير',
        },
      ],
    },
  },
  {
    // Spec 1173 D9/D10 — a close that SPENT A SURPLUS: the only case where the
    // خصم فائض box is not a blank slot. The cash figure is the one the branch
    // actually handed over, already net of the 200 — the amount below NAMES the
    // deduction, it does not ask the sheet to apply it.
    //
    // ⚠ The money strings are BASE's, deliberately: every split and every
    // tafqeet on this fixture is a value pinned by a test in `Tests\Data.Tests\`,
    // and inventing a second pair would put an amount-in-words on the page that
    // nobody has ever computed. What this case is ABOUT is the box.
    key: 'surplus',
    document: {
      pages: [
        {
          ...BASE,
          surplusAmountText: '200.00',
          deductionEntryText: 'رقم القيد / Entry No. 143',
        },
      ],
    },
  },
  {
    // Spec 1173 — the same close on a receipt whose entry number was never
    // stamped (a reprint off an older row). The amount stands ALONE: the box must
    // not print a blank second line, and `Entry No. 0` is not a number anybody
    // can ring the accountant about.
    key: 'surplus-unnumbered',
    document: {
      pages: [{ ...BASE, surplusAmountText: '200.00', deductionEntryText: '' }],
    },
  },
  {
    // A SHORTAGE SETTLEMENT receipt (1181, amended by owner ruling 2026-08-15):
    // the SAME box, relabelled `تسوية عجز` and naming the entry — there is no
    // second block beside it and no amount in it, because a settlement receipt
    // spends no surplus. The شبكة cells dash: a `0.00` there would state that
    // this branch took no card money on a day, and there was no day.
    //
    // ⚠ The cash pair and its tafqeet are BASE's, for the reason the surplus
    // case states: this fixture never invents an amount-in-words. What this case
    // is ABOUT is the box.
    key: 'settlement',
    document: {
      pages: [
        {
          ...BASE,
          card: { whole: '—', minor: '—' },
          cardWords: '—',
          deductionLabelText: 'تسوية عجز : ',
          surplusAmountText: '',
          deductionEntryText: 'رقم القيد / Entry No. 143',
        },
      ],
    },
  },
  {
    // Zero takings: the money boxes print 0 / 00, never blank — while a missing
    // pharmacist renders an EMPTY fill-line of natural width, never a 0 and
    // never a collapsed run.
    key: 'zero',
    document: {
      pages: [
        {
          ...BASE,
          grand: { whole: '0', minor: '00' },
          cash: { whole: '0', minor: '00' },
          card: { whole: '0', minor: '00' },
          cashWords: 'فقط صفر ريال لا غير',
          cardWords: 'فقط صفر ريال لا غير',
          pharmacistName: '',
          pharmacistId: '',
        },
      ],
    },
  },
]

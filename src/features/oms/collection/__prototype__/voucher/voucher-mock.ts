/* PROTOTYPE — throwaway. Wayfinder ticket 246 (map 240).
 *
 * The print-ready receipt model, as the browser would receive it, plus the
 * scenarios the side-by-side sign-off is run against.
 *
 * EVERY string here is pre-formatted. That is map 240's settled decision — the
 * builders move server-side and React renders strings, so the two clients cannot
 * drift. This type is therefore also a first sketch of ticket 245's contract:
 * note that nothing here is a number, a Date, or a currency code.
 *
 * The values are not invented. Every split, every variance string and every
 * amount-in-words below is a value PINNED BY A TEST in `Tests\Data.Tests\`
 * (`CollectionVoucherFormatTests`, `ArabicTafqeetTests`) and transcribed from
 * §7 of the fidelity inventory — so a wrong-looking string on screen is a
 * rendering fault, never a made-up datum.
 */

export type AmountParts = {
  /** Whole units. Carries the sign on a negative: `-3.25` → `-3`. §7.1 */
  whole: string
  /** Minor units, left-padded to the currency's dp: `0.5 SAR` → `50`. §7.1 */
  minor: string
}

export type VoucherModel = {
  /** Drives the green POSTED banner. Always true on the HQ/inquiry path. */
  isPosted: boolean
  /** 10-digit zero-padded, or `—` before a number is assigned. §7.2 */
  noText: string
  storeCode: string
  /** `''` when the drawer balanced; else `فائض <amt>` / `عجز <amt>`. §7.3 */
  varianceText: string
  /** `مطابق` iff commercial rounding absorbed a fraction. §7.4 — see O4. */
  matchedMarkText: string
  /** `yyyy-MM-dd HH:mm`. §7.6 */
  collectedAtText: string
  collectorName: string
  collectorId: string
  pharmacistName: string
  pharmacistId: string
  grand: AmountParts
  cash: AmountParts
  card: AmountParts
  /** `فقط … لا غير`. §7.5 */
  cashWords: string
  cardWords: string
  /** Weekday name under ar-SA — a Hijri culture, so PINNED server-side. §7.6 */
  shiftDayName: string
  /** `yyyy-MM-dd`. §7.6 */
  shiftDayText: string
}

const BASE: VoucherModel = {
  isPosted: true,
  noText: '0000000005',
  storeCode: '1042',
  varianceText: '',
  matchedMarkText: '',
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
}

export type Scenario = {
  key: string
  label: string
  /** What this case puts in front of the sign-off. */
  proves: string
  model: VoucherModel
}

export const SCENARIOS: Scenario[] = [
  {
    key: 'posted',
    label: 'Posted · balanced drawer',
    proves:
      'The everyday HQ receipt. خصم فائض box shows its red label and nothing else (§3, VarianceText("")).',
    model: BASE,
  },
  {
    key: 'over',
    label: 'Over — فائض 10.25',
    proves: 'The variance box carrying an amount. Word carries the direction; the amount is UNSIGNED (§7.3).',
    model: { ...BASE, varianceText: 'فائض 10.25' },
  },
  {
    key: 'short',
    label: 'Short — عجز 3.25',
    proves: 'Same box, other direction. Confirms the box side against the paper (O1).',
    model: { ...BASE, varianceText: 'عجز 3.25' },
  },
  {
    key: 'matched',
    label: 'مطابق (green) — the O4 case',
    proves:
      'Commercial rounding absorbed a sub-riyal fraction. ⚠ This NEVER renders on the HQ path the web uses — FromInquiryRow leaves the rounding flags false. Judging whether the mark should exist at all is O4.',
    model: { ...BASE, varianceText: '', matchedMarkText: 'مطابق' },
  },
  {
    key: 'unposted',
    label: 'Unposted — No. is —',
    proves: 'No banner, and the em dash rather than an empty run (§3, NoText). Should not be reachable from an inquiry row.',
    model: { ...BASE, isPosted: false, noText: '—' },
  },
  {
    key: 'bhd',
    label: '3-decimal currency (BHD)',
    proves:
      'Minor cells widen to three digits and the tafqeet switches nouns (دينار/فلس). The MinWidth=40 minor cell must not clip `005`.',
    model: {
      ...BASE,
      storeCode: '7301',
      varianceText: 'عجز 3.250',
      grand: { whole: '5', minor: '005' },
      cash: { whole: '3', minor: '005' },
      card: { whole: '2', minor: '000' },
      cashWords: 'فقط ثلاثة دنانير و خمسة فلوس لا غير',
      cardWords: 'فقط ديناران لا غير',
    },
  },
  {
    key: 'zero',
    label: 'Zero takings · empty pharmacist',
    proves:
      'Money boxes print 0 / 00 — never blank. A missing name renders an EMPTY fill-line of natural width, never a 0 and never collapsed (§3).',
    model: {
      ...BASE,
      grand: { whole: '0', minor: '00' },
      cash: { whole: '0', minor: '00' },
      card: { whole: '0', minor: '00' },
      cashWords: 'فقط صفر ريال لا غير',
      cardWords: 'فقط صفر ريال لا غير',
      pharmacistName: '',
      pharmacistId: '',
    },
  },
]

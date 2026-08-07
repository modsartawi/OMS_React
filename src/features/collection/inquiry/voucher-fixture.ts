/* The print-ready collection receipt (سند قبض) — the contract of spec 249 /
 * ticket 245 §3, plus the checked-in fixture the facsimile renders until the
 * `CollectionWeb/Receipt/{collectionReceiptId}` door lands (ticket 259).
 * Graduated out of `__prototype__/voucher/voucher-mock.ts` (ticket 246).
 *
 * EVERY string here is pre-formatted, and that is the whole point: the builders
 * live server-side and React renders strings, so the WPF and the web cannot
 * drift. Nothing on this type is a number, a `Date` or a currency code — so the
 * client has nothing to call `toFixed` on, and a missing string is a SERVER
 * change, never a client one.
 *
 * The values are not invented. Every split and every amount-in-words below is a
 * value PINNED BY A TEST in `Tests\Data.Tests\` (`CollectionVoucherFormatTests`,
 * `ArabicTafqeetTests`) and transcribed from §7 of the fidelity inventory — so a
 * wrong-looking string on screen is a rendering fault, never a made-up datum.
 * The SHAPES are contractual; the values are not (spec 249, story 98): live data
 * carries longer names, a 3dp minor cell, and legitimately empty pharmacists.
 *
 * ⚠ Deliberately absent, per 246's sign-off (245 §3): `isPosted` — the green
 * POSTED banner is gone, `No.` IS the posted state; `varianceText` and
 * `matchedMarkText` — the `خصم فائض` box is a hand-fill slot that is ALWAYS
 * empty; and `currencyCode` — the minor cell sizes to `minor.length`, never to a
 * lookup. The receipt carries no reconciliation data at all.
 */

export type AmountParts = {
  /** Whole units. Carries the sign on a negative: `-3.25` → `-3`. §7.1 */
  whole: string
  /** Minor units, left-padded to the currency's dp: `0.5 SAR` → `50`. §7.1 */
  minor: string
}

/** One A4 sheet. A receipt covering several shifts returns several of these. */
export type VoucherPage = {
  /** 10-digit zero-padded, + `-{n}` on a multi-shift receipt. §7.2 */
  noText: string
  storeCode: string
  /** `yyyy-MM-dd HH:mm`. §7.6 */
  collectedAtText: string
  collectorName: string
  collectorId: string
  /** `''` is legal — renders an empty fill-line, never a `0`. */
  pharmacistName: string
  /** `''` is legal. */
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

/** What `CollectionWeb/Receipt/{collectionReceiptId}` returns (245 §3). */
export type VoucherDocument = {
  pages: VoucherPage[]
}

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
}

/**
 * A fixture case, keyed by the id that stands in for `:collectionReceiptId`
 * until the door lands: `/collection/receipt/posted` renders the first one.
 */
export type VoucherScenario = {
  key: string
  label: string
  /** What this case puts in front of a reader. */
  proves: string
  document: VoucherDocument
}

export const VOUCHER_SCENARIOS: VoucherScenario[] = [
  {
    key: 'posted',
    label: 'The everyday receipt · one shift',
    proves:
      'The ordinary HQ sheet. The خصم فائض box shows its red label and nothing else — it is a hand-fill slot, and there is no POSTED banner because No. IS the posted state.',
    document: { pages: [BASE] },
  },
  {
    key: 'multishift',
    label: 'Multi-shift receipt · two sheets',
    proves:
      'One receipt covering two shifts prints TWO A4 blocks, stamped 0000000005-1 and 0000000005-2 — MarkPosted runs over the whole page set (245 §3), and page order is contractual (the shift OpenedAt ascending), not cosmetic.',
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
    key: 'bhd',
    label: '3-decimal currency (BHD)',
    proves:
      'Minor cells widen to three digits and the tafqeet switches nouns (دينار/فلس). The cell sizes to minor.length — the client holds no currency lookup — and must not clip `005`.',
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
    key: 'zero',
    label: 'Zero takings · empty pharmacist',
    proves:
      'Money boxes print 0 / 00 — never blank. A missing name renders an EMPTY fill-line of natural width, never a 0 and never collapsed.',
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

/** The fixture stand-in for the lookup ticket 259 replaces with the real door. */
export function findVoucherFixture(collectionReceiptId: string | undefined): VoucherDocument | null {
  return VOUCHER_SCENARIOS.find((s) => s.key === collectionReceiptId)?.document ?? null
}

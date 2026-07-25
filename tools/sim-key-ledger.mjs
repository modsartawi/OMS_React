// THE simulation key ledger — one list, two readers (ticket 121, spec 110).
//
// `tools/check-sim-keys.mjs` (the re-runnable gate) and
// `src/features/pricing/simulation/i18n-keys.test.ts` (the vitest half) both read it.
// They check different halves — the script sweeps CALL SITES and unreferenced keys, the
// test asserts the JSON — and a ledger maintained twice can go green on a stale copy,
// which is the one failure the whole expand–contract argument cannot survive.
//
// Plain `.mjs` with no side effects so both a Node script and vitest can import it.

/**
 * Every key the rework retired: the ones that left WITH a dissolving file, and the ones
 * that needed a sweep. Flat on purpose — what is asserted is that the ledger is
 * complete, not which slice each entry belongs to.
 */
export const RETIRED = [
  // 113 — the three frames that dissolved into the run strip.
  'header.title',
  'summary.title',
  'actions.title',
  // 115 — the money labels of the old order (subtotal · promo · gross · tax · net).
  // Also named on their own below: they are the anti-collision assertion.
  'results.subtotal',
  'results.promo',
  'results.gross',
  'results.tax',
  'results.net',
  // 115 — the status column, the promo-none mark, the split Item column, the banner.
  'results.status',
  'results.promoNone.mark',
  'results.promoNone.label',
  'results.material',
  'results.description',
  'banner.counts',
  // 115 — a healthy line renders no label at all, so `OK` has no call site.
  'status.ok',
  // 116 — the detail panel, its four tiles, the statistical toggle, the elements pane.
  'detail.title',
  'detail.tiles.base',
  'detail.tiles.discounts',
  'detail.tiles.tax',
  'detail.tiles.net',
  'detail.showStatistical',
  'detail.hideStatistical',
  'bonus.tabs.elements',
  'bonus.elements.empty',
  // 116, by sweep rather than with a file — `ConditionCard` survives it.
  'detail.records',
  'detail.subRate',
  // ---- 121's own sweep: the keys 123 deliberately LEFT STANDING ------------------
  // They stayed while call sites were still moving, so no slice in between could
  // half-retire one, and they leave together in one pass once nothing is moving.
  'summary.netTotal',
  // Already dead before the rework began — the one entry that is not a consequence of
  // it, and the reason the ledger is SWEPT rather than diffed.
  'summary.elapsed',
  'results.promoKind.free',
  'results.promoKind.percent',
  'results.promoKind.fixed',
  'results.promoKind.setprice',
  'results.promoKind.unknown',
  'results.promoRole.buy',
  'results.promoRole.get',
  'results.promoRole.buy+get',
  'results.empty',
  // Found BY the sweep rather than handed to it: the old Summary tile's em-dash
  // placeholder. `results.notPriced` and the line's two keyless marks (`·`, `—`) cover
  // every "nothing here" the rebuilt screen shows, so this lost its call site with the
  // tile and no ledger entry ever named it.
  'summary.placeholder',
]

/** The five whose natural rename target was OCCUPIED by a different number — which is
 *  why they were minted fresh instead. A key that resolves to plausible English about
 *  the wrong figure is strictly worse than a raw key, which is at least visibly broken. */
export const RETIRED_MONEY = [
  'results.subtotal',
  'results.promo',
  'results.gross',
  'results.tax',
  'results.net',
]

/** Values that must carry their own uppercase — a CSS transform is a no-op on Arabic
 *  script, so it would leave these looking un-keyed rather than visibly needing a
 *  translator's decision. */
export const UPPERCASE = [
  'strip.key.plant',
  'strip.key.org',
  'strip.key.chan',
  'strip.key.proc',
  'strip.key.loy',
  'strip.key.tier',
  'strip.key.elem',
  'detail.stat',
  'detail.badge.promotion',
  'detail.badge.manual',
  'detail.badge.header',
  'promo.free',
]

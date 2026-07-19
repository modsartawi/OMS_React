import type { PromoKind } from './promo-view'

// Shared promo-kind palette + glyphs (map 039 sketch 042): free = good/green,
// percent = accent, fixed = warn/amber, setprice = info/blue. One source so the grid
// Promotion cell (ticket 046) and the buy→get blocks (ticket 047) read as one visual
// language and never drift apart.

/** kind → chip / icon-tile colour classes. */
export const KIND_CLASS: Record<PromoKind, string> = {
  free: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400',
  percent: 'bg-primary/15 text-primary',
  fixed: 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
  setprice: 'bg-blue-500/15 text-blue-700 dark:text-blue-400',
}

/** kind → the glyph shown on a block's icon tile (prototype 042). */
export const KIND_GLYPH: Record<PromoKind, string> = {
  free: '＋',
  percent: '%',
  fixed: '−',
  setprice: '=',
}

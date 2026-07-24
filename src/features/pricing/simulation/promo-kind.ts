import type { PromoKind } from './promo-view'

// Shared promo-kind glyphs (map 039 sketch 042). Kind is an identity distinguisher,
// not a severity — spec 082 D-13 / ticket 088 retired the per-kind colour map so hue
// stays reserved for severity; every kind chip now renders on the neutral
// `bg-muted text-muted-foreground` ground with its glyph and text label carrying the
// meaning.

/** kind → the glyph shown on a block's icon tile (prototype 042). */
export const KIND_GLYPH: Record<PromoKind, string> = {
  free: '＋',
  percent: '%',
  fixed: '−',
  setprice: '=',
}

/** The single neutral chip ground every kind chip now shares — one source so the grid
 *  Promotion cell (ticket 046) and the buy→get blocks (ticket 047) can't drift apart,
 *  the invariant the retired per-kind colour map used to hold (ticket 088). */
export const KIND_CHIP = 'bg-muted text-muted-foreground'

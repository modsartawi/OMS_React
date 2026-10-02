/**
 * The page's writing direction — a BOOT fact (spec 380 F22, ticket 383; measured in 378 §1).
 *
 * `index.html`'s pre-paint script sets `<html dir>` from the stored locale (`oms.locale`)
 * before anything renders, the way it sets the theme. Everything that depends on direction
 * reads it from there exactly once, at module load:
 *
 * - AG Grid's `enableRtl` is `@initial` in v36 — a mounted grid cannot change direction — so
 *   `@/core/theme/ag-grid-theme` hands it to every grid through its one
 *   `provideGlobalGridOptions` call. No grid opts in.
 * - AG Grid pins to a PHYSICAL side: `pinned: 'left'` stays left in a mirrored grid, which put
 *   a pinned identifier at the reading END (378, `fixed-ar-light.png`). A column never names a
 *   side; it pins to {@link pinStart} or {@link pinEnd}.
 *
 * So a language switch writes `oms.locale` and RELOADS the page. Direction is never flipped
 * live: every grid already mounted would keep the old one.
 */

export type Direction = 'ltr' | 'rtl'

/** AG Grid's own pinning sides — physical, not logical. */
export type PinSide = 'left' | 'right'

/** `<html dir>` as it stands now. */
export function documentDirection(): Direction {
  // No document in a node module graph (vitest): the column modules that import this are
  // tested there, and LTR is what they have always assumed.
  if (typeof document === 'undefined') return 'ltr'
  return document.documentElement.dir === 'rtl' ? 'rtl' : 'ltr'
}

/** The pin side at the reading start in `dir`. */
export function pinStartFor(dir: Direction): PinSide {
  return dir === 'rtl' ? 'right' : 'left'
}

/** The pin side at the reading end in `dir`. */
export function pinEndFor(dir: Direction): PinSide {
  return dir === 'rtl' ? 'left' : 'right'
}

/** Sonner's corners — physical, like AG Grid's pinning sides. */
export type ToasterPosition = 'bottom-left' | 'bottom-right'

/**
 * Where toasts sit in `dir`: the bottom END (spec 380 F16, 377 §2), `bottom-right` in LTR
 * and `bottom-left` under RTL. Bottom, because a top corner sits on the top bar's store chip
 * and bell, or on the open bell panel once pushed under the bar.
 */
export function toasterPositionFor(dir: Direction): ToasterPosition {
  return dir === 'rtl' ? 'bottom-left' : 'bottom-right'
}

/** The page's direction, as `index.html` set it before first paint. */
export const bootDirection: Direction = documentDirection()

/** Pin an identifier column here: the reading start, `'left'` in LTR and `'right'` under RTL. */
export const pinStart: PinSide = pinStartFor(bootDirection)

/** Pin a trailing action column here: the reading end, `'right'` in LTR and `'left'` under RTL. */
export const pinEnd: PinSide = pinEndFor(bootDirection)

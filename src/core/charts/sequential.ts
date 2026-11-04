/**
 * The heatmap's single-hue sequential scale (spec 766 §F, ticket 769). Pure: no React, no DOM.
 *
 * One hue — `--chart-1` — mixed over the card: the smallest value is the faintest tint
 * ({@link SEQUENTIAL_FLOOR} of the hue), the largest is the hue itself, and every value between sits in
 * proportion. Mixing over `--card` rather than writing a ramp keeps it a token reference, so it
 * follows light and dark live; under dark the faint end is near the dark card, which is the same
 * reading: little = close to the background.
 *
 * The floor keeps the smallest value visibly painted, distinct from an empty cell (no fill at all).
 */

/** The hue the heatmap ramps over. */
export const SEQUENTIAL_HUE = 'var(--chart-1)'

/** The share of the hue at the minimum, in percent. */
export const SEQUENTIAL_FLOOR = 12

/** A value's share of the hue in percent, rounded, from the floor at `min` to 100 at `max`. */
export function sequentialWeight(value: number, min: number, max: number): number {
  const t = max > min ? (value - min) / (max - min) : 1
  const clamped = Math.min(1, Math.max(0, t))
  return Math.round(SEQUENTIAL_FLOOR + (100 - SEQUENTIAL_FLOOR) * clamped)
}

/** The CSS paint of a weight. */
export const sequentialFill = (weight: number): string => `color-mix(in oklab, ${SEQUENTIAL_HUE} ${weight}%, var(--card))`

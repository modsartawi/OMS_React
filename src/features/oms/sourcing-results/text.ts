/**
 * The results page's figure texts. Plain strings (safe in a grid or a title once isolated by the caller): a share
 * with one decimal and its sign, minutes as a whole number.
 */
import { formatFigure } from '@/core/util/number-format'

/** `68.8%` — the share as sent, always with its one decimal. */
export const percentText = (percent: number): string => (Number.isFinite(percent) ? `${percent.toFixed(1)}%` : '')

/** A whole count, grouped (`39,870`). */
export const countText = (count: number): string => formatFigure(count)

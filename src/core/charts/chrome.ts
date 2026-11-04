import { CHART_INK } from './slots'

/**
 * The chart chrome every form shares (ticket 768): ink ticks, and the tooltip box in card and ink tokens
 * (766 §F — never a series colour). Token references, so light and dark follow the cascade.
 */
export const CHART_TICK = { fill: CHART_INK.tick, fontSize: 11 } as const

export const CHART_TOOLTIP_STYLE = {
  contentStyle: {
    background: CHART_INK.card,
    border: `1px solid ${CHART_INK.axis}`,
    borderRadius: 8,
    color: CHART_INK.legend,
    fontSize: 12,
  },
  labelStyle: { color: CHART_INK.legend, fontWeight: 600 },
  itemStyle: { color: CHART_INK.legend },
} as const

export const CHART_LEGEND_STYLE = { color: CHART_INK.legend, fontSize: 12 } as const

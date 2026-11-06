/**
 * The headline strip's six figures (ticket 812, spec 811). Pure, pinned by `headline.test.ts`.
 *
 * Came in, Handed over (with the till's Delivered | Picked up split under it), In slot, Out of slot
 * (each a share of Delivered with "n of N delivered" under it), Delivered per trip and Avg delivery
 * time — each with its change against the compared window.
 *
 * 🚩 **Everything is the server's, read as sent.** No share, ratio, average or change is computed
 * here: the change is the previous block's `change` and `changePct`, and only its DIRECTION is read,
 * from the sign of `change`. A figure the server leaves out is no value (the tile's dash), never 0; a
 * tile whose previous figure has no `change` draws no change line.
 */
import type { KpiTileDelta } from '@/core/charts/KpiTile'
import type { DeliveryStatistics, PreviousFigure, StatisticsPrevious } from '@/core/models/delivery-statistics'
import { formatRange } from '@/core/util/bidi'
import { hasFigure, readFigure } from './figures'

export type HeadlineId = 'cameIn' | 'handedOver' | 'inSlot' | 'outOfSlot' | 'deliveredPerTrip' | 'avgDeliveryMinutes'

/** How a tile's figure is written: a count, a share (0–1), a ratio, or minutes. */
export type HeadlineKind = 'count' | 'share' | 'ratio' | 'minutes'

/** The line under a tile's figure, its values read or dashed. */
export type HeadlineSub =
  | { kind: 'split'; delivered: string; pickedUp: string }
  | { kind: 'ofDelivered'; n: string; total: string }

export interface HeadlineTile {
  id: HeadlineId
  kind: HeadlineKind
  /** The figure as sent; `null` when the server left it out. */
  value: number | null
  /** The previous period's figure as sent; `null` when absent. */
  previous: number | null
  /** The server's change; `null` = no change line. */
  delta: KpiTileDelta | null
  sub?: HeadlineSub
}

type HeadlineAnswer = Pick<DeliveryStatistics, 'flow'> & Partial<Pick<DeliveryStatistics, 'tracks' | 'avgDeliveryMinutes' | 'previous'>>

const figure = (value: unknown): number | null => (hasFigure(value) ? value : null)

/** The server's change, or `null` when it sent none: the arrow from its sign, nothing computed. */
function readDelta(previous: PreviousFigure | undefined): KpiTileDelta | null {
  const abs = figure(previous?.change)
  if (abs === null) return null
  return { abs, pct: figure(previous?.changePct), direction: abs > 0 ? 'up' : abs < 0 ? 'down' : 'flat' }
}

const tile = (id: HeadlineId, kind: HeadlineKind, value: unknown, previous: PreviousFigure | undefined, sub?: HeadlineSub): HeadlineTile => ({
  id,
  kind,
  value: figure(value),
  previous: figure(previous?.value),
  delta: readDelta(previous),
  ...(sub ? { sub } : {}),
})

/** The answer → the six headline tiles, in the strip's order. */
export function readHeadline(answer: HeadlineAnswer, dash: string): HeadlineTile[] {
  const { flow, previous: p } = answer
  const delivery = answer.tracks?.delivery
  const slot = delivery?.slot
  // N is the Delivery track's Delivered (its hand-over): the shares are out of it.
  const delivered = readFigure(delivery?.flow?.handedOver, dash)
  return [
    tile('cameIn', 'count', flow.cameIn, p?.cameIn),
    tile('handedOver', 'count', flow.handedOver, p?.handedOver, {
      kind: 'split',
      delivered: readFigure(flow.delivered, dash),
      pickedUp: readFigure(flow.pickedUp, dash),
    }),
    tile('inSlot', 'share', slot?.inSlotShare, p?.inSlotShare, { kind: 'ofDelivered', n: readFigure(slot?.inSlot, dash), total: delivered }),
    tile('outOfSlot', 'share', slot?.outOfSlotShare, p?.outOfSlotShare, { kind: 'ofDelivered', n: readFigure(slot?.outOfSlot, dash), total: delivered }),
    tile('deliveredPerTrip', 'ratio', delivery?.deliveredPerTrip, p?.deliveredPerTrip),
    tile('avgDeliveryMinutes', 'minutes', answer.avgDeliveryMinutes, p?.avgDeliveryMinutes),
  ]
}

/** The compared window the strip names: Today's day up to its cut-off, or a closed day / range as one value. */
export type ComparedWindow = { kind: 'until'; day: string; time: string } | { kind: 'range'; range: string }

export function comparedWindow(previous: Pick<StatisticsPrevious, 'from' | 'to' | 'until'> | null | undefined): ComparedWindow | null {
  if (!previous?.from) return null
  const { from, to, until } = previous
  if (until) {
    // Read as text, never through `Date`: `09:35`, or the HH:mm of a full local time.
    const time = /(\d{2}:\d{2})/.exec(until)?.[1] ?? until
    return { kind: 'until', day: from, time }
  }
  return { kind: 'range', range: !to || from === to ? from : formatRange(from, to) }
}

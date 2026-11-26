import Ltr from '@/core/ui/Ltr'
import { formatPair, fsi } from '@/core/util/bidi'
import { formatFigure } from '@/core/util/number-format'
import { usePlanWords } from './use-plan-words'
import type { HappenedAgainst, WhatHappenedCard as Card } from './what-happened-model'

/** A local wall-clock time as sent, to the minute: `yyyy-MM-dd HH:mm`. */
export const toMinute = (at: string) => at.slice(0, 16)

/** The card's words: a duration and the one sentence against the Recommended plan. */
export function useHappenedWords() {
  const w = usePlanWords()
  const { t } = w
  const duration = (minutes: number) => {
    const h = Math.floor(minutes / 60)
    const m = minutes % 60
    return h > 0 ? t('whatHappened.duration.hm', { h: fsi(h), m: fsi(m) }) : t('whatHappened.duration.m', { m: fsi(m) })
  }
  const sentence = (a: HappenedAgainst) =>
    a.kind === 'notDelivered'
      ? t('whatHappened.against.notDelivered', { plan: duration(a.planMinutes), planFee: w.money(a.planFee), fee: w.money(a.fee) })
      : t(`whatHappened.against.${a.kind}`, {
          plan: duration(a.planMinutes),
          apart: duration(a.apartMinutes),
          happened: duration(a.happenedMinutes),
          planFee: w.money(a.planFee),
          fee: w.money(a.fee),
        })
  return { ...w, duration, sentence }
}

/**
 * "What happened" as a dashed card beside the plans (ticket 964, SIMT decision 7): the store and mode routing chose for
 * each delivery, when the order was delivered, late or not, the deliveries, the fee paid, and one sentence against the
 * Recommended plan.
 */
export default function WhatHappenedCard({ card }: { card: Card }) {
  const w = useHappenedWords()
  const { t } = w
  return (
    <article className="flex flex-col gap-3 rounded-lg border-2 border-dashed border-border bg-card p-4" data-what-happened="">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-semibold">{t('whatHappened.title')}</h3>
        <span className="rounded-full border border-border px-1.5 py-px text-[11px] text-muted-foreground">{t('whatHappened.routing')}</span>
        {card.late && (
          <span className="rounded-full border border-attention-border bg-attention-050 px-1.5 py-px text-[11px] text-attention-800" data-what-happened-late="">
            {t('whatHappened.late')}
          </span>
        )}
      </div>
      <ul className="flex flex-col gap-1 text-xs">
        {card.deliveries.map((d) => (
          <li key={d.delivery} className="flex flex-col" data-what-happened-delivery={d.delivery}>
            <span>{t('whatHappened.chose', { store: fsi(formatPair(d.store, d.storeName)), mode: w.mode(d.mode) })}</span>
            {d.late && d.minutesLate !== null && (
              <span className="text-muted-foreground">{t('whatHappened.lateBy', { minutes: fsi(d.minutesLate) })}</span>
            )}
          </li>
        ))}
      </ul>
      <dl className="grid grid-cols-3 gap-x-3 gap-y-1 text-xs">
        <div className="flex flex-col" data-what-happened-figure="delivered">
          <dt className="text-muted-foreground">{t('whatHappened.delivered')}</dt>
          <dd className="font-medium tabular-nums">{card.deliveredAt ? <Ltr>{toMinute(card.deliveredAt)}</Ltr> : t('whatHappened.notDelivered')}</dd>
        </div>
        <div className="flex flex-col" data-what-happened-figure="deliveries">
          <dt className="text-muted-foreground">{t('whatHappened.deliveries')}</dt>
          <dd className="font-medium tabular-nums">
            <Ltr>{formatFigure(card.count)}</Ltr>
          </dd>
        </div>
        <div className="flex flex-col" data-what-happened-figure="fee">
          <dt className="text-muted-foreground">{t('whatHappened.fee')}</dt>
          <dd className="font-medium tabular-nums">
            <Ltr>{w.money(card.fee)}</Ltr>
          </dd>
        </div>
      </dl>
      {card.against && (
        <p className="text-xs text-muted-foreground" data-what-happened-against={card.against.kind}>
          {w.sentence(card.against)}
        </p>
      )}
    </article>
  )
}

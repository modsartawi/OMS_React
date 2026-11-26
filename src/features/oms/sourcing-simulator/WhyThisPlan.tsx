import type { ReactNode } from 'react'
import Ltr from '@/core/ui/Ltr'
import { fsi } from '@/core/util/bidi'
import { formatFigure } from '@/core/util/number-format'
import MoneyTable from './MoneyTable'
import PromiseParts from './PromiseParts'
import { shortFigures, type ShortFigure } from './short-figure'
import type { SimulatorTabProps } from './SimulatorTabs'
import StoreRecords from './StoreRecords'
import { usePlanWords } from './use-plan-words'
import WhyNotStore from './WhyNotStore'

/**
 * The tab "Why this plan" (ticket 965, BackOffice spec 4354 §6, §7, §19; SIMT decision 10), for the plan picked in the
 * strip, top to bottom: the promise in parts, the money, how deliveries go at each shipment's store, the lines planned
 * on a short stock figure, and "why not another store?".
 */
export default function WhyThisPlan({ reply, plan }: SimulatorTabProps) {
  const w = usePlanWords()
  const { t } = w
  if (!plan) return <p className="text-sm text-muted-foreground" data-why-no-plan="">{t('why.noPlan')}</p>
  const short = shortFigures(plan)
  return (
    <div className="flex flex-col gap-5" data-why={plan.goal}>
      <h3 className="flex flex-wrap items-center gap-1.5 text-sm font-semibold">
        {t('why.title')}
        <bdi className="font-normal text-muted-foreground">{w.said(plan.label)}</bdi>
      </h3>
      <Part title={t('why.promise.title')}>
        <PromiseParts plan={plan} />
      </Part>
      <Part title={t('why.money.title')}>
        <MoneyTable plan={plan} />
      </Part>
      <Part title={t('why.records.title')}>
        <StoreRecords plan={plan} reply={reply} />
      </Part>
      {short.length > 0 && (
        <Part title={t('why.shortFigure.title')}>
          <ul className="flex flex-col gap-2" data-why-short="">
            {short.map((s) => (
              <ShortFigureLine key={`${s.lineNo}-${s.store}`} figure={s} />
            ))}
          </ul>
        </Part>
      )}
      <Part title={t('why.whyNot.title')}>
        <WhyNotStore reply={reply} plan={plan} />
      </Part>
    </div>
  )
}

function Part({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h4 className="text-xs font-semibold text-muted-foreground">{title}</h4>
      {children}
    </section>
  )
}

/** The six figures of a short-figure mark, in 4281's order. */
const SIX = ['tillStock', 'sapStock', 'heldByOrders', 'heldByDeliveries', 'shown', 'asked'] as const

function ShortFigureLine({ figure }: { figure: ShortFigure }) {
  const w = usePlanWords()
  const { t } = w
  return (
    <li className="flex flex-col gap-1 rounded-md border border-border/70 px-3 py-2 text-xs" data-why-short-line={figure.lineNo}>
      <span data-short-figure-sentence="">{t('why.shortFigure.sentence', { line: fsi(figure.lineNo), n: fsi(figure.inHundred) })}</span>
      <dl className="flex flex-wrap gap-x-4 gap-y-0.5 text-muted-foreground">
        <div className="flex gap-1">
          <dt>{t('why.shortFigure.store')}</dt>
          <dd className="font-mono">
            <Ltr>{figure.store}</Ltr>
          </dd>
        </div>
        <div className="flex gap-1">
          <dt>{t('why.shortFigure.stockClass')}</dt>
          <dd>{t(`why.stockClass.${figure.stockClass}`, { defaultValue: figure.stockClass })}</dd>
        </div>
        {SIX.map((k) => (
          <div key={k} className="flex gap-1">
            <dt>{t(`why.shortFigure.figure.${k}`)}</dt>
            <dd className="tabular-nums">
              <Ltr>{formatFigure(figure.figures[k])}</Ltr>
            </dd>
          </div>
        ))}
        <div className="flex gap-1">
          <dt>{t('why.shortFigure.row')}</dt>
          <dd className="tabular-nums">
            <Ltr>{figure.row.toFixed(2)}</Ltr>
          </dd>
        </div>
        <div className="flex gap-1">
          <dt>{t('why.shortFigure.factor')}</dt>
          <dd className="tabular-nums">
            <Ltr>{figure.factor.toFixed(2)}</Ltr>
          </dd>
        </div>
        <div className="flex gap-1">
          <dt>{t('why.shortFigure.cost')}</dt>
          <dd className="tabular-nums">
            <Ltr>{w.money(figure.cost)}</Ltr>
          </dd>
        </div>
      </dl>
    </li>
  )
}

import type { AdvisePlan, AdviseShipment } from '@/core/models/sourcing-run'
import Ltr from '@/core/ui/Ltr'
import { formatPair, fsi } from '@/core/util/bidi'
import { formatFigure } from '@/core/util/number-format'
import { planColumn } from './plans-table-model'
import { shortFigures } from './short-figure'
import PlanHead from './PlanHead'
import { PinsCostLine, ShipmentPins, type PlanPinning } from './PlanPins'
import { usePlanWords } from './use-plan-words'
import WhatHappenedCard from './WhatHappenedCard'
import type { WhatHappenedCard as Happened } from './what-happened-model'

/**
 * The plans as cards (ticket 962, SIMT decision 1): per plan its label and tags, the server's promise sentence in both
 * languages, the customer's fee per shipment and in total, the company's cost, the price of waiting and the balanced
 * total, then its shipments and the lines not on it. With `pinning` (ticket 963) each shipment carries its pin
 * buttons and each plan what the pins cost it.
 */
export default function PlanCards({ plans, pinning, happened = null }: { plans: readonly AdvisePlan[]; pinning?: PlanPinning; happened?: Happened | null }) {
  return (
    <div className="grid gap-3 xl:grid-cols-2" data-plan-cards="">
      {plans.map((p) => (
        <PlanCard key={p.goal} plan={p} pinning={pinning} />
      ))}
      {/* 964: on a replay, "What happened" beside the plans, as a dashed card. */}
      {happened && <WhatHappenedCard card={happened} />}
    </div>
  )
}

function PlanCard({ plan, pinning }: { plan: AdvisePlan; pinning?: PlanPinning }) {
  const w = usePlanWords()
  const { t } = w
  const figures: { key: string; label: string; value: string }[] = [
    { key: 'deliveries', label: t('measure.deliveries'), value: formatFigure(plan.totals.shipments) },
    { key: 'fee', label: t('measure.fee'), value: w.money(plan.totals.fee) },
    { key: 'companyCost', label: t('measure.companyCost'), value: w.money(plan.totals.companyCost) },
    { key: 'waiting', label: t('measure.waiting'), value: w.money(plan.sum?.waiting) },
    { key: 'balanced', label: t('measure.balanced'), value: w.money(plan.sum?.total) },
  ]
  return (
    <article className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4" data-plan-card={plan.goal}>
      <PlanHead column={planColumn(plan)} />
      <div className="flex flex-col text-sm" data-plan-promise="">
        <bdi className="font-medium">{w.said(plan.promise)}</bdi>
        <bdi className="text-xs text-muted-foreground" lang={w.ar ? 'en' : 'ar'}>
          {w.other(plan.promise)}
        </bdi>
      </div>
      <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs sm:grid-cols-3">
        {figures.map((f) => (
          <div key={f.key} className="flex flex-col" data-plan-figure={f.key}>
            <dt className="text-muted-foreground">{f.label}</dt>
            <dd className="font-medium tabular-nums">
              <Ltr>{f.value}</Ltr>
            </dd>
          </div>
        ))}
      </dl>
      {pinning && <PinsCostLine cost={pinning.cost[plan.goal]} />}
      <div className="flex flex-col gap-2">
        <h4 className="text-xs font-semibold text-muted-foreground">{t('card.shipments')}</h4>
        <ol className="flex flex-col gap-2">
          {plan.shipments.map((s) => (
            <Shipment key={s.no} s={s} pinning={pinning} />
          ))}
        </ol>
      </div>
      {shortFigures(plan).length > 0 && (
        <ul className="flex flex-col gap-1 text-xs text-muted-foreground" data-plan-line-marks="">
          {shortFigures(plan).map((m) => (
            <li key={`${m.lineNo}-${m.store}`} data-short-figure-sentence="">
              {t('why.shortFigure.sentence', { line: fsi(m.lineNo), n: fsi(m.inHundred) })}
            </li>
          ))}
        </ul>
      )}
      {plan.missingLines.length > 0 && (
        <div className="flex flex-col gap-1 text-xs" data-plan-missing="">
          <h4 className="font-semibold text-muted-foreground">{t('card.notOnPlan')}</h4>
          <ul className="flex flex-col gap-0.5">
            {plan.missingLines.map((m) => (
              <li key={m.lineNo} data-plan-missing-line={m.lineNo}>
                <bdi>{w.said(m)}</bdi>
              </li>
            ))}
          </ul>
        </div>
      )}
    </article>
  )
}

function Shipment({ s, pinning }: { s: AdviseShipment; pinning?: PlanPinning }) {
  const w = usePlanWords()
  const { t } = w
  return (
    <li className="flex flex-col gap-0.5 rounded-md border border-border/70 px-2.5 py-2 text-xs" data-plan-shipment={s.no}>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
        <span className="font-semibold">
          <Ltr>{s.no}</Ltr>
        </span>
        <span className="rounded-full border border-border px-1.5 py-px text-[11px]" data-plan-mode={s.mode}>
          {w.mode(s.mode)}
        </span>
        <span className="font-mono">
          <Ltr>{formatPair(s.store, s.storeName)}</Ltr>
        </span>
        <span className="text-muted-foreground" data-plan-km="">{s.km === undefined ? t('card.noLocation') : <Ltr>{w.km(s.km)}</Ltr>}</span>
        {s.kmKind === 'STRAIGHT_LINE' && (
          <span className="rounded-full border border-dashed border-border px-1.5 text-[11px] text-muted-foreground" data-plan-straight-line="">
            {t('card.straightLine')}
          </span>
        )}
      </div>
      <bdi>{w.said(s.promise)}</bdi>
      <dl className="flex flex-wrap gap-x-3">
        <div className="flex gap-1" data-shipment-fee="">
          <dt className="text-muted-foreground">{t('measure.fee')}</dt>
          <dd className="tabular-nums">
            <Ltr>{w.money(s.fee)}</Ltr>
          </dd>
        </div>
        <div className="flex gap-1">
          <dt className="text-muted-foreground">{t('measure.companyCost')}</dt>
          <dd className="tabular-nums">
            <Ltr>{w.money(s.companyCost)}</Ltr>
          </dd>
        </div>
        <div className="flex gap-1">
          <dt className="text-muted-foreground">{t('card.lines')}</dt>
          <dd>
            <Ltr>{s.lines.join(', ')}</Ltr>
          </dd>
        </div>
      </dl>
      {pinning && <ShipmentPins s={s} pinning={pinning} />}
    </li>
  )
}

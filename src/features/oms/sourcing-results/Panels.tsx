import type { ReactNode } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import type { ResultsCost, ResultsMarkInForce, ResultsPromiseRow } from '@/core/models/sourcing-results'
import Ltr from '@/core/ui/Ltr'
import { fsi } from '@/core/util/bidi'
import Drill from './Drill'
import Fig from './Fig'
import { modeInk } from './inks'
import { promisePanel, type PromisePanelRow, type PromiseState } from './promise-panel-model'
import { countText, percentText } from './text'

/**
 * The row of three panels under the bar (ticket 971, results ticket decisions 4, 8 and 9): the promise check, cost,
 * the marks in force. No riyal anywhere: the cost panel holds a notice and counts (spec 4354 §17). No green and no red.
 */
export default function Panels({ promise, cost, marks }: { promise: ResultsPromiseRow[]; cost: ResultsCost; marks: ResultsMarkInForce[] }) {
  const { t } = useTranslation('sourcing-results')
  return (
    <div className="grid items-start gap-4 lg:grid-cols-3">
      <Panel title={t('promise.title')} data="promise">
        <PromiseCheck rows={promise} />
      </Panel>
      <Panel title={t('cost.title')} data="cost">
        <CostPanel cost={cost} />
      </Panel>
      <Panel title={t('marks.title')} data="marks">
        <MarksPanel marks={marks} />
      </Panel>
    </div>
  )
}

function Panel({ title, data, children }: { title: string; data: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4" data-results-panel={data}>
      <h2 className="text-sm font-semibold">{title}</h2>
      {children}
    </section>
  )
}

export const PILL = 'inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap'
export const STATE_PILL: Record<PromiseState, string> = {
  inside: `${PILL} border-primary/30 bg-primary-050 text-primary-800`,
  under: `${PILL} border-attention-border bg-attention-050 text-attention-800`,
  over: `${PILL} border-attention-border bg-attention-050 text-attention-800`,
  target: `${PILL} border-border bg-muted text-muted-foreground`,
}

export function PromiseCheck({ rows }: { rows: ResultsPromiseRow[] }) {
  const { t } = useTranslation('sourcing-results')
  const panel = promisePanel(rows)
  const name = (r: PromisePanelRow) => (r.channelGroup ? t(`promise.pickUpGroups.${r.channelGroup}`) : t(`modes.${r.mode}`))
  return (
    <div className="flex flex-col gap-3">
      {panel.map((r) => (
        <div key={r.key} className="flex flex-col gap-1" data-promise-row={r.key} data-promise-state={r.state}>
          <div className="flex items-center justify-between gap-2 text-sm">
            <span className="inline-flex items-center gap-1.5">
              <i className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: modeInk(r.mode) }} aria-hidden />
              {name(r)}
            </span>
            <span className="inline-flex items-center gap-2">
              <b>
                <Ltr>{percentText(r.percent)}</Ltr>
              </b>
              <span className={STATE_PILL[r.state]} data-promise-pill="">
                {t(`promise.states.${r.state}`)}
              </span>
            </span>
          </div>
          <Gauge row={r} />
          <div className="text-xs text-muted-foreground">
            {r.mode === 'PICK_UP' ? t('promise.what.PICK_UP', { minutes: fsi(r.targetMinutes ?? '') }) : t(`promise.what.${r.mode}`)}
            {' · '}
            <Drill figure={{ kind: 'promise', mode: r.mode, channelGroup: r.channelGroup }} count={r.count} />{' '}
            {r.mode === 'PICK_UP' ? t('promise.countPickUp') : t('promise.countDelivery')}
          </div>
        </div>
      ))}
      <p className="text-xs text-muted-foreground">{t('promise.scale')}</p>
    </div>
  )
}

export function Gauge({ row }: { row: PromisePanelRow }) {
  const { t } = useTranslation('sourcing-results')
  const label = row.gauge.band
    ? t('promise.gaugeBand', { percent: fsi(percentText(row.percent)) })
    : t('promise.gaugeTarget', { percent: fsi(percentText(row.percent)) })
  return (
    <div className="relative h-2.5 rounded-full bg-muted" role="img" aria-label={label} data-gauge="">
      {row.gauge.band && (
        <span
          className="absolute inset-y-0 rounded-full"
          style={{ insetInlineStart: `${row.gauge.band.start}%`, width: `${row.gauge.band.width}%`, backgroundColor: 'var(--results-band)' }}
          data-gauge-band=""
        />
      )}
      <span
        className="absolute -top-0.5 h-3.5 w-1 -translate-x-1/2 rounded-full bg-foreground rtl:translate-x-1/2"
        style={{ insetInlineStart: `${row.gauge.marker}%` }}
        data-gauge-marker=""
      />
    </div>
  )
}

function CostPanel({ cost }: { cost: ResultsCost }) {
  const { t } = useTranslation('sourcing-results')
  const real = cost.rates.filter((r) => !r.assumed)
  const assumed = cost.rates.filter((r) => r.assumed)
  return (
    <div className="flex flex-col gap-3 text-sm">
      {cost.ratesAssumed > 0 && (
        <p className="rounded-md border border-attention-border bg-attention-050 px-3 py-2 text-xs text-attention-800" data-cost-notice="">
          <Trans
            t={t}
            i18nKey="cost.notice"
            components={{ b: <b />, assumed: <Fig value={countText(cost.ratesAssumed)} />, total: <Fig value={countText(cost.ratesTotal)} /> }}
          />
        </p>
      )}
      <ul className="flex flex-col gap-2 text-xs">
        <li data-cost-shipments="">
          <Trans
            t={t}
            i18nKey="cost.shipments"
            components={{ b: <b />, plan: <Fig value={countText(cost.planShipments)} />, real: <Fig value={countText(cost.realDeliveries)} /> }}
          />
        </li>
        <li data-cost-fee="">
          <Trans
            t={t}
            i18nKey="cost.listFee"
            components={{
              b: <b />,
              lower: <Fig value={percentText(cost.listFee.lowerPercent)} />,
              same: <Fig value={percentText(cost.listFee.samePercent)} />,
              higher: <Fig value={percentText(cost.listFee.higherPercent)} />,
            }}
          />
          {!cost.feeRulesConfirmed && (
            <>
              {' '}
              <span className={`${PILL} border-attention-border bg-attention-050 text-attention-800`}>{t('cost.feeRulesNotConfirmed')}</span>
            </>
          )}
        </li>
        <li data-cost-rates="">
          <b>{t('cost.rates')}</b>{' '}
          {real.map((r) => (
            <span key={r.rate} className="me-2 inline-flex items-center gap-1">
              {t(`cost.rate.${r.rate}`)}
              <span className={`${PILL} border-primary/30 bg-primary-050 text-primary-800`}>
                {r.quotes != null
                  ? t('cost.realQuotes', { source: t(`cost.sources.${r.source ?? 'UNKNOWN'}`, { defaultValue: fsi(r.source ?? '') }), quotes: fsi(countText(r.quotes)) })
                  : t('cost.real', { source: t(`cost.sources.${r.source ?? 'UNKNOWN'}`, { defaultValue: fsi(r.source ?? '') }) })}
              </span>
            </span>
          ))}
          {assumed.length > 0 && (
            <span className="inline-flex flex-wrap items-center gap-1">
              {assumed.map((r) => t(`cost.rate.${r.rate}`)).join(t('cost.listJoin'))}
              <span className={`${PILL} border-attention-border bg-attention-050 text-attention-800`}>{t('cost.assumed')}</span>
            </span>
          )}
        </li>
      </ul>
    </div>
  )
}

function MarksPanel({ marks }: { marks: ResultsMarkInForce[] }) {
  const { t } = useTranslation('sourcing-results')
  return (
    <ul className="flex flex-col gap-3">
      {marks.map((m) => {
        const none = m.orders === 0
        return (
          <li key={m.mark} className={none ? 'opacity-60' : ''} data-mark={m.mark} data-mark-none={none ? '' : undefined}>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className={none ? `${PILL} border-border bg-muted text-muted-foreground` : `${PILL} border-attention-border bg-attention-050 text-attention-800`}>
                {t(`marks.names.${m.mark}`)}
              </span>
              {m.orders != null && m.orders > 0 && (
                <span className="text-xs">
                  <Trans t={t} i18nKey="marks.comparisons" components={{ n: <Drill figure={{ kind: 'mark', mark: m.mark }} count={m.orders} /> }} />
                </span>
              )}
              {none && <span className="text-xs text-muted-foreground">{t('marks.none')}</span>}
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">{t(`marks.says.${m.mark}`)}</p>
          </li>
        )
      })}
    </ul>
  )
}

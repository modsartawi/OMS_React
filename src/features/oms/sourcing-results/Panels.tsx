import type { ReactNode } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import type { ResultsCostPanel, ResultsMarkCount, ResultsPanelsReply, ResultsPromiseCheckRow } from '@/core/models/sourcing-results'
import Ltr from '@/core/ui/Ltr'
import { fsi } from '@/core/util/bidi'
import { Word } from './codes'
import Drill from './Drill'
import Fig from './Fig'
import { modeInk } from './inks'
import { promisePanel, type PromisePanelRow, type PromiseState } from './promise-panel-model'
import { countText, percentText } from './text'

/**
 * The row of three panels under the bar (ticket 971, results ticket decisions 4, 8 and 9; BO 4393 `Results/Panels`):
 * the promise check, cost, the marks in force. No riyal anywhere: the cost panel holds a notice and counts (spec 4354
 * §17). No green and no red.
 */
export default function Panels({ panels }: { panels: ResultsPanelsReply }) {
  const { t } = useTranslation('sourcing-results')
  return (
    <div className="grid items-start gap-4 lg:grid-cols-3">
      <Panel title={t('promise.title')} data="promise">
        <PromiseCheck rows={panels.promiseCheck} />
      </Panel>
      <Panel title={t('cost.title')} data="cost">
        <CostPanel cost={panels.cost} />
      </Panel>
      <Panel title={t('marks.title')} data="marks">
        <MarksPanel marks={panels.marks} />
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
  none: `${PILL} border-dashed border-border bg-muted text-muted-foreground`,
}

/**
 * The promise check rows. Their counts are plain: SERVER GAP (spec 4354) — the orders door has no figure for a promise
 * check row (BO 4393 `ResultsFigure`), so a promise count opens nothing.
 */
export function PromiseCheck({ rows }: { rows: ResultsPromiseCheckRow[] }) {
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
              <b>{r.state === 'none' ? t('dash') : <Ltr>{percentText(r.percent)}</Ltr>}</b>
              <span className={STATE_PILL[r.state]} data-promise-pill="">
                {t(`promise.states.${r.state}`)}
              </span>
            </span>
          </div>
          <Gauge row={r} />
          <div className="text-xs text-muted-foreground">
            <Trans
              t={t}
              i18nKey={r.mode === 'PICK_UP' ? 'promise.withinPickUp' : 'promise.withinDelivery'}
              components={{ within: <Fig value={countText(r.within)} />, checked: <Fig value={countText(r.count)} /> }}
            />
            {r.expressStampPercent != null && (
              <>
                {' · '}
                <Trans t={t} i18nKey="promise.expressStamp" components={{ p: <Fig value={percentText(r.expressStampPercent)} /> }} />
              </>
            )}
          </div>
        </div>
      ))}
      <p className="text-xs text-muted-foreground">{t('promise.scale')}</p>
    </div>
  )
}

export function Gauge({ row }: { row: PromisePanelRow }) {
  const { t } = useTranslation('sourcing-results')
  const label =
    row.gauge.marker == null
      ? t('promise.states.none')
      : row.gauge.band
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
      {row.gauge.marker != null && (
        <span
          className="absolute -top-0.5 h-3.5 w-1 -translate-x-1/2 rounded-full bg-foreground rtl:translate-x-1/2"
          style={{ insetInlineStart: `${row.gauge.marker}%` }}
          data-gauge-marker=""
        />
      )}
    </div>
  )
}

function CostPanel({ cost }: { cost: ResultsCostPanel }) {
  const { t } = useTranslation('sourcing-results')
  const real = cost.rates.filter((r) => !r.assumed)
  const assumed = cost.rates.filter((r) => r.assumed)
  const rateName = (r: ResultsCostPanel['rates'][number]) => (
    <>
      <Word family="MONEY_ROW" code={r.part} />
      {r.mode && (
        <>
          {' '}
          (<Word k={`modes.${r.mode}`} family="MODE" code={r.mode} />
          {r.channel && (
            <>
              {', '}
              <Ltr>{r.channel}</Ltr>
            </>
          )}
          )
        </>
      )}
    </>
  )
  return (
    <div className="flex flex-col gap-3 text-sm">
      {cost.setName && (
        <p className="text-xs text-muted-foreground" data-cost-set="">
          {t('cost.set', { set: t('filters.set', { name: fsi(cost.setName), version: fsi(cost.setVersion ?? '') }) })}
        </p>
      )}
      {cost.noRiyalTotal && (
        <p className="rounded-md border border-attention-border bg-attention-050 px-3 py-2 text-xs text-attention-800" data-cost-notice="">
          <Trans
            t={t}
            i18nKey={cost.ratesTotal > 0 ? 'cost.notice' : 'cost.noticeNoRates'}
            components={{ b: <b />, assumed: <Fig value={countText(cost.ratesAssumed)} />, total: <Fig value={countText(cost.ratesTotal)} /> }}
          />
        </p>
      )}
      <ul className="flex flex-col gap-2 text-xs">
        <li data-cost-assumed-orders="">
          <Trans
            t={t}
            i18nKey="cost.ordersOnAssumed"
            components={{ b: <b />, n: <Fig value={countText(cost.ordersOnAssumedRates)} /> }}
          />
        </li>
        <li data-cost-shipments="">
          <Trans
            t={t}
            i18nKey="cost.shipments"
            components={{
              b: <b />,
              orders: <Fig value={countText(cost.ordersWithPlans)} />,
              plan: <Fig value={countText(cost.planShipments)} />,
              real: <Fig value={countText(cost.realDeliveries)} />,
            }}
          />
        </li>
        <li data-cost-fee="">
          <Trans
            t={t}
            i18nKey="cost.listFee"
            components={{
              b: <b />,
              compared: <Fig value={countText(cost.feeCompared)} />,
              lower: <Fig value={countText(cost.feeLower)} />,
              same: <Fig value={countText(cost.feeSame)} />,
              higher: <Fig value={countText(cost.feeHigher)} />,
            }}
          />
          {cost.feeRulesNotConfirmed && (
            <>
              {' '}
              <span className={`${PILL} border-attention-border bg-attention-050 text-attention-800`}>{t('cost.feeRulesNotConfirmed')}</span>
            </>
          )}
        </li>
        <li data-cost-rates="">
          <b>{t('cost.rates')}</b>{' '}
          {real.map((r, i) => (
            <span key={`real-${i}`} className="me-2 inline-flex items-center gap-1">
              {rateName(r)}
              <span className={`${PILL} border-primary/30 bg-primary-050 text-primary-800`}>
                <Word family="SOURCE" code={r.source} />
              </span>
            </span>
          ))}
          {assumed.length > 0 && (
            <span className="inline-flex flex-wrap items-center gap-1">
              {assumed.map((r, i) => (
                <span key={`assumed-${i}`} className="me-1">
                  {rateName(r)}
                </span>
              ))}
              <span className={`${PILL} border-attention-border bg-attention-050 text-attention-800`}>{t('cost.assumed')}</span>
            </span>
          )}
        </li>
      </ul>
    </div>
  )
}

function MarksPanel({ marks }: { marks: ResultsMarkCount[] }) {
  const { t } = useTranslation('sourcing-results')
  return (
    <ul className="flex flex-col gap-3">
      {marks.map((m) => {
        const none = m.orders === 0
        return (
          <li key={m.code} className={none ? 'opacity-60' : ''} data-mark={m.code} data-mark-none={none ? '' : undefined}>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className={none ? `${PILL} border-border bg-muted text-muted-foreground` : `${PILL} border-attention-border bg-attention-050 text-attention-800`}>
                <Word k={`marks.names.${m.code}`} family="COMPARISON_MARK" code={m.code} />
              </span>
              {m.orders > 0 ? (
                <span className="text-xs">
                  <Trans t={t} i18nKey="marks.comparisons" components={{ n: <Drill figure={{ kind: 'mark', mark: m.code }} count={m.orders} /> }} />
                </span>
              ) : (
                <span className="text-xs text-muted-foreground">{t('marks.none')}</span>
              )}
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">{t(`marks.says.${m.code}`, { defaultValue: '' })}</p>
          </li>
        )
      })}
    </ul>
  )
}

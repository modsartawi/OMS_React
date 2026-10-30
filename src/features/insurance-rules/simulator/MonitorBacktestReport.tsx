import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'

import { RuleId } from '@/core/insurance-rules/badges'
import { monitorBacktestReading, type MonitorBacktest } from '@/core/insurance-rules/backtest'
import { guardRulePath } from '@/core/insurance-rules/model'
import { NUM, TD, TH } from '@/core/insurance-rules/parts'
import { guardSeverityTone } from '@/core/insurance-rules/tones'
import Ltr from '@/core/ui/Ltr'
import { formatPair, fsi } from '@/core/util/bidi'
import { formatDay } from '@/core/util/date-format'
import { formatNumber } from '@/core/util/number-format'
import { Tile } from './parts'

/**
 * A monitor's share of a back-test (oms 700, door 3290): over the kept answers replayed, how many review items it would
 * have raised and on which answers. It speaks of no sale, no refusal and no SAR. Patient keys stay masked.
 */
export default function MonitorBacktestReport({ monitors }: { monitors: MonitorBacktest }) {
  const { t } = useTranslation(['insurance-simulator', 'insurance-rules'])
  const r = monitorBacktestReading(monitors)
  return (
    <section className="flex flex-col gap-4" data-monitor-backtest="">
      <div>
        <h2 className="text-base font-semibold tracking-tight">{t('monitors.title')}</h2>
        <p className="text-xs text-muted-foreground">{t('monitors.hint')}</p>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Tile label={t('monitors.answers')} hook="monitor-answers">
          <Ltr>{formatNumber(r.answers)}</Ltr>
        </Tile>
        <Tile label={t('monitors.raisedOn')} hook="monitor-raised-on">
          <Ltr>{formatNumber(r.raisedOn)}</Ltr>
        </Tile>
        <Tile label={t('monitors.raised')} hook="monitor-raised">
          <Ltr>{formatNumber(r.total)}</Ltr>
        </Tile>
        {r.rows.map(([sev, n]) => (
          <Tile key={sev} label={t(`insurance-rules:severity.${sev}`)} hook={`monitor-${sev}`} tone={guardSeverityTone(sev).text}>
            <Ltr>{formatNumber(n)}</Ltr>
          </Tile>
        ))}
      </div>

      {r.rules.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-border/60 bg-card">
          <table className="w-full text-sm" data-monitor-by-rule="">
            <thead>
              <tr>
                <th className={TH}>{t('byRule.rule')}</th>
                <th className={`${TH} text-end`}>{t('monitors.raised')}</th>
              </tr>
            </thead>
            <tbody>
              {r.rules.map((row) => (
                <tr key={row.ruleId} className="border-t border-border/60" data-monitor-rule-row={row.ruleId}>
                  <td className={TD}>
                    <Link to={guardRulePath(row.ruleId)} className="text-primary hover:underline">
                      <RuleId id={row.ruleId} />
                    </Link>
                  </td>
                  <td className={NUM} data-col="raised">
                    <Ltr>{formatNumber(row.raised)}</Ltr>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex flex-col gap-1">
        <h3 className="text-sm font-semibold">{t('monitors.itemsTitle')}</h3>
        <p className="text-xs text-muted-foreground">
          {t('stopped.masked')}{' '}
          {r.truncated && <span data-monitor-truncated={r.itemsTotal}>{t('monitors.firstOf', { shown: fsi(formatNumber(r.shown)), total: fsi(formatNumber(r.itemsTotal)) })}</span>}
        </p>
        {r.items.length === 0 ? (
          <p className="rounded-md border border-dashed border-border/60 p-4 text-sm text-muted-foreground" data-monitor-none="">
            {t('monitors.none')}
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border/60 bg-card">
            <table className="w-full text-sm" data-monitor-items="">
              <thead>
                <tr>
                  <th className={TH}>{t('stopped.on')}</th>
                  <th className={TH}>{t('monitors.answer')}</th>
                  <th className={TH}>{t('stopped.patient')}</th>
                  <th className={TH}>{t('stopped.rules')}</th>
                </tr>
              </thead>
              <tbody>
                {r.items.map((item, i) => (
                  <tr key={i} className="border-t border-border/60" data-monitor-item={i}>
                    <td className={TD} data-col="on">
                      <Ltr>{formatDay(item.on)}</Ltr>
                    </td>
                    <td className={`${TD} font-mono`} data-col="answer">
                      <Ltr>{formatPair(item.message?.source, item.message?.id)}</Ltr>
                    </td>
                    <td className={`${TD} font-mono`} data-col="patient">
                      <Ltr>{item.maskedKey}</Ltr>
                    </td>
                    <td className={TD} data-col="rules">
                      <span className="flex flex-wrap gap-1">
                        {(item.rules ?? []).map((id) => (
                          <RuleId key={id} id={id} />
                        ))}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  )
}

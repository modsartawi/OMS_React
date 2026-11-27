import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Trans, useTranslation } from 'react-i18next'
import ShareBar from '@/core/charts/ShareBar'
import type { ResultsOutsideReply } from '@/core/models/sourcing-results'
import { fsi } from '@/core/util/bidi'
import { sourcingResultsApi } from './api'
import { useWordString, Word } from './codes'
import Drill from './Drill'
import Fig from './Fig'
import { outsideWords } from './OrdersDrawer'
import type { ResultsTabProps } from './ResultsTabs'
import TabRead, { Pct, TD_NUM, TD_WRAP, TH_NUM, TH_WRAP } from './TabRead'
import { countText, percentText } from './text'

/**
 * Outside the advisor's rules (ticket 972, results ticket decision 11 and its amendments; BO 4393 `Results/Outside`): a
 * line saying these orders are a group of their own, then one row per reason — the refused pin's code and the filter
 * step that removed the pair — with its orders, a bar of its share of the orders compared, and one sentence on what it
 * says. The bar is one colour of its own, ranking nothing.
 */
export default function OutsideRulesTab({ query }: ResultsTabProps) {
  const read = useQuery({
    queryKey: ['sourcing-results', 'outside', query],
    queryFn: () => sourcingResultsApi.outside(query),
    placeholderData: keepPreviousData,
    retry: false,
  })
  return (
    <div className="flex flex-col gap-3" data-reading-tab="outside-rules">
      <TabRead read={read}>{(reply) => <OutsideRules reply={reply} />}</TabRead>
    </div>
  )
}

function OutsideRules({ reply }: { reply: ResultsOutsideReply }) {
  const { t, i18n } = useTranslation('sourcing-results')
  const word = useWordString()
  return (
    <div className="flex flex-col gap-3">
      <p className="max-w-[78ch] text-sm text-muted-foreground" data-outside-rules-group="">
        {t('outsideRules.group')}
      </p>
      <p className="text-sm" data-outside-rules-total="">
        <Trans
          t={t}
          i18nKey="outsideRules.total"
          components={{ outside: <Fig bold value={countText(reply.outside)} />, compared: <Fig value={countText(reply.ordersCompared)} /> }}
        />
      </p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[48rem] text-sm">
          <thead className="border-b border-border text-xs text-muted-foreground">
            <tr>
              <th className={TH_WRAP}>{t('outsideRules.cols.reason')}</th>
              <th className={TH_NUM}>{t('outsideRules.cols.orders')}</th>
              <th className={`${TH_WRAP} w-[24%]`}>{t('outsideRules.cols.share')}</th>
              <th className={TH_WRAP}>{t('outsideRules.cols.says')}</th>
            </tr>
          </thead>
          <tbody>
            {reply.reasons.map((r) => {
              const key = `${r.code}|${r.stepCode}`
              const saysKey = r.stepCode ? `outsideRules.says.${r.stepCode}` : `outsideRules.says.${r.code}`
              return (
                <tr key={key} className="border-b border-border/60" data-outside-reason={key}>
                  <td className={`${TD_WRAP} font-semibold`}>
                    <Word family="PIN" code={r.code} />
                    {r.stepCode && (
                      <div className="text-xs font-normal text-muted-foreground">
                        {t('outsideRules.step')} <Word k={`outsideRules.steps.${r.stepCode}`} family="FILTER" code={r.stepCode} />
                      </div>
                    )}
                  </td>
                  <td className={TD_NUM}>
                    <Drill figure={{ kind: 'outside', code: r.code, step: r.stepCode }} count={r.orders} />
                  </td>
                  <td className={TD_WRAP}>
                    <div className="flex items-center gap-2">
                      <div className="min-w-0 flex-1">
                        <ShareBar
                          segments={[
                            { id: key, weight: r.percent, colour: 'var(--results-rules)' },
                            { id: 'rest', weight: Math.max(0, 100 - r.percent), colour: 'var(--muted)' },
                          ]}
                          label={t('outsideRules.barLabel', { reason: outsideWords(word, r.code, r.stepCode), percent: fsi(percentText(r.percent)) })}
                        />
                      </div>
                      <span className="w-14 text-end text-xs">
                        <Pct value={r.percent} />
                      </span>
                    </div>
                  </td>
                  <td className={`${TD_WRAP} text-xs text-muted-foreground`}>
                    {i18n.exists(saysKey, { ns: 'sourcing-results' }) ? t(saysKey) : t('outsideRules.says.other')}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">{t('outsideRules.note')}</p>
    </div>
  )
}

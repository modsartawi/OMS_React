import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import ShareBar from '@/core/charts/ShareBar'
import type { ResultsOutsideRulesReply } from '@/core/models/sourcing-results'
import Ltr from '@/core/ui/Ltr'
import { fsi } from '@/core/util/bidi'
import { readingTabsApi } from './api'
import Drill from './Drill'
import type { ResultsTabProps } from './ResultsTabs'
import TabRead, { Pct, TD_NUM, TD_WRAP, TH_NUM, TH_WRAP } from './TabRead'
import { percentText } from './text'

/** The reasons the page has words for (BO 4281's filter step codes of a refused pin, and BO 4327's `BOOK_NEVER_HELD`). */
// PROVISIONAL (spec 4354: not specified) — `BOOK_NEVER_HELD`.
const KNOWN_REASONS = new Set(['NO_STOCK', 'OUT_OF_REACH', 'PRODUCT_RULE', 'NO_STOCK_ROW', 'BOOK_NEVER_HELD', 'NOT_MODE_STORE', 'MODE_OFF', 'CLOSED_NOW', 'PAST_CUTOFF', 'NO_SLOT'])

/**
 * Outside the advisor's rules (ticket 972, results ticket decision 11 and its amendments): a line saying these orders
 * are a group of their own, then one row per reason the pin was refused — orders, a bar of its share, and one sentence
 * on what it says. The bar is one colour of its own, ranking nothing.
 */
export default function OutsideRulesTab({ query }: ResultsTabProps) {
  const read = useQuery({
    queryKey: ['sourcing-results', 'outside-rules', query],
    queryFn: () => readingTabsApi.outsideRules(query),
    placeholderData: keepPreviousData,
    retry: false,
  })
  return (
    <div className="flex flex-col gap-3" data-reading-tab="outside-rules">
      <TabRead read={read}>{(reply) => <OutsideRules reply={reply} />}</TabRead>
    </div>
  )
}

function OutsideRules({ reply }: { reply: ResultsOutsideRulesReply }) {
  const { t } = useTranslation('sourcing-results')
  return (
    <div className="flex flex-col gap-3">
      <p className="max-w-[78ch] text-sm text-muted-foreground" data-outside-rules-group="">
        {t('outsideRules.group')}
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
              const known = KNOWN_REASONS.has(r.reason)
              const name = known ? t(`outsideRules.reasons.${r.reason}`) : fsi(r.reason)
              return (
                <tr key={r.reason} className="border-b border-border/60" data-outside-reason={r.reason}>
                  <td className={`${TD_WRAP} font-semibold`}>{known ? name : <Ltr>{r.reason}</Ltr>}</td>
                  <td className={TD_NUM}>
                    <Drill figure={{ kind: 'outsideRules', reason: r.reason }} count={r.orders} />
                  </td>
                  <td className={TD_WRAP}>
                    <div className="flex items-center gap-2">
                      <div className="min-w-0 flex-1">
                        <ShareBar
                          segments={[
                            { id: r.reason, weight: r.percent, colour: 'var(--results-rules)' },
                            { id: 'rest', weight: Math.max(0, 100 - r.percent), colour: 'var(--muted)' },
                          ]}
                          label={t('outsideRules.barLabel', { reason: name, percent: fsi(percentText(r.percent)) })}
                        />
                      </div>
                      <span className="w-14 text-end text-xs">
                        <Pct value={r.percent} />
                      </span>
                    </div>
                  </td>
                  <td className={`${TD_WRAP} text-xs text-muted-foreground`}>{t(known ? `outsideRules.says.${r.reason}` : 'outsideRules.says.other')}</td>
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

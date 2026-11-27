import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import type { ResultsNotRunReply } from '@/core/models/sourcing-results'
import Ltr from '@/core/ui/Ltr'
import { sourcingResultsApi } from './api'
import { Word } from './codes'
import Drill from './Drill'
import type { ResultsTabProps } from './ResultsTabs'
import TabRead, { TD_NUM, TD_WRAP, TH_NUM, TH_WRAP } from './TabRead'
import { countText } from './text'

/**
 * Orders not run (ticket 972, results ticket decision 13 and the amendment by BO 4281; BO 4393 `Results/NotRun`): the
 * orders that landed in the period and got no comparison run, by reason; then the orders OMS ran itself, by why no
 * checkout run was used. An order not run has no summary row, so its count opens nothing (SERVER GAP, spec 4354: the
 * orders door reads summary rows only); an order OMS ran opens through the Breakdowns' "who made the run".
 */
export default function NotRunTab({ query }: ResultsTabProps) {
  const read = useQuery({
    queryKey: ['sourcing-results', 'not-run', query],
    queryFn: () => sourcingResultsApi.notRun(query),
    placeholderData: keepPreviousData,
    retry: false,
  })
  return (
    <div className="flex flex-col gap-3" data-reading-tab="not-run">
      <TabRead read={read}>{(reply) => <NotRun reply={reply} />}</TabRead>
    </div>
  )
}

function NotRun({ reply }: { reply: ResultsNotRunReply }) {
  const { t } = useTranslation('sourcing-results')
  return (
    <div className="grid items-start gap-6 lg:grid-cols-2">
      <table className="w-full text-sm" data-not-run="">
        <thead className="border-b border-border text-xs text-muted-foreground">
          <tr>
            <th className={TH_WRAP}>{t('notRun.cols.reason')}</th>
            <th className={TH_NUM}>{t('notRun.cols.orders')}</th>
          </tr>
        </thead>
        <tbody>
          {reply.notRun.map((r) => (
            <tr key={r.code} className="border-b border-border/60" data-not-run-reason={r.code}>
              <td className={TD_WRAP}>
                <Word k={`notRun.reasons.${r.code}`} family="NOT_RUN" code={r.code} />
              </td>
              <td className={TD_NUM}>
                <Ltr>{countText(r.orders)}</Ltr>
              </td>
            </tr>
          ))}
          <tr>
            <td className={`${TD_WRAP} text-xs text-muted-foreground`} colSpan={2} data-not-run-not-counted="">
              {t('notRun.notCounted')}
            </td>
          </tr>
        </tbody>
      </table>
      <table className="w-full text-sm" data-own-run="">
        <thead className="border-b border-border text-xs text-muted-foreground">
          <tr>
            <th className={TH_WRAP}>{t('notRun.ownRun')}</th>
            <th className={TH_NUM}>{t('notRun.cols.orders')}</th>
          </tr>
        </thead>
        <tbody>
          {reply.ownRun.map((r) => (
            <tr key={r.code} className="border-b border-border/60" data-own-run-reason={r.code}>
              <td className={TD_WRAP}>
                <Word family="OWN_RUN" code={r.code} />
              </td>
              <td className={TD_NUM}>
                <Drill figure={{ kind: 'breakdown', by: 'MADE_BY', key: r.code }} count={r.orders} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

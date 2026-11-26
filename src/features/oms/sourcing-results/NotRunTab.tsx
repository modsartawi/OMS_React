import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import type { ResultsNotRunReply } from '@/core/models/sourcing-results'
import Ltr from '@/core/ui/Ltr'
import { TD } from '@/core/ui/sheet-table'
import { readingTabsApi } from './api'
import Drill from './Drill'
import type { ResultsTabProps } from './ResultsTabs'
import TabRead, { TD_NUM, TD_WRAP, TH_NUM, TH_WRAP } from './TabRead'
import { countText } from './text'

/** The reasons the page has words for. PROVISIONAL (spec 4354: not specified) — the codes. */
const KNOWN_REASONS = new Set(['WORKER_OFF', 'TOO_LATE', 'NO_RUN_AFTER_ATTEMPTS', 'STOCK_READ_FAILED'])

/**
 * Orders not run (ticket 972, results ticket decision 13 and the amendment by BO 4281): the reasons with their counts,
 * and what is not counted here.
 */
export default function NotRunTab({ query }: ResultsTabProps) {
  const read = useQuery({
    queryKey: ['sourcing-results', 'not-run', query],
    queryFn: () => readingTabsApi.notRun(query),
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
    <div className="overflow-x-auto">
      <table className="w-full min-w-[36rem] text-sm">
        <thead className="border-b border-border text-xs text-muted-foreground">
          <tr>
            <th className={TH_WRAP}>{t('notRun.cols.reason')}</th>
            <th className={TH_NUM}>{t('notRun.cols.orders')}</th>
          </tr>
        </thead>
        <tbody>
          {reply.reasons.map((r) => (
            <tr key={r.reason} className="border-b border-border/60" data-not-run-reason={r.reason}>
              <td className={TD_WRAP}>{KNOWN_REASONS.has(r.reason) ? t(`notRun.reasons.${r.reason}`) : <Ltr>{r.reason}</Ltr>}</td>
              <td className={TD_NUM}>
                <Drill figure={{ kind: 'notRunReason', reason: r.reason }} count={r.orders} />
              </td>
            </tr>
          ))}
          <tr className="border-t border-border font-semibold" data-not-run-total="">
            <td className={TD}>{t('notRun.total')}</td>
            <td className={TD_NUM}>
              <Ltr>{countText(reply.orders)}</Ltr>
            </td>
          </tr>
          <tr>
            <td className={`${TD_WRAP} text-xs text-muted-foreground`} colSpan={2} data-not-run-not-counted="">
              {t('notRun.notCounted')}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}

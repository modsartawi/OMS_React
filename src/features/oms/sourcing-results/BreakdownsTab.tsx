import { useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { RESULTS_BREAKDOWN_BYS, type ResultsBreakdownBy, type ResultsBreakdownReply } from '@/core/models/sourcing-results'
import Chip from '@/core/ui/Chip'
import Ltr from '@/core/ui/Ltr'
import { TD } from '@/core/ui/sheet-table'
import { sourcingResultsApi } from './api'
import { breakdownsTable, BREAKDOWN_COLUMNS, type BreakdownColumn, type BreakdownLabel, type BreakdownTableRow } from './breakdowns-model'
import { Word } from './codes'
import Drill from './Drill'
import type { ResultsTabProps } from './ResultsTabs'
import TabRead, { Minutes, TD_NUM, TD_WRAP, TH_NUM, TH_WRAP } from './TabRead'
import { countText } from './text'

/**
 * The Breakdowns tab (ticket 972, results ticket decision 10 and its amendments; BO 4393 `Results/Breakdown?by=`): one
 * table with a switch for its rows — mode, city, channel, day, who made the run (the channel, or OMS by why no checkout
 * run was used), the channel's own split, the orders with a line the stock figure could not cover — the same columns in
 * every grouping, each a count of the row's orders, and the total row as sent. Pairs cut by the cap is a column. No
 * riyal column.
 *
 * SERVER GAP (spec 4354) — not answered, because the summary row does not hold them (BO 4393 build notes): "of the runs
 * with pairs cut, those with a line not available", "the order's own store was passed over although its shelf held the
 * cart", the short-figure rows by stock class, and the column under "Set beside it" (a trial's rows are not broken down).
 */
export default function BreakdownsTab({ query }: ResultsTabProps) {
  const { t } = useTranslation('sourcing-results')
  const [by, setBy] = useState<ResultsBreakdownBy>('MODE')
  const read = useQuery({
    queryKey: ['sourcing-results', 'breakdown', query, by],
    queryFn: () => sourcingResultsApi.breakdown(query, by),
    placeholderData: keepPreviousData,
    retry: false,
  })
  return (
    <div className="flex flex-col gap-3" data-reading-tab="breakdowns" data-breakdowns={by}>
      <div className="flex flex-wrap items-center gap-1" role="group" aria-label={t('breakdowns.rowsLabel')}>
        {RESULTS_BREAKDOWN_BYS.map((b) => (
          <Chip key={b} on={by === b} onClick={() => setBy(b)} data-breakdown-by={b}>
            {t(`breakdowns.by.${b}`)}
          </Chip>
        ))}
      </div>
      <p className="max-w-[90ch] text-xs text-muted-foreground">{t(`breakdowns.hints.${by}`)}</p>
      <TabRead read={read}>{(reply) => <Breakdowns reply={reply} />}</TabRead>
    </div>
  )
}

function Breakdowns({ reply }: { reply: ResultsBreakdownReply }) {
  const { t } = useTranslation('sourcing-results')
  const table = breakdownsTable(reply)
  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[64rem] text-sm" data-breakdowns-table={table.by}>
          <thead className="border-b border-border text-xs text-muted-foreground">
            <tr>
              <th className={TH_WRAP}>{t(`breakdowns.by.${table.by}`)}</th>
              {BREAKDOWN_COLUMNS.map((c) => (
                <th key={c} className={`${TH_NUM} whitespace-normal`} data-col={c}>
                  {t(`breakdowns.cols.${c}`)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.rows.map((r) => (
              <Row key={r.key} row={r} />
            ))}
            <tr className="border-t border-border font-semibold" data-breakdown-total="">
              <td className={TD}>{t('breakdowns.all')}</td>
              {BREAKDOWN_COLUMNS.map((c) => (
                <td key={c} className={TD_NUM}>
                  <Cell column={c} value={table.total.cells[c]} />
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
      {!table.addsUp && (
        <p className="text-xs text-attention-800" data-breakdowns-mismatch="">
          {t('breakdowns.mismatch')}
        </p>
      )}
      <p className="text-xs text-muted-foreground">{t('breakdowns.note')}</p>
    </div>
  )
}

function Row({ row }: { row: BreakdownTableRow }) {
  return (
    <tr className="border-b border-border/60" data-breakdown-row={row.key}>
      <td className={TD_WRAP}>
        <RowLabel label={row.label} />
      </td>
      {BREAKDOWN_COLUMNS.map((c) => (
        <td key={c} className={TD_NUM}>
          {c === 'orders' && row.figure ? <Drill figure={row.figure} count={row.cells.orders ?? 0} /> : <Cell column={c} value={row.cells[c]} />}
        </td>
      ))}
    </tr>
  )
}

function Cell({ column, value }: { column: BreakdownColumn; value: number | null }) {
  if (column === 'middleEstimate') return <Minutes value={value} />
  return <Ltr>{countText(value ?? 0)}</Ltr>
}

function RowLabel({ label }: { label: BreakdownLabel }) {
  const { t } = useTranslation('sourcing-results')
  switch (label.kind) {
    case 'modeMix':
      return <Word k={`breakdowns.modeRows.${label.code}`} family="MODE_MIX" code={label.code} />
    case 'text':
      return <bdi>{label.text}</bdi>
    case 'channel':
      return <Word k={`channels.${label.code}`} family="CHANNEL" code={label.code} />
    case 'date':
      return <Ltr>{label.day}</Ltr>
    case 'madeBy':
      return label.code === 'CHANNEL' || label.code === 'OMS' ? (
        <>{t(`breakdowns.madeBy.${label.code}`)}</>
      ) : (
        <>
          {t('breakdowns.madeBy.omsBecause')} <Word family="OWN_RUN" code={label.code} />
        </>
      )
    case 'ownSplit':
      return <Word k={`breakdowns.splitParts.${label.code}`} family="OWN_SPLIT" code={label.code} />
  }
}

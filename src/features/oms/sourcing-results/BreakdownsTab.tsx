import { useState, type ReactNode } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Trans, useTranslation } from 'react-i18next'
import { RESULTS_BREAKDOWN_BYS, type ResultsBreakdownBy, type ResultsBreakdownsReply } from '@/core/models/sourcing-results'
import Chip from '@/core/ui/Chip'
import Ltr from '@/core/ui/Ltr'
import { readingTabsApi } from './api'
import { breakdownsTable, type BreakdownLabel, type BreakdownTableRow, type BreakdownColumn } from './breakdowns-model'
import Drill from './Drill'
import type { ResultsTabProps } from './ResultsTabs'
import TabRead, { Minutes, Pct, TD_NUM, TD_WRAP, TH_NUM, TH_WRAP } from './TabRead'
import { TD } from '@/core/ui/sheet-table'
import { countText } from './text'

/**
 * The Breakdowns tab (ticket 972, results ticket decision 10 and its amendments): one table with a switch for its
 * rows — mode, city, channel or day — the same columns in every grouping and the total row as sent; under the rows "a
 * line the stock figure could not cover" by stock class and mode and "the channel's own split" in three parts; then who
 * made the run, the runs with pairs cut by the cap (per city), and the orders whose own store was passed over. No riyal
 * column.
 */
export default function BreakdownsTab({ query }: ResultsTabProps) {
  const { t } = useTranslation('sourcing-results')
  const [by, setBy] = useState<ResultsBreakdownBy>('MODE')
  const read = useQuery({
    queryKey: ['sourcing-results', 'breakdowns', query, by],
    queryFn: () => readingTabsApi.breakdowns(query, by),
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
      <TabRead read={read}>{(reply) => <Breakdowns reply={reply} />}</TabRead>
    </div>
  )
}

function Breakdowns({ reply }: { reply: ResultsBreakdownsReply }) {
  const { t } = useTranslation('sourcing-results')
  const table = breakdownsTable(reply)
  const span = table.columns.length + 1
  return (
    <div className="flex flex-col gap-4">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[64rem] text-sm" data-breakdowns-table={table.header}>
          <thead className="border-b border-border text-xs text-muted-foreground">
            <tr>
              <th className={TH_WRAP}>{t(`breakdowns.by.${table.header}`)}</th>
              {table.columns.map((c) => (
                <th key={c} className={`${TH_NUM} whitespace-normal`} data-col={c}>
                  {t(`breakdowns.cols.${c}`)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.rows.map((r) => (
              <Row key={r.key} row={r} columns={table.columns} />
            ))}
            <tr className="border-t border-border font-semibold" data-breakdown-total="">
              <td className={TD}>{t('breakdowns.all')}</td>
              {table.columns.map((c) => (
                <td key={c} className={TD_NUM}>
                  <Cell column={c} value={table.total.cells[c]} />
                </td>
              ))}
            </tr>
            <GroupHead span={span} title={t('breakdowns.stockShort')} hint={t('breakdowns.stockShortHint')} data="stock-short" />
            {table.stockShort.map((r) => (
              <Row key={r.key} row={r} columns={table.columns} group="stock-short" />
            ))}
            <GroupHead span={span} title={t('breakdowns.channelSplit')} hint={t('breakdowns.channelSplitHint')} data="channel-split" />
            {table.channelSplit.map((r) => (
              <Row key={r.key} row={r} columns={table.columns} group="channel-split" />
            ))}
          </tbody>
        </table>
      </div>
      {!table.addsUp && (
        <p className="text-xs text-attention-800" data-breakdowns-mismatch="">
          {t('breakdowns.mismatch')}
        </p>
      )}
      <p className="text-xs text-muted-foreground">{t('breakdowns.note')}</p>
      <div className="grid items-start gap-4 lg:grid-cols-3">
        <MadeBy reply={reply} />
        <PairsCut reply={reply} />
        <Card title={t('breakdowns.storePassedOver.title')} data="store-passed-over">
          <p className="text-sm">
            <Trans
              t={t}
              i18nKey="breakdowns.storePassedOver.line"
              components={{ n: <Drill figure={{ kind: 'storePassedOver' }} count={reply.storePassedOver} /> }}
            />
          </p>
        </Card>
      </div>
    </div>
  )
}

function Row({ row, columns, group }: { row: BreakdownTableRow; columns: readonly BreakdownColumn[]; group?: string }) {
  return (
    <tr className="border-b border-border/60" data-breakdown-row={row.key} data-breakdown-group={group}>
      <td className={`${TD_WRAP} ${group ? 'ps-5' : ''}`}>
        <RowLabel label={row.label} />
      </td>
      {columns.map((c) => (
        <td key={c} className={TD_NUM}>
          {c === 'orders' && row.figure ? <Drill figure={row.figure} count={row.cells.orders ?? 0} /> : <Cell column={c} value={row.cells[c]} />}
        </td>
      ))}
    </tr>
  )
}

function Cell({ column, value }: { column: BreakdownColumn; value: number | null }) {
  if (column === 'orders') return <Ltr>{countText(value ?? 0)}</Ltr>
  if (column === 'estimateMiddle') return <Minutes value={value} />
  return <Pct value={value} />
}

function RowLabel({ label }: { label: BreakdownLabel }) {
  const { t } = useTranslation('sourcing-results')
  switch (label.kind) {
    case 'mode':
      return <>{t(`breakdowns.modeRows.${label.mode}`, { defaultValue: label.mode })}</>
    case 'text':
      return <bdi>{label.text}</bdi>
    case 'otherCities':
      return <>{t('breakdowns.otherCities')}</>
    case 'channel':
      return <bdi>{t(`channels.${label.code}`, { defaultValue: label.code })}</bdi>
    case 'date':
      return <Ltr>{label.day}</Ltr>
    case 'stockShort':
      return <>{t('breakdowns.stockShortRow', { cls: t(`stockClasses.${label.stockClass}`), mode: t(`modes.${label.mode}`) })}</>
    case 'channelSplit':
      return <>{t(`breakdowns.splitParts.${label.part}`)}</>
  }
}

function GroupHead({ span, title, hint, data }: { span: number; title: string; hint: string; data: string }) {
  return (
    <tr className="border-b border-border bg-muted/40" data-breakdown-group-head={data}>
      <th colSpan={span} className={`${TH_WRAP} pt-3`}>
        <span className="font-semibold">{title}</span> <span className="text-xs font-normal text-muted-foreground">{hint}</span>
      </th>
    </tr>
  )
}

function Card({ title, data, children }: { title: string; data: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2 rounded-md border border-border p-3" data-breakdowns-card={data}>
      <h3 className="text-sm font-semibold">{title}</h3>
      {children}
    </section>
  )
}

function MadeBy({ reply }: { reply: ResultsBreakdownsReply }) {
  const { t } = useTranslation('sourcing-results')
  return (
    <Card title={t('breakdowns.madeBy.title')} data="made-by">
      <ul className="flex flex-col gap-1 text-sm">
        {reply.madeBy.map((m) => (
          <li key={m.madeBy} className="flex items-center justify-between gap-2" data-made-by={m.madeBy}>
            <span>{t(`breakdowns.madeBy.makers.${m.madeBy}`)}</span>
            <span className="inline-flex items-center gap-2">
              <Drill figure={{ kind: 'madeBy', madeBy: m.madeBy }} count={m.runs} />
              <span className="text-xs text-muted-foreground">
                <Pct value={m.percent} />
              </span>
            </span>
          </li>
        ))}
      </ul>
      <h4 className="mt-1 text-xs font-medium text-muted-foreground">{t('breakdowns.madeBy.noCheckoutTitle')}</h4>
      <ul className="flex flex-col gap-1 text-sm">
        {reply.noCheckoutRun.map((r) => (
          <li key={r.reason} className="flex items-center justify-between gap-2" data-no-checkout={r.reason}>
            <span>{t(`breakdowns.madeBy.noCheckout.${r.reason}`)}</span>
            <Drill figure={{ kind: 'noCheckoutRun', reason: r.reason }} count={r.runs} />
          </li>
        ))}
      </ul>
    </Card>
  )
}

function PairsCut({ reply }: { reply: ResultsBreakdownsReply }) {
  const { t } = useTranslation('sourcing-results')
  const { pairsCut } = reply
  return (
    <Card title={t('breakdowns.pairsCut.title')} data="pairs-cut">
      <p className="text-sm">
        <Trans
          t={t}
          i18nKey="breakdowns.pairsCut.line"
          components={{
            runs: <Drill figure={{ kind: 'pairsCut', city: null, lineNotAvailable: false }} count={pairsCut.runs} />,
            line: <Drill figure={{ kind: 'pairsCut', city: null, lineNotAvailable: true }} count={pairsCut.lineNotAvailable} />,
          }}
        />
      </p>
      <table className="w-full text-sm">
        <thead className="border-b border-border text-xs text-muted-foreground">
          <tr>
            <th className={TH_WRAP}>{t('breakdowns.pairsCut.city')}</th>
            <th className={`${TH_NUM} whitespace-normal`}>{t('breakdowns.pairsCut.runs')}</th>
            <th className={`${TH_NUM} whitespace-normal`}>{t('breakdowns.pairsCut.share')}</th>
            <th className={`${TH_NUM} whitespace-normal`}>{t('breakdowns.pairsCut.lineNotAvailable')}</th>
          </tr>
        </thead>
        <tbody>
          {pairsCut.cities.map((c) => (
            <tr key={c.city} className="border-b border-border/60" data-pairs-cut-city={c.city}>
              <td className={TD_WRAP}>
                <bdi>{c.city}</bdi>
              </td>
              <td className={TD_NUM}>
                <Drill figure={{ kind: 'pairsCut', city: c.city, lineNotAvailable: false }} count={c.runs} />
              </td>
              <td className={TD_NUM}>
                <Pct value={c.percent} />
              </td>
              <td className={TD_NUM}>
                <Drill figure={{ kind: 'pairsCut', city: c.city, lineNotAvailable: true }} count={c.lineNotAvailable} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-xs text-muted-foreground">{t('breakdowns.pairsCut.note')}</p>
    </Card>
  )
}

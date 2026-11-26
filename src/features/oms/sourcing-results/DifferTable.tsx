import { useTranslation } from 'react-i18next'
import { RESULTS_VIEWS, type ResultsDifferRow, type ResultsView } from '@/core/models/sourcing-results'
import Chip from '@/core/ui/Chip'
import Ltr from '@/core/ui/Ltr'
import { TD, TH } from '@/core/ui/sheet-table'
import { fsi } from '@/core/util/bidi'
import { differRows, type DifferRow, type DifferTable as Table, type EndingSegment } from './differ-rows-model'
import Drill from './Drill'
import { ESTIMATE_INK, HATCH, endingInk } from './inks'
import { percentText } from './text'

/** The sheet cells, wrapping: the house strings hold `whitespace-nowrap`, and a second class would not override it. */
const TH_WRAP = TH.replace('whitespace-nowrap', 'whitespace-normal')
const TD_WRAP = TD.replace('whitespace-nowrap', 'whitespace-normal')

const ENDING_ORDER: EndingSegment['ending'][] = ['ON_TIME', 'LATE', 'RETURNED', 'CANCELLED', 'CUSTOMER_CANCELLED']

/**
 * "Where the plans differ" (ticket 971, results ticket decision 3): a switch for the view, one row per class that
 * differs and "same plan" last as the reference; the advisor's plan ESTIMATED beside what happened MEASURED, in one
 * table and never one above the other; a fixed note that the page does not say which was better. One neutral colour
 * for the estimate, no green and no red.
 */
export default function DifferTable({ rows, view, onView }: { rows: ResultsDifferRow[]; view: ResultsView; onView: (v: ResultsView) => void }) {
  const { t } = useTranslation('sourcing-results')
  const table = differRows(rows, view)
  return (
    <section className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4" data-results-differ={view}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold">{t('differ.title')}</h2>
        <div className="flex flex-wrap items-center gap-1" role="group" aria-label={t('differ.viewLabel')}>
          {RESULTS_VIEWS.map((v) => (
            <Chip key={v} on={view === v} onClick={() => onView(v)} data-differ-view={v}>
              {t(`views.${v}`)}
            </Chip>
          ))}
        </div>
      </div>
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground" data-endings-legend="">
        {ENDING_ORDER.map((e) => (
          <li key={e} className="inline-flex items-center gap-1.5">
            <i
              className="inline-block h-2.5 w-2.5 rounded-sm"
              style={{ backgroundColor: endingInk(e), backgroundImage: e === 'CUSTOMER_CANCELLED' ? HATCH : undefined }}
              aria-hidden
            />
            {t(`endings.${e}`)}
          </li>
        ))}
      </ul>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[56rem] table-fixed text-sm">
          <colgroup>
            <col className="w-[18%]" />
            <col className="w-[9%]" />
            <col className="w-[40%]" />
            <col className="w-[33%]" />
          </colgroup>
          <thead className="border-b border-border text-xs text-muted-foreground">
            <tr>
              <th className={TH_WRAP}>{t('differ.cols.cls')}</th>
              <th className={`${TH} text-end`}>{t('differ.cols.orders')}</th>
              <th className={TH_WRAP}>
                {t('differ.cols.estimated')}
                <div className="font-normal">{t('differ.cols.estimatedHint')}</div>
                <AxisEnds table={table} />
              </th>
              <th className={TH_WRAP}>
                {t('differ.cols.measured')}
                <div className="font-normal">{t('differ.cols.measuredHint')}</div>
              </th>
            </tr>
          </thead>
          <tbody>
            {table.rows.map((r) => (
              <Row key={r.cls} row={r} view={view} table={table} />
            ))}
          </tbody>
        </table>
      </div>
      <p className="max-w-[90ch] text-xs text-muted-foreground" data-differ-note="">
        {t('differ.note')}
      </p>
    </section>
  )
}

function AxisEnds({ table }: { table: Table }) {
  const { t } = useTranslation('sourcing-results')
  return (
    <div className="mt-1 flex justify-between font-normal" data-differ-axis="">
      <span>{t('differ.axisLater', { minutes: fsi(Math.abs(table.axis.from)) })}</span>
      <span>{t('differ.axisEarlier', { minutes: fsi(table.axis.to) })}</span>
    </div>
  )
}

function Row({ row, view, table }: { row: DifferRow; view: ResultsView; table: Table }) {
  const { t } = useTranslation('sourcing-results')
  const e = row.estimate
  return (
    <tr className={`border-b border-border/60 ${row.reference ? 'bg-muted/50' : ''}`} data-differ-row={row.cls}>
      <td className={TD_WRAP}>
        <span className="inline-flex items-center gap-1.5 font-semibold">
          <i className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: row.ink, backgroundImage: row.cls === 'CALLOUT_FALLBACK' ? HATCH : undefined }} aria-hidden />
          {t(`classes.${row.cls}`)}
        </span>
      </td>
      <td className={`${TD} text-end`}>
        <Drill figure={{ kind: 'class', view, cls: row.cls }} count={row.orders} />
        <div className="text-xs text-muted-foreground">
          <Ltr>{percentText(row.percent)}</Ltr>
        </div>
      </td>
      <td className={TD_WRAP} data-differ-estimate={e.kind}>
        {e.kind === 'estimate' ? (
          <>
            <div
              className="relative h-4"
              role="img"
              aria-label={t('differ.estimateLabel', { middle: fsi(e.middle), low: fsi(e.low), high: fsi(e.high) })}
            >
              <span className="absolute inset-x-0 top-1/2 h-px bg-border" aria-hidden />
              <span className="absolute inset-y-0 w-px bg-muted-foreground" style={{ insetInlineStart: `${table.axis.zero}%` }} aria-hidden />
              <span
                className="absolute top-1 h-2 rounded-sm opacity-40"
                style={{ insetInlineStart: `${e.at.start}%`, width: `${Math.max(e.at.width, 0.5)}%`, backgroundColor: ESTIMATE_INK }}
                aria-hidden
              />
              <span
                className="absolute top-0.5 h-3 w-3 -translate-x-1/2 rounded-full rtl:translate-x-1/2"
                style={{ insetInlineStart: `${e.at.middle}%`, backgroundColor: ESTIMATE_INK }}
                aria-hidden
              />
            </div>
            <div className="text-xs">{t(`differ.says.${e.says.way}`, { minutes: fsi(e.says.minutes) })}</div>
          </>
        ) : e.kind === 'none' ? (
          <span className="text-xs text-muted-foreground">{t(`differ.none.${e.why}`)}</span>
        ) : (
          <span className="text-xs text-muted-foreground">{t('differ.reference')}</span>
        )}
      </td>
      <td className={TD_WRAP}>
        <EndingsBar endings={row.endings} />
        <div className="text-xs text-muted-foreground">
          {t('differ.endingsLine', {
            onTime: fsi(percentText(row.endings[0].percent)),
            late: fsi(percentText(row.endings[1].percent)),
            returned: fsi(percentText(row.endings[2].percent)),
            cancelled: fsi(percentText(row.endings[3].percent)),
          })}
        </div>
      </td>
    </tr>
  )
}

function EndingsBar({ endings }: { endings: EndingSegment[] }) {
  const { t } = useTranslation('sourcing-results')
  const drawn = endings.filter((e) => e.percent > 0)
  if (drawn.length === 0) return <span className="text-xs text-muted-foreground">{t('dash')}</span>
  const label = drawn.map((e) => `${t(`endings.${e.ending}`)} ${fsi(percentText(e.percent))}`).join(t('listJoin'))
  return (
    <div className="flex h-3 w-full gap-px overflow-hidden rounded-full" role="img" aria-label={label} data-endings-bar="">
      {drawn.map((e) => (
        <span
          key={e.ending}
          className="h-full"
          style={{ flex: `${e.percent} 0 0`, backgroundColor: e.ink, backgroundImage: e.hatched ? HATCH : undefined }}
          title={`${t(`endings.${e.ending}`)} ${fsi(percentText(e.percent))}`}
          data-ending={e.ending}
        />
      ))}
    </div>
  )
}

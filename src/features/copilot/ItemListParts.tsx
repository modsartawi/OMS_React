import { Link } from 'react-router'
import { Trans, useTranslation } from 'react-i18next'
import { CalendarRange, ListChecks } from 'lucide-react'
import type { CopilotListPeriods } from '@/core/models/copilot'
import Ltr from '@/core/ui/Ltr'
import { formatFigure } from '@/core/util/number-format'
import { calendarWarnings, formatChange, listPeriodsTable, usedListRows } from './answer-item-lists'
import { lineDir, type CopilotAnswerModel } from './answer'

/**
 * oms-react 926 (BackOffice spec 4057): the parts of an answer that used an item list.
 *
 * - **The "Used" line** (BO 4061): the server's own sentence, under the assumption lines, in the question's language,
 *   drawn as sent (free text: `<bdi>`), with a link to the list's page by route string.
 * - **The `list_periods` comparison** (BO 4060): each member's per-day figure by status and its change, with the
 *   server's per-status total, and each calendar overlap as a warning line.
 */

export function UsedLists({ model, lang }: { model: CopilotAnswerModel; lang: string }) {
  const { t } = useTranslation('copilot')
  const rows = usedListRows(model, lang)
  if (rows.length === 0) return null
  return (
    <ul aria-label={t('itemLists.used')} className="flex flex-col gap-1 text-sm" data-copilot-used-lists>
      {/* The index joins the id: an answer may name one list twice (two of its versions). */}
      {rows.map((r, i) => (
        <li key={`${i}:${r.listId}`} className="flex flex-wrap items-center gap-x-2 gap-y-1" data-copilot-used-list={r.listId}>
          <ListChecks className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
          <span dir={lineDir(lang)} lang={lang} data-copilot-used-line>
            <bdi>{r.text}</bdi>
          </span>
          <Link to={r.href} className="text-xs text-primary underline underline-offset-2" data-copilot-used-list-link>
            {t('itemLists.openList')}
          </Link>
        </li>
      ))}
    </ul>
  )
}

export function ListPeriodsPart({ lp, lang }: { lp: CopilotListPeriods; lang: string }) {
  const { t } = useTranslation('copilot')
  const table = listPeriodsTable(lp)
  const warnings = calendarWarnings(lp, lang)
  const cell = (v: number | null) => (v === null ? '' : <Ltr>{formatFigure(v)}</Ltr>)
  return (
    <section aria-label={t('itemLists.periodsTitle')} className="flex min-w-0 flex-col gap-2 text-sm" data-copilot-list-periods={lp.listId}>
      <p className="text-xs font-medium text-muted-foreground">
        {t('itemLists.periodsHeading', { measure: t(`itemLists.measure.${lp.measure}`) })}
      </p>
      {warnings.length > 0 && (
        <ul className="flex flex-col gap-1" data-copilot-calendar-warnings>
          {warnings.map((w, i) => (
            <li key={i} role="note" className="flex items-start gap-1.5 text-xs text-attention-800" data-copilot-calendar-warning={w.status}>
              <CalendarRange className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              <span>
                <Trans
                  t={t}
                  i18nKey={`itemLists.overlap.${w.member === null ? 'total' : 'member'}${w.open ? 'Open' : ''}`}
                  values={{ member: w.member ?? '', status: t(`itemLists.status.${w.status}`), period: w.period, event: w.event, eventPeriod: w.eventPeriod }}
                  components={{ member: <bdi />, period: <Ltr />, event: <bdi />, eventPeriod: <Ltr /> }}
                />
              </span>
            </li>
          ))}
        </ul>
      )}
      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full text-xs" data-copilot-list-periods-table>
          <thead className="bg-muted/50 text-muted-foreground">
            <tr>
              <th className="px-2 py-1.5 text-start font-medium">{t('itemLists.member')}</th>
              {table.statuses.map((s) => (
                <th key={s} className="px-2 py-1.5 text-end font-medium" data-status={s}>
                  {t('itemLists.perDayIn', { status: t(`itemLists.status.${s}`) })}
                </th>
              ))}
              <th className="px-2 py-1.5 text-end font-medium">{t('itemLists.change')}</th>
            </tr>
          </thead>
          <tbody>
            {/* The index joins the member's key: two members may share a level and key (an item listed twice). */}
            {table.rows.map((r, n) => (
              <tr key={`${n}:${r.key}`} className="border-t border-border/60" data-copilot-list-member={r.key}>
                <td className="px-2 py-1.5">
                  <bdi>{r.member}</bdi>
                  {r.noPeriods && <span className="ms-2 text-muted-foreground" data-copilot-no-periods>{t('itemLists.noPeriods')}</span>}
                </td>
                {r.perDay.map((v, i) => (
                  <td key={table.statuses[i]} className="px-2 py-1.5 text-end tabular-nums">
                    {cell(v)}
                  </td>
                ))}
                <td className="px-2 py-1.5 text-end tabular-nums">{r.change === null ? '' : <Ltr>{formatChange(r.change)}</Ltr>}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-border font-medium" data-copilot-list-periods-total>
              <td className="px-2 py-1.5">{t('itemLists.total')}</td>
              {table.totals.map((v, i) => (
                <td key={table.statuses[i]} className="px-2 py-1.5 text-end tabular-nums" data-status={table.statuses[i]}>
                  {cell(v)}
                </td>
              ))}
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  )
}

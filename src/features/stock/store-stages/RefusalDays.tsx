import { useTranslation } from 'react-i18next'
import type { StoreGates } from '@/core/models/store-stage'
import Ltr from '@/core/ui/Ltr'
import { fsi } from '@/core/util/bidi'
import { TD, TH } from '@/core/ui/sheet-table'
import { formatDay } from '@/core/util/date-format'
import { formatFigure } from '@/core/util/number-format'
import { REFUSAL_DAY_COLUMNS, refusalDaysView } from './refusal-days'

/**
 * BackOffice 4277 (spec 4275, ADR 0146; SIS.Stock 086): under the gates, the store's takes per day of the would-be
 * refusals' window — the fallback's share of scanned takes beside the would-be refusal share, and in a `Record` store the
 * refusals the fallback would have placed. Figures only: the fallback has no gate of its own, and whoever confirms the
 * refusals were read confirms both. Nothing shows from a server without the days.
 */
export default function RefusalDays({ gates }: { gates: StoreGates }) {
  const { t } = useTranslation('store-stages')
  const view = refusalDaysView(gates)
  if (view.lines.length === 0) return null
  const columns = REFUSAL_DAY_COLUMNS.filter((c) => c !== 'wouldBePlacements' || view.showWouldBe)
  return (
    <div className="flex flex-col gap-1.5" data-stage-refusal-days={view.state ?? ''}>
      <h4 className="text-[0.8125rem] font-semibold">{t('refusalDays.title')}</h4>
      <p className="text-xs text-muted-foreground">
        {t('refusalDays.hint')}
        {view.state && (
          <>
            {' '}
            {t('refusalDays.state', { state: fsi(t(`fallback.state.${view.state}`, { defaultValue: view.state })) })}
          </>
        )}
      </p>
      <div className="overflow-x-auto rounded-md border border-border/60">
        <table className="w-full text-[0.8125rem]">
          <thead className="bg-muted/40">
            <tr>
              {columns.map((c) => (
                <th key={c} className={c === 'day' ? TH : `${TH} text-end`}>
                  {t(`refusalDays.column.${c}`)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {view.lines.map((line) => (
              <tr key={line.day} className="border-t border-border/40" data-refusal-day={line.day}>
                {columns.map((c) => (
                  <td key={c} className={c === 'day' ? TD : `${TD} text-end tabular-nums`} data-refusal-day-cell={c}>
                    <Ltr>
                      {c === 'day'
                        ? formatDay(line.day)
                        : c === 'refusalShare' || c === 'fallbackShare'
                          ? line[c] || t('dash')
                          : formatFigure(line[c])}
                    </Ltr>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

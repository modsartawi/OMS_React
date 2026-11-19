import { useTranslation } from 'react-i18next'
import { CalendarX, UserX } from 'lucide-react'
import type { MiniPosAssignment } from '@/core/models/mini-pos'
import Button from '@/core/ui/Button'
import Ltr from '@/core/ui/Ltr'
import StatusBadge from '@/core/ui/StatusBadge'
import { TD, TH } from '@/core/ui/sheet-table'
import { fsi, formatRange } from '@/core/util/bidi'
import { formatNumber } from '@/core/util/number-format'
import { canEndRow, dayOf, isEnded, promoterLabel, todayByStore } from './assignments'

/**
 * The assignments screen's drawn parts (oms 927): today's view, a list of rows, and the overlap notice. Props in, markup
 * out — no query, no mutation — so the component tests render them as static markup. The page owns the calls.
 *
 * Manage actions (End, End this promoter now) are drawn only when `canManage` (`MiniPosAdmin:06`); the door checks again.
 */

export interface RowActions {
  /** `MiniPosAdmin:06` — End and End this promoter now are drawn only with it. */
  canManage: boolean
  /** Local `yyyy-MM-dd`: a row whose last day is past offers no End. */
  today: string
  onEnd: (row: MiniPosAssignment) => void
  onEndPromoter: (row: MiniPosAssignment) => void
  /** A call is in flight: the actions wait. */
  busy?: boolean
}

/** Today's view: who is where, one block per pharmacy. */
export function TodayView({ rows, ...actions }: { rows: readonly MiniPosAssignment[] } & RowActions) {
  const { t } = useTranslation('mini-pos-assignments')
  const groups = todayByStore(rows)
  if (groups.length === 0)
    return (
      <p className="rounded-lg border border-border/60 bg-card/40 p-3 text-sm text-muted-foreground" data-minipos-today-empty="">
        {t('today.empty')}
      </p>
    )
  return (
    <div className="flex flex-col gap-3" data-minipos-today="">
      {groups.map((group) => (
        <section
          key={group.storeCode}
          className="rounded-lg border border-border/60 bg-card/40 p-3"
          data-minipos-today-store={group.storeCode}
        >
          <h3 className="mb-2 text-sm font-semibold">
            {t('today.store')} <Ltr>{group.storeCode}</Ltr>{' '}
            <span className="text-xs font-normal text-muted-foreground">
              {t('today.count', { n: fsi(String(group.rows.length)) })}
            </span>
          </h3>
          <AssignmentTable rows={group.rows} hideStore {...actions} />
        </section>
      ))}
    </div>
  )
}

/** A list of rows: promoter, pharmacy, days, hours a day, who entered it, and whether it is ended. */
export function AssignmentTable({
  rows,
  hideStore = false,
  canManage,
  today,
  onEnd,
  onEndPromoter,
  busy = false,
}: { rows: readonly MiniPosAssignment[]; hideStore?: boolean } & RowActions) {
  const { t } = useTranslation('mini-pos-assignments')
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[0.8125rem]">
        <thead className="text-xs text-muted-foreground">
          <tr>
            <th className={TH}>{t('row.promoter')}</th>
            {!hideStore && <th className={TH}>{t('row.store')}</th>}
            <th className={TH}>{t('row.days')}</th>
            <th className={TH}>{t('row.hours')}</th>
            <th className={TH}>{t('row.enteredBy')}</th>
            <th className={TH}>{t('row.state')}</th>
            {canManage && <th className={TH}>{t('row.actions')}</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.assignmentId} className="border-t border-border/40" data-minipos-row={row.assignmentId}>
              <td className={TD}>
                <bdi>{promoterLabel(row)}</bdi>
                <div className="font-mono text-[12px] text-muted-foreground">
                  <Ltr>{row.promoterLoginId}</Ltr>
                </div>
              </td>
              {!hideStore && (
                <td className={`${TD} font-mono`}>
                  <Ltr>{row.storeCode}</Ltr>
                </td>
              )}
              <td className={`${TD} tabular-nums`}>
                <Ltr>{formatRange(dayOf(row.fromDate), dayOf(row.toDate))}</Ltr>
              </td>
              <td className={`${TD} tabular-nums`}>
                <Ltr>{formatNumber(row.plannedHoursPerDay)}</Ltr>
              </td>
              <td className={`${TD} font-mono text-[12px]`}>
                <Ltr>{row.enteredBy}</Ltr>
              </td>
              <td className={TD}>
                {isEnded(row) ? (
                  <StatusBadge sev="mute">{t('row.ended')}</StatusBadge>
                ) : (
                  <StatusBadge sev="go">{t('row.active')}</StatusBadge>
                )}
              </td>
              {canManage && (
                <td className={TD}>
                  <div className="flex flex-wrap gap-1.5">
                    {canEndRow(row, today) && (
                      <Button variant="outlined" disabled={busy} onClick={() => onEnd(row)} data-minipos-end={row.assignmentId}>
                        <CalendarX className="h-3.5 w-3.5" aria-hidden />
                        {t('row.end')}
                      </Button>
                    )}
                    {!isEnded(row) && (
                      <Button
                        variant="danger-outlined"
                        disabled={busy}
                        onClick={() => onEndPromoter(row)}
                        data-minipos-end-promoter={row.promoterLoginId}
                      >
                        <UserX className="h-3.5 w-3.5" aria-hidden />
                        {t('row.endPromoter')}
                      </Button>
                    )}
                  </div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/**
 * The overlap refusal, from the server's own answer: the promoter already holds a row whose days meet the new one's, and
 * the clashing row is named — pharmacy and days — so the lead can end it or pick other days.
 */
export function OverlapNotice({ clash, message }: { clash: MiniPosAssignment; message: string }) {
  const { t } = useTranslation('mini-pos-assignments')
  return (
    <div
      role="alert"
      className="flex flex-col gap-1 rounded-md border border-danger-border bg-danger-050 p-2.5 text-[0.8125rem]"
      data-minipos-overlap={clash.assignmentId}
    >
      <p className="font-semibold">{t('overlap.title')}</p>
      <p>
        {t('overlap.detail', {
          promoter: fsi(promoterLabel(clash)),
          store: fsi(clash.storeCode),
          from: fsi(dayOf(clash.fromDate)),
          to: fsi(dayOf(clash.toDate)),
        })}
      </p>
      {message && (
        <p className="text-xs text-muted-foreground">
          <bdi>{message}</bdi>
        </p>
      )}
    </div>
  )
}

import { useEffect, useMemo, useState } from 'react'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Trans, useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'
import { apiErrorMessage } from '@/core/api'
import Button from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import GridPager from '@/core/ui/GridPager'
import Ltr from '@/core/ui/Ltr'
import { clampToLastPageWhenCurrentPageEmpties, showsPager } from '@/core/ui/pager'
import { notify } from '@/core/services/notify'
import type { AgreementDay, AgreementGap, StoreAgreement, StoreDetail } from '@/core/models/sync-console'
import { fsi } from '@/core/util/bidi'
import { formatDateTime } from '@/core/util/date-format'
import { formatMoney3 } from '@/core/util/number-format'
import { AUDIT_KEY, FLEET_KEY, storeAgreementQuery, storeKey, storeTabKey, syncConsoleAccessQuery, syncConsoleApi } from './api'
import { agreementBadge, figure } from './helpers'
import { AGREEMENT_PAGE_SIZE, applyRecheck, dayVerdict, isOnMirror, recheckRefusalLabel } from './store-helpers'
import { buildGapColumns } from './agreement-columns'
import CodeBadgeView from './CodeBadgeView'
import Loading from './Loading'
import ReasonDialog from './ReasonDialog'
import TabGrid from './TabGrid'

/** A gap's row id: the door's key (store, day, receipt, kind) within one store. */
const gapId = (g: AgreementGap) => `${g.businessDay}-${g.receiptNumber}-${g.kind}`

/** The day row's figures, in the order the columns are drawn. */
const COUNTS = ['mirrorCount', 'counterCount'] as const
const TOTALS = ['mirrorTotal', 'counterTotal'] as const
const GAPS = ['missingAtCounter', 'missingAtMirror', 'totalMismatches'] as const

const TH = 'px-2 py-1.5 font-medium whitespace-nowrap'
const TD = 'px-2 py-1 whitespace-nowrap'

/**
 * The Agreement tab (spec 2563, ticket 459), from `Store/Agreement`: whether this NewPos
 * store's finished sales reached HQ the same way on the counter rail and the mirror rail.
 *
 * The judged days (D-1..D-7) in the door's order, newest first, with each side's receipt
 * count and total and the gap counts. Picking a day narrows the gap list (the door's
 * `day`, paged by it at 50) to that day; "every day's gaps" goes back. A day with no
 * NewPos receipt is absent, and with none at all the tab says so.
 *
 * With `canOperate`, each listed day offers **Recheck**, with a reason, on the shared
 * dialog: the door judges it again at once. Its answer replaces the day's row, or removes
 * it when there was no NewPos receipt that day (`applyRecheck`); then the gaps, the store
 * header, the fleet and the audit feed are read again. Without the grant the tab is read
 * only: no Recheck column. A day not listed is never offered, so the door's `BAD_DATE`
 * cannot be reached from here.
 *
 * Offered to every store; one the mirror rail does not sweep (`onMirror: false`) shows
 * "not on mirror" and asks nothing (`isOnMirror`).
 */
export default function AgreementTab({ row }: { row: StoreDetail }) {
  const { t } = useTranslation('sync-console')
  if (!isOnMirror(row))
    return (
      <p className="py-6 text-center text-sm text-muted-foreground" data-agreement-tab="notOnMirror">
        {t('agreementTab.notOnMirror')}
      </p>
    )
  return <AgreementLists row={row} />
}

function AgreementLists({ row }: { row: StoreDetail }) {
  const { t } = useTranslation('sync-console')
  const code = row.code
  const qc = useQueryClient()
  const access = useQuery(syncConsoleAccessQuery())
  const canOperate = access.data?.canOperate === true
  const [day, setDay] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [rechecking, setRechecking] = useState<string | null>(null)

  const agreement = useQuery({ ...storeAgreementQuery(code, day, page), placeholderData: keepPreviousData })
  const columns = useMemo(() => buildGapColumns(t), [t])
  // As on Mirror: a failed read draws none of the previous day's rows.
  const shown = agreement.isError ? undefined : agreement.data
  const total = shown?.gaps.total ?? 0

  const pick = (next: string | null) => {
    setDay(next)
    setPage(1)
  }

  const recheck = useMutation({
    mutationFn: ({ day: d, reason }: { day: string; reason: string }) => syncConsoleApi.recheckAgreement({ code, day: d, reason }),
    onSuccess: (data, { day: d }) => {
      // The door's answer at once, on every page and day read so far; the re-read below confirms it.
      qc.setQueriesData<StoreAgreement>({ queryKey: storeTabKey(code, 'agreement') }, (old) =>
        old ? { ...old, days: applyRecheck(old.days, d, data.day) } : old,
      )
      const at = fsi(d)
      if (data.day === null) notify.success(t('agreementTab.recheck.removed', { day: at }))
      else if (data.day.agrees) notify.success(t('agreementTab.recheck.agrees', { day: at }))
      else notify.warn(t('agreementTab.recheck.disagrees', { day: at }))
      // The store's reads (the gaps and the header's agreement among them), the fleet and the audit feed.
      void qc.invalidateQueries({ queryKey: storeKey(code) })
      void qc.invalidateQueries({ queryKey: FLEET_KEY })
      void qc.invalidateQueries({ queryKey: AUDIT_KEY })
      close()
    },
  })

  const close = () => {
    recheck.reset()
    setRechecking(null)
  }

  // A picked day the door no longer lists (rechecked away by someone else, or aged out of
  // D-1..D-7) has nothing left to narrow to: back to every day's gaps.
  const listed = shown && !agreement.isPlaceholderData ? shown.days : undefined
  useEffect(() => {
    if (listed && day !== null && !listed.some((d) => d.businessDay === day)) {
      setDay(null)
      setPage(1)
    }
  }, [listed, day])

  // As on Passes: an emptied inner page (gaps healed meanwhile) falls back to the new last page.
  const settled = shown && !agreement.isPlaceholderData ? shown.gaps : undefined
  useEffect(() => {
    if (!settled) return
    const last = clampToLastPageWhenCurrentPageEmpties({
      page: settled.page,
      rowCount: settled.items.length,
      totalMatches: settled.total,
      pageSize: AGREEMENT_PAGE_SIZE,
    })
    if (last !== settled.page) setPage((p) => (p === settled.page ? last : p))
  }, [settled])

  if (agreement.isPending) return <Loading label={t('agreementTab.loading')} />
  const days = shown?.days

  return (
    <div className="flex flex-col gap-4" data-agreement-tab="onMirror">
      <div className="flex flex-wrap items-center gap-2 text-sm" data-agreement-overall={row.agreement}>
        <span className="text-muted-foreground">{t('agreementTab.overall')}</span>
        <CodeBadgeView badge={agreementBadge(row.agreement)} code={row.agreement} />
        {agreement.isFetching && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" aria-hidden />}
      </div>
      {agreement.isError && <ErrorBanner className="p-3" message={apiErrorMessage(agreement.error, t('agreementTab.failed'))} />}
      {days && days.length === 0 && (
        <p className="py-6 text-center text-sm text-muted-foreground" data-agreement-no-days="">
          {t('agreementTab.noDays')}
        </p>
      )}
      {days && days.length > 0 && (
        <DaysTable days={days} picked={day} canOperate={canOperate} onPick={pick} onRecheck={setRechecking} />
      )}
      {/* The gaps: drawn under the days, and beside a failed narrowed read so there is a way back. */}
      {(days ? days.length > 0 : day !== null || page > 1) && (
        <section className="flex flex-col gap-2" data-agreement-gaps={day ?? ''}>
          <div className="flex flex-wrap items-center gap-3">
            <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              {day === null ? (
                t('agreementTab.gaps.title')
              ) : (
                <Trans t={t} i18nKey="agreementTab.gaps.titleDay" values={{ day }} components={{ d: <Ltr /> }} />
              )}
            </h3>
            {day !== null && (
              <Button variant="text" onClick={() => pick(null)} data-agreement-all-days="">
                {t('agreementTab.gaps.allDays')}
              </Button>
            )}
            {agreement.isPlaceholderData && (
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground" role="status">
                <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
                {t('agreementTab.loading')}
              </span>
            )}
          </div>
          {shown && (
            <TabGrid
              rows={shown.gaps.items}
              columns={columns}
              rowId={gapId}
              // Drawn only on an answer: the read's loading and failure are the tab's, above.
              pending={false}
              error={null}
              failed={t('agreementTab.failed')}
              empty={t(page > 1 ? 'agreementTab.gaps.emptyPage' : 'agreementTab.gaps.empty')}
              loading={t('agreementTab.loading')}
              data="agreement-gaps"
            />
          )}
          {/* Drawn beside an empty or failed inner page too: it is the only way back from one. */}
          {((shown && showsPager(total, AGREEMENT_PAGE_SIZE)) || page > 1) && (
            <div className="overflow-hidden rounded-md border border-border/60">
              <GridPager page={page} pageSize={AGREEMENT_PAGE_SIZE} totalMatches={total} busy={agreement.isPlaceholderData} onPage={setPage} />
            </div>
          )}
        </section>
      )}
      {rechecking !== null && (
        <ReasonDialog
          open
          title={t('agreementTab.recheck.title', { day: fsi(rechecking), code: fsi(code) })}
          codes={[code]}
          note={t('agreementTab.recheck.note')}
          busy={recheck.isPending}
          error={recheck.error}
          codeLabel={recheckRefusalLabel}
          confirmLabel={t('agreementTab.recheck.action')}
          onConfirm={(reason) => recheck.mutate({ day: rechecking, reason })}
          onClose={close}
        />
      )}
    </div>
  )
}

/**
 * The judged days, in the door's order (newest first) — never re-sorted here. A day's
 * button narrows the gaps to it (pressing the picked day again goes back to every day).
 */
function DaysTable({
  days,
  picked,
  canOperate,
  onPick,
  onRecheck,
}: {
  days: readonly AgreementDay[]
  picked: string | null
  canOperate: boolean
  onPick: (day: string | null) => void
  onRecheck: (day: string) => void
}) {
  const { t } = useTranslation('sync-console')
  const col = (k: string) => t(`agreementTab.days.columns.${k}`)
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{t('agreementTab.days.title')}</h3>
      <div className="overflow-x-auto rounded-md border border-border/60">
        <table className="w-full text-sm" aria-label={t('agreementTab.days.label')} data-agreement-days="">
          <thead className="bg-muted/40 text-xs text-muted-foreground">
            <tr>
              <th className={`${TH} text-start`}>{col('businessDay')}</th>
              <th className={`${TH} text-start`}>{col('verdict')}</th>
              {[...COUNTS, ...TOTALS, ...GAPS].map((k) => (
                <th key={k} className={`${TH} text-end`}>
                  {col(k)}
                </th>
              ))}
              <th className={`${TH} text-start`}>{col('judgedAt')}</th>
              {canOperate && <th className={`${TH} text-start`}>{col('recheck')}</th>}
            </tr>
          </thead>
          <tbody>
            {days.map((d) => {
              const on = d.businessDay === picked
              return (
                <tr
                  key={d.businessDay}
                  className={'border-t border-border/60 ' + (on ? 'bg-muted' : '')}
                  data-agreement-day={d.businessDay}
                  data-agrees={String(d.agrees)}
                >
                  <td className={TD}>
                    <button
                      type="button"
                      onClick={() => onPick(on ? null : d.businessDay)}
                      aria-pressed={on}
                      title={t('agreementTab.days.pick')}
                      className="font-mono font-medium text-primary underline-offset-2 hover:underline"
                      data-agreement-pick={d.businessDay}
                    >
                      <Ltr>{d.businessDay}</Ltr>
                    </button>
                  </td>
                  <td className={TD}>
                    <CodeBadgeView badge={agreementBadge(dayVerdict(d))} code={dayVerdict(d)} />
                  </td>
                  {COUNTS.map((k) => (
                    <td key={k} className={`${TD} text-end font-mono tabular-nums`} data-day-figure={k}>
                      <Ltr>{figure(d[k])}</Ltr>
                    </td>
                  ))}
                  {TOTALS.map((k) => (
                    <td key={k} className={`${TD} text-end font-mono tabular-nums`} data-day-figure={k}>
                      <Ltr>{formatMoney3(d[k])}</Ltr>
                    </td>
                  ))}
                  {GAPS.map((k) => (
                    <td
                      key={k}
                      className={`${TD} text-end font-mono tabular-nums ` + (d[k] > 0 ? 'text-danger-800' : '')}
                      data-day-figure={k}
                    >
                      <Ltr>{figure(d[k])}</Ltr>
                    </td>
                  ))}
                  <td className={`${TD} text-muted-foreground`}>
                    <Ltr>{formatDateTime(d.judgedAt)}</Ltr>
                  </td>
                  {canOperate && (
                    <td className={TD}>
                      <Button variant="secondary" onClick={() => onRecheck(d.businessDay)} data-agreement-recheck={d.businessDay}>
                        {t('agreementTab.recheck.action')}
                      </Button>
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}

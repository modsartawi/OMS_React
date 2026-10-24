import { useEffect, useRef, useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Trans, useTranslation } from 'react-i18next'
import { ArrowLeft, Loader2, RotateCcw, Search } from 'lucide-react'
import { apiErrorCode, apiErrorMessage } from '@/core/api'
import type { HungerStationSyncLine, HungerStationSyncLogRow } from '@/core/models/hungerstation'
import Button from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import GridPager from '@/core/ui/GridPager'
import Ltr from '@/core/ui/Ltr'
import { showsPager } from '@/core/ui/pager'
import { TD, TH } from '@/core/ui/sheet-table'
import { formatDateTime } from '@/core/util/date-format'
import { formatRange, fsi } from '@/core/util/bidi'
import { storesApi, syncLinesKey } from './api'
import { LineCells, PushStatus, PushType } from './PushCells'
import { LINES_TAKE, type LinesFilter, expiredNotice, figure, historyRefusal, linesNotice, linesQuery } from './sync-history'

const FIELD = 'flex flex-col gap-1 text-xs font-medium text-muted-foreground'
const INPUT =
  'h-8 w-44 rounded-md border border-border/60 bg-background px-2 font-mono text-sm text-foreground focus:border-primary/50 focus:outline-none'

const NO_FILTER: LinesFilter = { material: '', page: 1 }

/**
 * **One push's lines** (ticket 554; contract `GET Sync/{store}/Logs/{logId}/Lines`) — material
 * number, active, quantity, maximum sales quantity, price (3 decimals with its currency) and sent
 * at, ordered by material number; filtered by material number (exact match), 200 a page. A value
 * the push did not send is blank, never zero; an inactive line is marked.
 *
 * DHS-00015 (the push is gone, or older than the 15 days kept) says so in words — never an empty
 * table that reads as "nothing was sent". Its Back button takes focus when it opens.
 */
export default function PushLines({ storeCode, push, onBack }: { storeCode: string; push: HungerStationSyncLogRow; onBack: () => void }) {
  const { t } = useTranslation('hungerstation-stores')
  const root = useRef<HTMLDivElement>(null)
  const [draft, setDraft] = useState('')
  const [filter, setFilter] = useState<LinesFilter>(NO_FILTER)
  const query = linesQuery(filter)
  const lines = useQuery({
    queryKey: syncLinesKey(storeCode, push.logId, query),
    // The answer carries the page it was read for: while the next page loads, the previous page
    // stays drawn (keepPreviousData) and its caption and pager still name THAT page.
    queryFn: async () => ({ ...(await storesApi.syncLines(storeCode, push.logId, query)), page: filter.page, skip: query.skip }),
    retry: false,
    placeholderData: keepPreviousData,
  })
  useEffect(() => root.current?.querySelector<HTMLButtonElement>('[data-lines-back]')?.focus(), [])

  const expired = lines.isError && historyRefusal(apiErrorCode(lines.error)) === 'expired'
  const notice = lines.data && !lines.isPlaceholderData ? linesNotice({ total: lines.data.total, filtered: query.material !== null }) : null
  const exp = expiredNotice()

  return (
    <div ref={root} className="flex flex-col gap-3" data-push-lines={push.logId}>
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="ghost" onClick={onBack} data-lines-back="">
          <ArrowLeft className="h-3.5 w-3.5 rtl:rotate-180" aria-hidden />
          {t('lines.back')}
        </Button>
        <span className="text-xs text-muted-foreground">{t('lines.eyebrow')}</span>
        <span className="flex items-center gap-2 text-sm font-medium" data-lines-push="">
          <PushType syncType={push.syncType} /> <Ltr>{formatDateTime(push.startTime)}</Ltr>
          <PushStatus push={push} />
        </span>
      </div>
      <p className="text-xs text-muted-foreground">{t('lines.hint', { days: fsi(exp.days) })}</p>

      {expired ? (
        <p role="status" className="rounded-md border border-border/60 bg-card-2 px-3 py-2 text-sm text-muted-foreground" data-lines-notice="expired">
          {t(exp.key, { days: fsi(exp.days) })}
        </p>
      ) : (
        <>
          <form
            className="flex flex-wrap items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              setFilter({ material: draft, page: 1 })
            }}
            data-lines-filters=""
          >
            <label className={FIELD}>
              {t('lines.filters.material')}
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder={t('lines.filters.materialPlaceholder')}
                className={INPUT}
                dir="ltr"
                data-lines-material=""
              />
            </label>
            <Button type="submit" className="h-8" disabled={lines.isFetching} data-lines-apply="">
              <Search className="h-3.5 w-3.5" aria-hidden />
              {t('lines.filters.apply')}
            </Button>
            <Button
              variant="outlined"
              className="h-8"
              onClick={() => {
                setDraft('')
                setFilter(NO_FILTER)
              }}
              data-lines-clear=""
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden />
              {t('lines.filters.clear')}
            </Button>
          </form>

          {lines.isPending ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground" data-lines-loading="">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              {t('lines.loading')}
            </p>
          ) : lines.isError ? (
            <div data-lines-error={apiErrorCode(lines.error) ?? ''}>
              <ErrorBanner className="p-3" title={t('lines.failed')} message={apiErrorMessage(lines.error, t('dialog.failedHint'))} />
            </div>
          ) : notice ? (
            <p className="text-sm text-muted-foreground" data-lines-notice={notice}>
              {t(`lines.${notice}`)}
            </p>
          ) : (
            <div className={'flex flex-col gap-1 ' + (lines.isPlaceholderData ? 'opacity-60' : '')} data-lines-stale={lines.isPlaceholderData ? '' : undefined}>
              <p className="text-xs text-muted-foreground" data-lines-showing="">
                <Trans
                  t={t}
                  i18nKey="lines.showing"
                  values={{
                    range: formatRange(figure(lines.data.skip + 1), figure(lines.data.skip + lines.data.lines.length)),
                    total: figure(lines.data.total),
                  }}
                  components={{ range: <Ltr />, total: <Ltr /> }}
                />
              </p>
              <table className="w-full border-collapse text-xs" data-lines-table="">
                <thead className="border-b border-border/60 text-muted-foreground">
                  <tr>
                    <th className={TH}>{t('lines.columns.material')}</th>
                    <th className={TH}>{t('lines.columns.active')}</th>
                    <th className={TH + ' text-end'}>{t('lines.columns.quantity')}</th>
                    <th className={TH + ' text-end'}>{t('lines.columns.maximumSalesQuantity')}</th>
                    <th className={TH + ' text-end'}>{t('lines.columns.price')}</th>
                    <th className={TH}>{t('lines.columns.sentAt')}</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.data.lines.map((line, i) => (
                    <LineRow key={`${line.materialNumber}|${i}`} line={line} />
                  ))}
                </tbody>
              </table>
              {showsPager(lines.data.total, LINES_TAKE) && (
                <div data-lines-pager="">
                  <GridPager
                    page={lines.data.page}
                    pageSize={LINES_TAKE}
                    totalMatches={lines.data.total}
                    busy={lines.isFetching}
                    onPage={(page) => setFilter((f) => ({ ...f, page }))}
                  />
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}

/** One line: an inactive line's row is amber. */
function LineRow({ line }: { line: HungerStationSyncLine }) {
  const inactive = line.active === false
  return (
    <tr className={'border-b border-border/40 ' + (inactive ? 'bg-attention-050' : '')} data-line={line.materialNumber} data-line-inactive={inactive ? '' : undefined}>
      <td className={TD + ' font-mono'} data-line-material="">
        <Ltr>{line.materialNumber}</Ltr>
      </td>
      <LineCells line={line} />
      <td className={TD} data-line-sent-at="">
        <Ltr>{formatDateTime(line.sentAt)}</Ltr>
      </td>
    </tr>
  )
}

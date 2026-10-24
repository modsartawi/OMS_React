import { useEffect, useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Trans, useTranslation } from 'react-i18next'
import { ArrowLeft, Loader2, RotateCcw, Search } from 'lucide-react'
import { apiErrorCode, apiErrorMessage } from '@/core/api'
import type { DeliverectSyncLine, DeliverectSyncLogRow } from '@/core/models/deliverect'
import Button from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import GridPager from '@/core/ui/GridPager'
import Ltr from '@/core/ui/Ltr'
import StatusBadge from '@/core/ui/StatusBadge'
import { showsPager } from '@/core/ui/pager'
import { formatDateTime } from '@/core/util/date-format'
import { formatRange, fsi } from '@/core/util/bidi'
import { storesApi, syncLinesKey } from './api'
import { syncTypeKey } from './sync-health'
import { LINES_KEPT_DAYS, SYNC_LINES_TAKE, type LinesFilter, linesNotice, linesQuery, platformChoices, pushOutcome, readLine } from './sync-lines'

/** The number a sentence names, grouped as figures are drawn across the app. */
const figure = (n: number) => n.toLocaleString('en-US')

const TH = 'px-2 py-1.5 text-start font-medium whitespace-nowrap'
const TD = 'px-2 py-1.5 align-top whitespace-nowrap'
const FIELD = 'flex flex-col gap-1 text-xs font-medium text-muted-foreground'
const INPUT =
  'h-8 rounded-md border border-border/60 bg-background px-2 text-sm text-foreground focus:border-primary/50 focus:outline-none'

const NO_FILTER: LinesFilter = { plu: '', platform: '', page: 1 }

/**
 * **One push's lines** (ticket 550; BackOffice 3026, contract § Stock sync lines) — every row of
 * the inventory file built for the run: PLU, platform (the base row is the location's), price,
 * stock and stock status, filtered by PLU and platform, 200 a page.
 *
 * A run outside the 15 days says so in words — never an empty table that reads as "nothing was
 * sent". When the log already says `linesKept: false`, the door is not called at all; the door's
 * own `linesKept: false` (the push expired between the two reads) reads the same. A push that did
 * not reach Deliverect says its lines were attempted, not delivered.
 */
export default function PushLines({ storeCode, log, onBack }: { storeCode: string; log: DeliverectSyncLogRow; onBack: () => void }) {
  const { t } = useTranslation('deliverect-stores')
  const [draft, setDraft] = useState({ plu: '', platform: '' })
  const [filter, setFilter] = useState<LinesFilter>(NO_FILTER)
  const [seen, setSeen] = useState<string[]>([])
  const expiredOnLog = log.linesKept === false
  const query = linesQuery(filter)
  const lines = useQuery({
    queryKey: syncLinesKey(storeCode, log.logId, query),
    queryFn: () => storesApi.syncLines(storeCode, log.logId, query),
    enabled: !expiredOnLog,
    retry: false,
    placeholderData: keepPreviousData,
  })
  useEffect(() => {
    if (lines.data) setSeen((prev) => platformChoices(prev, lines.data.lines))
  }, [lines.data])
  const choices = platformChoices(seen, [], draft.platform)
  const type = syncTypeKey(log.syncType)
  const attempted = pushOutcome(log.status, log.callbackStatus) === 'attempted'
  const filtered = filter.plu.trim() !== '' || filter.platform !== ''
  const days = fsi(String(LINES_KEPT_DAYS))

  const notice = expiredOnLog
    ? 'expired'
    : lines.data
      ? linesNotice({ linesKept: lines.data.linesKept, total: lines.data.total, filtered })
      : null
  const expired = notice === 'expired'

  return (
    <div className="flex flex-col gap-3" data-push-lines={log.logId}>
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="ghost" onClick={onBack} data-lines-back="">
          <ArrowLeft className="h-3.5 w-3.5 rtl:rotate-180" aria-hidden />
          {t('lines.back')}
        </Button>
        <span className="text-xs text-muted-foreground">{t('lines.eyebrow')}</span>
        <span className="text-sm font-medium" data-lines-run="">
          {type ? t(`logs.type.${type}`) : <Ltr>{log.syncType}</Ltr>} <Ltr>{formatDateTime(log.startTime)}</Ltr>
        </span>
      </div>
      <p className="text-xs text-muted-foreground">{t('lines.hint', { days })}</p>

      {expired ? (
        <p
          role="status"
          className="rounded-md border border-border/60 bg-card-2 px-3 py-2 text-sm text-muted-foreground"
          data-lines-notice="expired"
        >
          {t('lines.expired', { days })}
        </p>
      ) : (
        <>
          {attempted && (
            <p
              role="status"
              className="rounded-md border border-danger-border bg-danger-050 px-3 py-2 text-[0.8125rem] text-danger-800"
              data-lines-attempted=""
            >
              {t('lines.attempted')}
            </p>
          )}
          <form
            className="flex flex-wrap items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              setFilter({ plu: draft.plu, platform: draft.platform, page: 1 })
            }}
            data-lines-filters=""
          >
            <label className={FIELD}>
              {t('lines.filters.plu')}
              <input
                value={draft.plu}
                onChange={(e) => setDraft((d) => ({ ...d, plu: e.target.value }))}
                placeholder={t('lines.filters.pluPlaceholder')}
                className={INPUT + ' w-40 font-mono'}
                dir="ltr"
                data-lines-plu=""
              />
            </label>
            <label className={FIELD}>
              {t('lines.filters.platform')}
              <select
                value={draft.platform}
                onChange={(e) => setDraft((d) => ({ ...d, platform: e.target.value }))}
                className={INPUT}
                data-lines-platform=""
              >
                <option value="">{t('lines.filters.allRows')}</option>
                <option value="base">{t('lines.filters.baseOnly')}</option>
                {choices.map((name) => (
                  <option key={name} value={name}>
                    {fsi(name)}
                  </option>
                ))}
              </select>
            </label>
            <Button type="submit" className="h-8" disabled={lines.isFetching} data-lines-apply="">
              <Search className="h-3.5 w-3.5" aria-hidden />
              {t('lines.filters.apply')}
            </Button>
            <Button
              variant="outlined"
              className="h-8"
              onClick={() => {
                setDraft({ plu: '', platform: '' })
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
            <div className="flex flex-col gap-1">
              <p className="text-xs text-muted-foreground" data-lines-showing="">
                <Trans
                  t={t}
                  i18nKey="lines.showing"
                  values={{
                    range: formatRange(figure(query.skip + 1), figure(query.skip + lines.data.lines.length)),
                    total: figure(lines.data.total),
                  }}
                  components={{ range: <Ltr />, total: <Ltr /> }}
                />
              </p>
              <table className="w-full border-collapse text-xs" data-lines-table="">
                <thead className="border-b border-border/60 text-muted-foreground">
                  <tr>
                    <th className={TH}>{t('lines.columns.plu')}</th>
                    <th className={TH}>{t('lines.columns.platform')}</th>
                    <th className={TH + ' text-end'}>{t('lines.columns.price')}</th>
                    <th className={TH + ' text-end'}>{t('lines.columns.stock')}</th>
                    <th className={TH}>{t('lines.columns.stockStatus')}</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.data.lines.map((line) => (
                    <LineRow key={`${line.plu}|${line.channel ?? ''}`} line={line} />
                  ))}
                </tbody>
              </table>
              {showsPager(lines.data.total, SYNC_LINES_TAKE) && (
                <div data-lines-pager="">
                  <GridPager
                    page={filter.page}
                    pageSize={SYNC_LINES_TAKE}
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

/** One line: the machine values isolated left-to-right, the platform's name as free text. */
export function LineCells({ line }: { line: DeliverectSyncLine }) {
  const { t } = useTranslation('deliverect-stores')
  const r = readLine(line)
  return (
    <>
      <td className={TD} data-line-platform="">
        {r.platform == null ? <span className="text-muted-foreground">{t('lines.base')}</span> : <bdi>{r.platform}</bdi>}
      </td>
      <td className={TD + ' text-end tabular-nums'} data-line-price="">
        {r.price == null ? <span className="text-muted-foreground">{t('lines.noPrice')}</span> : <Ltr>{r.price}</Ltr>}
      </td>
      <td className={TD + ' text-end tabular-nums'} data-line-stock="">
        {r.stock == null ? <span className="text-muted-foreground">{t('lines.noStock')}</span> : <Ltr>{r.stock}</Ltr>}
      </td>
      <td className={TD} data-line-stock-status="">
        {r.stockStatus ? (
          <StatusBadge sev={r.outOfStock ? 'warn' : 'ok'}>{t(`lines.stockStatus.${r.stockStatus}`)}</StatusBadge>
        ) : (
          <StatusBadge sev="mute">
            <Ltr>{line.stockStatus}</Ltr>
          </StatusBadge>
        )}
      </td>
    </>
  )
}

function LineRow({ line }: { line: DeliverectSyncLine }) {
  const out = readLine(line).outOfStock
  return (
    <tr
      className={'border-b border-border/40 ' + (out ? 'bg-attention-050' : '')}
      data-line={`${line.plu}|${line.channel ?? ''}`}
      data-line-out={out ? '' : undefined}
    >
      <td className={TD + ' font-mono'} data-line-plu="">
        <Ltr>{line.plu}</Ltr>
      </td>
      <LineCells line={line} />
    </tr>
  )
}

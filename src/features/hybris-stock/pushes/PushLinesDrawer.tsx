import { useId, useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Trans, useTranslation } from 'react-i18next'
import { History, Loader2, Search } from 'lucide-react'
import { apiErrorCode, apiErrorMessage } from '@/core/api'
import { HYBRIS_STOCK_ERRORS, type HybrisStockPushRow } from '@/core/models/hybris-stock'
import Button from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Field from '@/core/ui/Field'
import GridPager from '@/core/ui/GridPager'
import Input from '@/core/ui/Input'
import Ltr from '@/core/ui/Ltr'
import SideSheet from '@/core/ui/SideSheet'
import SideSheetHeader from '@/core/ui/SideSheetHeader'
import { SHEET_BODY, TD, TH } from '@/core/ui/sheet-table'
import { formatRange, fsi } from '@/core/util/bidi'
import { formatDateTime } from '@/core/util/date-format'
import { formatFigure as figure } from '@/core/util/number-format'
import { linesKey, pushesApi, type LinesQuery } from './api'
import { PushStatus, PushTarget, PushType } from './PushCells'
import { linesGone } from './push-labels'
import { LINES_PAGE_SIZE } from './pushes-query'

/**
 * **One push's lines** (spec 3447 story 45; ticket 849): every store, material and quantity sent, in
 * pages of 200, filtered by store and material. Lines are kept `lineRetentionDays`: a push the server
 * says is past that (`linesKept: false`, on the log row or on the lines answer) says its lines were swept
 * instead of reading as empty. A line's material opens its
 * history at that store (`onMaterial`).
 *
 * `push` is the row from the log when the page holds it; a push opened from a link alone has none and
 * reads its header from the lines door's answer only.
 */
export default function PushLinesDrawer({
  pushId,
  push,
  retentionDays,
  onMaterial,
  onClose,
}: {
  pushId: string
  push: HybrisStockPushRow | null
  retentionDays: number
  onMaterial: (storeCode: string, materialNumber: string) => void
  onClose: () => void
}) {
  const { t } = useTranslation('hybris-stock-pushes')
  const titleId = useId()
  const [draft, setDraft] = useState({ store: '', material: '' })
  const [query, setQuery] = useState<LinesQuery>({ store: null, material: null, page: 1 })
  // The log row says so before any read; a push opened from a link alone learns it from the lines answer.
  const rowSwept = linesGone(push)
  const lines = useQuery({
    queryKey: linesKey(pushId, query),
    queryFn: () => pushesApi.lines(pushId, query),
    placeholderData: keepPreviousData,
    enabled: !rowSwept,
    retry: false,
  })
  const swept = rowSwept || linesGone(lines.data)
  const noSuchPush = apiErrorCode(lines.error) === HYBRIS_STOCK_ERRORS.noSuchPush
  const rows = lines.data?.lines ?? []
  const total = lines.data?.total ?? 0
  const first = (query.page - 1) * LINES_PAGE_SIZE + 1
  const filtered = query.store !== null || query.material !== null

  return (
    <SideSheet onClose={onClose} width="w-[52rem]" aria-labelledby={titleId} data-lines-drawer={pushId}>
      <SideSheetHeader
        titleId={titleId}
        eyebrow={t('lines.eyebrow')}
        title={<Ltr>{pushId}</Ltr>}
        closeLabel={t('lines.close')}
        onClose={onClose}
        closeData={{ 'data-lines-close': '' }}
      />
      <div className={SHEET_BODY}>
        {push && (
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-xs" data-lines-push="">
            <dt className="text-muted-foreground">{t('columns.type')}</dt>
            <dd>
              <PushType type={push.type} />
            </dd>
            <dt className="text-muted-foreground">{t('columns.status')}</dt>
            <dd>
              <PushStatus status={push.status} statusText={push.statusText} parts={push.parts} />
            </dd>
            <dt className="text-muted-foreground">{t('columns.target')}</dt>
            <dd>
              <PushTarget target={push.target} path={push.targetPath} />
            </dd>
            {push.targetPath && (
              <>
                <dt className="text-muted-foreground">{t('lines.path')}</dt>
                <dd className="font-mono" data-lines-path="">
                  <Ltr>{push.targetPath}</Ltr>
                </dd>
              </>
            )}
            <dt className="text-muted-foreground">{t('columns.startedAt')}</dt>
            <dd>
              <Ltr>{formatDateTime(push.startedAt)}</Ltr>
            </dd>
            <dt className="text-muted-foreground">{t('columns.files')}</dt>
            <dd className="flex flex-col font-mono" data-lines-files="">
              {(push.fileNames ?? []).length === 0 ? t('lines.noFiles') : push.fileNames.map((f) => <Ltr key={f}>{f}</Ltr>)}
            </dd>
            {push.error && (
              <>
                <dt className="text-muted-foreground">{t('columns.error')}</dt>
                <dd className="text-danger-800">
                  <bdi>{push.error}</bdi>
                </dd>
              </>
            )}
            {push.reason && (
              <>
                <dt className="text-muted-foreground">{t('columns.reason')}</dt>
                <dd>
                  <bdi>{push.reason}</bdi>
                </dd>
              </>
            )}
          </dl>
        )}

        {swept ? (
          <p role="status" className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground" data-lines-swept="">
            {t('lines.swept', { days: fsi(figure(retentionDays)) })}
          </p>
        ) : (
          <>
            <form
              className="flex flex-wrap items-end gap-2"
              onSubmit={(e) => {
                e.preventDefault()
                setQuery({ store: draft.store.trim() || null, material: draft.material.trim() || null, page: 1 })
              }}
              data-lines-filters=""
            >
              <Field label={t('lines.store')}>
                <Input value={draft.store} dir="ltr" onChange={(e) => setDraft({ ...draft, store: e.target.value })} data-lines-store="" />
              </Field>
              <Field label={t('lines.material')}>
                <Input value={draft.material} dir="ltr" onChange={(e) => setDraft({ ...draft, material: e.target.value })} data-lines-material="" />
              </Field>
              <Button type="submit" variant="secondary" data-lines-search="">
                <Search className="h-3.5 w-3.5" aria-hidden />
                {t('lines.filter')}
              </Button>
            </form>

            {lines.isPending && (
              <p role="status" className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                {t('lines.loading')}
              </p>
            )}
            {lines.isError &&
              (noSuchPush ? (
                <p role="alert" className="text-xs text-muted-foreground" data-lines-no-push="">
                  {t('lines.noSuchPush', { days: fsi(figure(retentionDays)) })}
                </p>
              ) : (
                <ErrorBanner className="p-2" title={t('lines.failed')} message={apiErrorMessage(lines.error, t('results.failed'))} />
              ))}
            {lines.isSuccess && rows.length === 0 && (
              <p className="text-xs text-muted-foreground" data-lines-empty="">
                {t(filtered ? 'lines.noMatch' : 'lines.empty')}
              </p>
            )}
            {rows.length > 0 && (
              <>
                <p className="text-xs text-muted-foreground" data-lines-count="">
                  <Trans
                    t={t}
                    i18nKey="lines.showing"
                    values={{ range: formatRange(figure(first), figure(first + rows.length - 1)), total: figure(total) }}
                    components={{ range: <Ltr />, total: <Ltr /> }}
                  />
                </p>
                <table className="w-full text-xs" data-lines-table="">
                  <thead className="border-b border-border text-muted-foreground">
                    <tr>
                      <th className={TH}>{t('lines.store')}</th>
                      <th className={TH}>{t('lines.material')}</th>
                      <th className={`${TH} text-end`}>{t('lines.quantity')}</th>
                      <th className={TH} />
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((l) => (
                      <tr key={`${l.storeCode}-${l.materialNumber}`} className="border-b border-border/50" data-line={`${l.storeCode}/${l.materialNumber}`}>
                        <td className={`${TD} font-mono`}>
                          <Ltr>{l.storeCode}</Ltr>
                        </td>
                        <td className={`${TD} font-mono`}>
                          <Ltr>{l.materialNumber}</Ltr>
                        </td>
                        <td className={`${TD} text-end tabular-nums`} data-line-quantity="">
                          <Ltr>{figure(l.quantity)}</Ltr>
                        </td>
                        <td className={TD}>
                          <Button variant="text" onClick={() => onMaterial(l.storeCode, l.materialNumber)} data-line-history={`${l.storeCode}/${l.materialNumber}`}>
                            <History className="h-3.5 w-3.5" aria-hidden />
                            {t('history.button')}
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {total > LINES_PAGE_SIZE && (
                  <div data-lines-pager="">
                    <GridPager page={query.page} pageSize={LINES_PAGE_SIZE} totalMatches={total} busy={lines.isFetching} onPage={(page) => setQuery({ ...query, page })} />
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </SideSheet>
  )
}

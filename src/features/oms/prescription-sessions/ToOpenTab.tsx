import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Trans, useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { ChevronDown, ChevronRight, RotateCcw, Search } from 'lucide-react'
import { apiErrorMessage, isBareDenial } from '@/core/api'
import Button from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Ltr from '@/core/ui/Ltr'
import StatusBadge from '@/core/ui/StatusBadge'
import { useUrlQuery } from '@/core/ui/use-url-query'
import { PRESCRIPTION_SESSION_NS, wordText } from '@/core/prescription-session/words'
import { formatDateTime } from '@/core/util/date-format'
import { prescriptionSessionsApi } from './api'
import Denied from './Denied'
import { toOpenFilterFromParams, toOpenFilterToParams, toOpenGroups, toOpenRequest, type ToOpenGroup } from './to-open'
import Field from '@/core/ui/Field'
import Input from '@/core/ui/Input'

const CODE = 'font-mono text-[12px]'
const TH = 'px-3 py-2 text-start text-xs font-medium text-muted-foreground'
const TD = 'px-3 py-2 align-top'

/**
 * The To open tab (ticket 546; BackOffice spec 2994 story 70): the prescription orders no session
 * has opened yet, one folded group per store, oldest first (`./to-open`). Read only — opening a
 * session is the till's act. Grouped by store only: `byUpload` is ignored (no batch reference yet).
 */
export default function ToOpenTab() {
  const { t } = useTranslation('prescription-sessions')
  const { t: tw } = useTranslation(PRESCRIPTION_SESSION_NS)
  const { query: filter, update, changedFromOutside } = useUrlQuery(toOpenFilterFromParams, toOpenFilterToParams)
  const [store, setStore] = useState(filter.store)
  const [unfolded, setUnfolded] = useState<ReadonlySet<string>>(new Set())

  useEffect(() => {
    if (changedFromOutside()) setStore(filter.store)
  }, [filter, changedFromOutside])

  const request = toOpenRequest(filter)
  const list = useQuery({
    queryKey: ['prescription-sessions', 'toOpen', request],
    queryFn: () => prescriptionSessionsApi.toOpen(filter),
    retry: false,
  })
  const groups = useMemo(() => (list.data && !list.isError ? toOpenGroups(list.data) : []), [list.data, list.isError])

  if (isBareDenial(list.error)) return <Denied />

  const search = () => {
    // A changed store is a new query key, which fetches by itself; only an unchanged one re-reads.
    if (toOpenFilterToParams({ ...filter, store }).toString() !== toOpenFilterToParams(filter).toString())
      update((prev) => ({ ...prev, store }))
    else void list.refetch()
  }
  const reset = () => {
    setStore('')
    update(() => ({ store: '' }))
  }
  const toggle = (code: string) =>
    setUnfolded((prev) => {
      const next = new Set(prev)
      if (next.has(code)) next.delete(code)
      else next.add(code)
      return next
    })

  return (
    <div className="flex flex-col gap-3" data-ps-to-open="">
      <form
        className="flex flex-wrap items-end gap-3 rounded-lg border border-border/60 bg-card/40 p-3"
        onSubmit={(e) => {
          e.preventDefault()
          search()
        }}
        data-ps-to-open-filters=""
      >
        <Field label={t('toOpen.store')}>
          <Input
            type="text"
            value={store}
            onChange={(e) => setStore(e.target.value)}
            placeholder={t('filters.storePlaceholder')}
            className="w-28"
            data-ps-to-open-store=""
          />
        </Field>
        <div className="flex items-center gap-2">
          <Button type="submit" disabled={list.isFetching} data-ps-to-open-search="">
            <Search className="h-3.5 w-3.5" aria-hidden />
            {t('filters.search')}
          </Button>
          <Button variant="outlined" onClick={reset} data-ps-to-open-reset="">
            <RotateCcw className="h-3.5 w-3.5" aria-hidden />
            {t('filters.reset')}
          </Button>
        </div>
      </form>

      {list.isError && (
        <ErrorBanner className="p-2.5" title={t('toOpen.failedTitle')} message={apiErrorMessage(list.error, t('toOpen.failed'))} />
      )}

      {list.isPending && <p className="text-sm text-muted-foreground">{t('statusBar.loading')}</p>}

      {list.data && !list.isError && (
        <>
          <p className="text-sm font-medium" data-ps-to-open-total={list.data.total}>
            <Trans t={t} i18nKey="toOpen.total" count={list.data.total} values={{ n: String(list.data.total) }} components={{ n: <Ltr /> }} />
          </p>
          {groups.length === 0 ? (
            <p className="rounded-lg border border-border/60 bg-card/40 p-6 text-sm text-muted-foreground" data-ps-to-open-empty="">
              {t('toOpen.empty')}
            </p>
          ) : (
            <ul className="flex flex-col gap-2" data-ps-to-open-groups="">
              {groups.map((g) => (
                <StoreGroup key={g.storeCode} group={g} open={unfolded.has(g.storeCode)} onToggle={() => toggle(g.storeCode)} tw={tw} />
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  )
}

function StoreGroup({
  group: g,
  open,
  onToggle,
  tw,
}: {
  group: ToOpenGroup
  open: boolean
  onToggle: () => void
  tw: (key: string) => string
}) {
  const { t } = useTranslation('prescription-sessions')
  const panel = `ps-to-open-${g.storeCode}`
  const Chevron = open ? ChevronDown : ChevronRight
  return (
    <li className="rounded-lg border border-border/60 bg-card" data-ps-to-open-group={g.storeCode} data-ps-open={open ? 'true' : 'false'}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panel}
        onClick={onToggle}
        className="flex w-full items-center gap-3 px-3 py-2 text-start text-sm hover:bg-muted"
        data-ps-to-open-toggle={g.storeCode}
      >
        {/* The chevron mirrors under RTL so a folded group points into the reading direction. */}
        <Chevron className="h-4 w-4 shrink-0 text-muted-foreground rtl:-scale-x-100" aria-hidden />
        <span className={`${CODE} font-semibold`} data-ps-to-open-store-code="">
          <Ltr>{g.storeCode}</Ltr>
        </span>
        <span className="text-muted-foreground" data-ps-to-open-count={g.count}>
          <Trans t={t} i18nKey="toOpen.count" count={g.count} values={{ n: String(g.count) }} components={{ n: <Ltr /> }} />
        </span>
        <span className="ms-auto text-muted-foreground" data-ps-to-open-oldest={g.oldestAgeDays}>
          <Trans t={t} i18nKey="toOpen.oldest" count={g.oldestAgeDays} values={{ n: String(g.oldestAgeDays) }} components={{ n: <Ltr /> }} />
        </span>
      </button>
      {open && (
        <div id={panel} className="border-t border-border/60" data-ps-to-open-panel="">
          {g.capped && (
            <p className="bg-attention-050 px-3 py-2 text-sm text-attention-800" role="status" data-ps-to-open-capped="">
              <Trans
                t={t}
                i18nKey="toOpen.capped"
                values={{ shown: String(g.capped.shown), count: String(g.capped.count) }}
                components={{ n: <Ltr /> }}
              />
            </p>
          )}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/60">
                  <th className={TH}>{t('toOpen.columns.documentNo')}</th>
                  <th className={TH}>{t('toOpen.columns.documentType')}</th>
                  <th className={TH}>{t('toOpen.columns.source')}</th>
                  <th className={TH}>{t('toOpen.columns.patientId')}</th>
                  <th className={TH}>{t('toOpen.columns.approvalNumber')}</th>
                  <th className={TH}>{t('toOpen.columns.orderedAt')}</th>
                  <th className={`${TH} text-end`}>{t('toOpen.columns.ageDays')}</th>
                </tr>
              </thead>
              <tbody>
                {g.orders.map((o) => (
                  <tr key={o.documentNo} className="border-b border-border/40 last:border-0" data-ps-to-open-order={o.documentNo}>
                    <td className={`${TD} ${CODE}`}>
                      <Link
                        to={`/oms/document/${encodeURIComponent(o.documentNo)}`}
                        className="text-primary underline-offset-2 hover:underline"
                        data-ps-to-open-link={o.documentNo}
                      >
                        <Ltr>{o.documentNo}</Ltr>
                      </Link>
                    </td>
                    <td className={`${TD} ${CODE}`}>
                      <Ltr>{o.documentType}</Ltr>
                    </td>
                    <td className={TD}>
                      <span className="inline-flex flex-wrap items-center gap-1.5" data-ps-to-open-source={o.source.raw}>
                        <span>{o.source.key === null ? <Ltr>{o.source.raw}</Ltr> : wordText(tw, o.source)}</span>
                        {o.bulkUpload && (
                          <span data-ps-to-open-bulk="">
                            <StatusBadge sev="mute">{t('toOpen.bulkUpload')}</StatusBadge>
                          </span>
                        )}
                      </span>
                    </td>
                    <td className={`${TD} ${CODE}`}>
                      <Ltr>{o.patientId ?? ''}</Ltr>
                    </td>
                    <td className={`${TD} ${CODE}`}>
                      <Ltr>{o.approvalNumber ?? ''}</Ltr>
                    </td>
                    <td className={`${TD} tabular-nums`}>
                      <Ltr>{formatDateTime(o.orderedAt)}</Ltr>
                    </td>
                    <td className={`${TD} text-end tabular-nums`}>
                      <Ltr>{o.ageDays}</Ltr>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </li>
  )
}

import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { History } from 'lucide-react'
import { Trans, useTranslation } from 'react-i18next'

import { apiErrorMessage, isBareDenial } from '@/core/api'
import { DeniedCard, Loading, TD, TH } from '@/core/insurance-rules/parts'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Field from '@/core/ui/Field'
import GridPager from '@/core/ui/GridPager'
import Input from '@/core/ui/Input'
import Ltr from '@/core/ui/Ltr'
import { showsPager } from '@/core/ui/pager'
import { formatDateTime } from '@/core/util/date-format'
import { formatFigure } from '@/core/util/number-format'
import { generalChangesQuery, idfChangesApi } from './api'
import { actionWordKey, changeSides, entityWordKey, type IdfChange, type IdfChangeSide } from './changes'
import { changesWindowProblem, typedChangesFilter, withChangesFilter, type IdfChangesQuery, type IdfChangesTypedField } from './changes-filter'
import { changesExportFileName } from './download'
import DownloadButton from './DownloadButton'

type OnQuery = (change: (q: IdfChangesQuery) => IdfChangesQuery) => void

/**
 * The General page's Change log tab (BackOffice spec 3185, door 3194; oms ticket 650): every change to the general
 * master and the IDF groups, newest first — when, who, item or group and its key, the change, before and after, the
 * reason, and the upload it came from. Filtered by item, group, user and a window of local days (both ends counted,
 * both optional); the filter is the address (`changes-filter.ts`), and a change of it goes back to page 1. A window
 * whose `to` is before its `from` is refused here, before any read. Export downloads the filtered rows as `.xlsx`.
 *
 * Before and after are each ONE whole value (the bidi rule): an item's `IDF-IBU · 3` in an `Ltr`, a group's fields
 * in a `<bdi>`. They are two columns, so the two values never share a line whose order RTL could swap.
 */
export default function ChangeLog({ query, onQuery }: { query: IdfChangesQuery; onQuery: OnQuery }) {
  const { t } = useTranslation('insurance-idf')
  const problem = changesWindowProblem(query)
  return (
    <div className="flex flex-col gap-3 rounded-md border border-border/60 bg-card p-3" role="tabpanel" data-idf-general-changes="">
      <div className="flex items-center gap-2 text-sm font-medium">
        <History className="h-4 w-4 text-muted-foreground" aria-hidden />
        {t('general.tabs.changes')}
      </div>
      <p className="text-xs text-muted-foreground">{t('changes.lede')}</p>
      <div className="flex flex-wrap items-end justify-between gap-2">
        <ChangesFilter query={query} onQuery={onQuery} />
        <DownloadButton
          fetch={() => idfChangesApi.export(query)}
          fallbackName={changesExportFileName(query)}
          label={t('changes.export')}
          failedLabel={t('changes.exportFailed')}
          hook="data-idf-changes-export"
          disabled={problem !== null}
        />
      </div>
      {problem ? (
        <p className="rounded-md border border-attention-border bg-attention-050 p-3 text-sm text-attention-800" role="alert" data-window-problem={problem}>
          {t(`changes.filter.${problem}`)}
        </p>
      ) : (
        <ChangesTable query={query} onQuery={onQuery} />
      )}
    </div>
  )
}

/** Item, group and user are typed (applied on leaving the box, Enter leaves it); the dates apply as picked, and clear. */
function ChangesFilter({ query, onQuery }: { query: IdfChangesQuery; onQuery: OnQuery }) {
  const { t } = useTranslation('insurance-idf')
  const set = (patch: Partial<Omit<IdfChangesQuery, 'page'>>) => onQuery((q) => withChangesFilter(q, patch))
  const typed = (field: IdfChangesTypedField) => ({
    defaultValue: query[field],
    onBlur: (e: React.FocusEvent<HTMLInputElement>) => {
      const patch = typedChangesFilter(query, field, e.target.value)
      if (patch) set(patch)
    },
    onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => e.key === 'Enter' && e.currentTarget.blur(),
    dir: 'ltr' as const,
    'data-filter': field,
  })
  return (
    <fieldset className="flex flex-wrap items-end gap-2" data-idf-changes-filter="">
      <legend className="sr-only">{t('changes.filter.label')}</legend>
      <Field label={t('changes.filter.item')}>
        <Input key={`item:${query.item}`} {...typed('item')} className="w-32" />
      </Field>
      <Field label={t('changes.filter.idf')}>
        <Input key={`idf:${query.idf}`} {...typed('idf')} className="w-36" />
      </Field>
      <Field label={t('changes.filter.user')}>
        <Input key={`user:${query.user}`} {...typed('user')} className="w-32" />
      </Field>
      <Field label={t('changes.filter.from')}>
        <Input type="date" value={query.from} onChange={(e) => set({ from: e.target.value })} data-filter="from" />
      </Field>
      <Field label={t('changes.filter.to')}>
        <Input type="date" value={query.to} onChange={(e) => set({ to: e.target.value })} data-filter="to" />
      </Field>
    </fieldset>
  )
}

function ChangesTable({ query, onQuery }: { query: IdfChangesQuery; onQuery: OnQuery }) {
  const { t } = useTranslation('insurance-idf')
  const changes = useQuery({ ...generalChangesQuery(query), placeholderData: keepPreviousData })
  const filtered = Boolean(query.item || query.idf || query.user || query.from || query.to)

  if (changes.isError && isBareDenial(changes.error)) return <DeniedCard ns="insurance-idf" hook="idf-changes-denied" />
  if (changes.isError)
    return (
      <div data-idf-changes-failed="">
        <ErrorBanner message={apiErrorMessage(changes.error, t('changes.failed'))} />
      </div>
    )
  if (!changes.data) return <Loading text={t('changes.loading')} />
  const { rows, total, pageSize } = changes.data
  if (rows.length === 0)
    return (
      <p className="rounded-md border border-border/60 py-6 text-center text-sm text-muted-foreground" data-idf-changes-empty={filtered ? 'noMatch' : 'empty'}>
        {filtered ? t('changes.noMatch') : t('changes.empty')}
      </p>
    )

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs text-muted-foreground" data-idf-changes-total="">
        <Trans t={t} i18nKey="changes.total" values={{ total: formatFigure(total) }} components={{ v: <Ltr /> }} />
      </p>
      <div className="overflow-x-auto rounded-md border border-border/60">
        <table className="w-full text-sm" data-idf-changes="">
          <thead className="bg-muted/50">
            <tr>
              <th className={TH}>{t('changes.columns.at')}</th>
              <th className={TH}>{t('changes.columns.by')}</th>
              <th className={TH}>{t('changes.columns.entity')}</th>
              <th className={TH}>{t('changes.columns.key')}</th>
              <th className={TH}>{t('changes.columns.action')}</th>
              <th className={TH}>{t('changes.columns.before')}</th>
              <th className={TH}>{t('changes.columns.after')}</th>
              <th className={TH}>{t('changes.columns.reason')}</th>
              <th className={TH}>{t('changes.columns.upload')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <ChangeRow key={c.changeId} c={c} />
            ))}
          </tbody>
        </table>
        {showsPager(total, pageSize) && (
          <GridPager page={query.page} pageSize={pageSize} totalMatches={total} busy={changes.isFetching} onPage={(page) => onQuery((q) => ({ ...q, page }))} />
        )}
      </div>
    </div>
  )
}

function ChangeRow({ c }: { c: IdfChange }) {
  const { t } = useTranslation('insurance-idf')
  const entity = entityWordKey(c.entity)
  const action = actionWordKey(c.action)
  const { before, after } = changeSides(c)
  return (
    <tr className="border-t border-border/60" data-change={c.changeId} data-entity={c.entity} data-action={c.action} data-key={c.key}>
      <td className={`${TD} whitespace-nowrap`} data-col="at">
        <Ltr>{formatDateTime(c.at)}</Ltr>
      </td>
      <td className={TD} data-col="by">
        {c.by && <Ltr>{c.by}</Ltr>}
      </td>
      <td className={TD} data-col="entity">
        {entity ? t(entity) : <Ltr>{c.entity}</Ltr>}
      </td>
      <td className={TD} data-col="key">
        <Ltr>{c.key}</Ltr>
      </td>
      <td className={TD} data-col="action">
        {action ? t(action) : <Ltr>{c.action}</Ltr>}
      </td>
      <td className={TD} data-col="before">
        <Side side={before} />
      </td>
      <td className={TD} data-col="after">
        <Side side={after} />
      </td>
      <td className={TD} data-col="reason">
        {c.reason && <bdi>{c.reason}</bdi>}
      </td>
      <td className={TD} data-col="upload">
        {c.uploadId && <Ltr>{c.uploadId}</Ltr>}
      </td>
    </tr>
  )
}

/** One side as one whole value: a machine pair in an `Ltr`, a group's fields in a `<bdi>`, none in words. */
function Side({ side }: { side: IdfChangeSide | null }) {
  const { t } = useTranslation('insurance-idf')
  if (!side)
    return (
      <span className="text-xs text-muted-foreground" data-none="">
        {t('changes.none')}
      </span>
    )
  return side.machine ? <Ltr>{side.text}</Ltr> : <bdi>{side.text}</bdi>
}

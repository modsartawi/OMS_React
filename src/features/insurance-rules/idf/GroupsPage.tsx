import { useEffect, useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Trans, useTranslation } from 'react-i18next'
import { Plus } from 'lucide-react'

import { apiErrorMessage, isBareDenial } from '@/core/api'
import { DeniedCard, Loading, NUM, TD, TH } from '@/core/insurance-rules/parts'
import Button from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Field from '@/core/ui/Field'
import GridPager from '@/core/ui/GridPager'
import Input from '@/core/ui/Input'
import Ltr from '@/core/ui/Ltr'
import { showsPager } from '@/core/ui/pager'
import { useUrlQuery } from '@/core/ui/use-url-query'
import { formatFigure } from '@/core/util/number-format'
import { groupsQuery, idfGroupsApi } from './api'
import { groupsExportFileName } from './download'
import DownloadButton from './DownloadButton'
import { GroupDialog, RemoveGroupDialog } from './GroupDialog'
import GroupsImport from './GroupsImport' // 653
import { canRemoveGroup, readGroupsQuery, writeGroupsQuery, type IdfGroup, type IdfGroupsQuery } from './groups'
import { emptiedPageTarget } from './paging' // 3185 review

/**
 * Insurance rules ▸ IDF groups — `/insurance-rules/idf/groups` (BackOffice spec 3185, door 3196; oms ticket 652).
 * The IDF groups, until now kept only in the WPF: a paged list (number, description, dosage form, item count),
 * searched by number or description (`?q=&page=`, the address is the state). Add a group (number, description,
 * dosage form) or edit one (the number is fixed); Remove is offered only on a group no item points at, and a refusal
 * (the WPF may have added members since the list was read) shows its message and the count. Export saves the
 * server's `.xlsx`. The help text says the WPF IDF Import still writes groups, unchecked.
 *
 * 🚩 UNGATED until 654 adds the general-edit probe: a bare 403 on the read is "You do not have access".
 */
export default function GroupsPage() {
  const { t } = useTranslation('insurance-idf')
  const { query, update } = useUrlQuery(readGroupsQuery, writeGroupsQuery)
  const groups = useQuery({ ...groupsQuery(query), placeholderData: keepPreviousData })
  const [editing, setEditing] = useState<IdfGroup | 'new' | null>(null)
  const [removing, setRemoving] = useState<IdfGroup | null>(null)
  const denied = groups.isError && isBareDenial(groups.error)
  // 3185 review: removing the last group of the last page falls back to the new last page, never an empty one.
  const clampTo = groups.data && !groups.isPlaceholderData ? emptiedPageTarget(groups.data, query.page) : null
  useEffect(() => {
    if (clampTo !== null) update((q) => ({ ...q, page: clampTo }))
  }, [clampTo, update])

  return (
    <section className="flex h-full w-full max-w-5xl flex-col gap-4" data-idf-groups-page="">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-3xl">
          <h1 className="text-lg font-semibold tracking-tight">{t('groups.title')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('groups.lede')}</p>
          <p className="mt-1 text-xs text-muted-foreground" data-idf-groups-help="">
            {t('groups.help')}
          </p>
        </div>
        {!denied && (
          <div className="flex flex-wrap gap-2">
            {/* 652 · Export */}
            <DownloadButton
              fetch={() => idfGroupsApi.export()}
              fallbackName={groupsExportFileName()}
              label={t('groups.export')}
              failedLabel={t('groups.exportFailed')}
              hook="data-idf-groups-export"
            />
            {/* 653 · Template + Import */}
            <GroupsImport />
            <Button variant="primary" onClick={() => setEditing('new')} data-idf-group-add="">
              <Plus className="h-3.5 w-3.5" aria-hidden />
              {t('groups.add')}
            </Button>
          </div>
        )}
      </header>

      {!denied && <SearchBar query={query} onSearch={(q) => update((prev) => (q === prev.q ? prev : { q, page: 1 }))} />}

      {denied ? (
        <DeniedCard ns="insurance-idf" hook="idf-groups-denied" />
      ) : groups.isError ? (
        <ErrorBanner className="p-3" message={apiErrorMessage(groups.error, t('groups.failed'))} />
      ) : !groups.data || clampTo !== null ? (
        <Loading text={t('groups.loading')} />
      ) : (
        <GroupsTable
          rows={groups.data.rows}
          total={groups.data.total}
          pageSize={groups.data.pageSize}
          query={query}
          busy={groups.isFetching}
          onPage={(page) => update((q) => ({ ...q, page }))}
          onEdit={setEditing}
          onRemove={setRemoving}
        />
      )}

      {editing && <GroupDialog row={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
      {removing && <RemoveGroupDialog row={removing} onClose={() => setRemoving(null)} />}
    </section>
  )
}

/** The search applies on leaving the box or Enter (one write path); keyed on the address so Back resets it. */
function SearchBar({ query, onSearch }: { query: IdfGroupsQuery; onSearch: (q: string) => void }) {
  const { t } = useTranslation('insurance-idf')
  return (
    <Field label={t('groups.searchLabel')}>
      <Input
        key={`q:${query.q}`}
        className="w-72"
        defaultValue={query.q}
        placeholder={t('groups.searchPlaceholder')}
        onBlur={(e) => onSearch(e.target.value.trim())}
        onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
        data-idf-groups-search=""
      />
    </Field>
  )
}

function GroupsTable({
  rows,
  total,
  pageSize,
  query,
  busy,
  onPage,
  onEdit,
  onRemove,
}: {
  rows: IdfGroup[]
  total: number
  pageSize: number
  query: IdfGroupsQuery
  busy: boolean
  onPage: (page: number) => void
  onEdit: (g: IdfGroup) => void
  onRemove: (g: IdfGroup) => void
}) {
  const { t } = useTranslation('insurance-idf')
  if (rows.length === 0)
    return (
      <p className="rounded-md border border-border/60 py-6 text-center text-sm text-muted-foreground" data-idf-groups-empty="">
        {t('groups.empty')}
      </p>
    )
  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs text-muted-foreground" data-idf-groups-total="">
        <Trans t={t} i18nKey="groups.total" values={{ total: formatFigure(total) }} components={{ v: <Ltr /> }} />
      </p>
      <div className="overflow-x-auto rounded-md border border-border/60">
        <table className="w-full text-sm" data-idf-groups="">
          <thead className="bg-muted/50">
            <tr>
              <th className={TH}>{t('groups.columns.number')}</th>
              <th className={TH}>{t('groups.columns.description')}</th>
              <th className={TH}>{t('groups.columns.dosageForm')}</th>
              <th className={`${TH} text-end`}>{t('groups.columns.itemCount')}</th>
              <th className={`${TH} text-end`}>{t('groups.columns.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((g) => (
              <tr key={g.idfNumber} className="border-t border-border/60" data-group={g.idfNumber} data-item-count={g.itemCount}>
                <td className={`${TD} font-mono text-xs`} data-col="number">
                  <Ltr>{g.idfNumber}</Ltr>
                </td>
                <td className={TD} data-col="description">
                  <bdi>{g.description}</bdi>
                </td>
                <td className={TD} data-col="dosageForm">
                  {g.dosageForm ? <bdi>{g.dosageForm}</bdi> : null}
                </td>
                <td className={NUM} data-col="itemCount">
                  <Ltr>{formatFigure(g.itemCount)}</Ltr>
                </td>
                <td className={`${TD} text-end`}>
                  <div className="flex justify-end gap-1">
                    <Button variant="text" onClick={() => onEdit(g)} data-group-edit={g.idfNumber}>
                      {t('groups.edit')}
                    </Button>
                    {canRemoveGroup(g) && (
                      <Button variant="text" onClick={() => onRemove(g)} data-group-remove={g.idfNumber}>
                        {t('groups.remove')}
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {showsPager(total, pageSize) && <GridPager page={query.page} pageSize={pageSize} totalMatches={total} busy={busy} onPage={onPage} />}
      </div>
    </div>
  )
}

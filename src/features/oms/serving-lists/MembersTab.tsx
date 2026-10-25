import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Trans, useTranslation } from 'react-i18next'
import { AgGridReact } from 'ag-grid-react'
import { Loader2, SearchX, ShieldAlert } from 'lucide-react'

// Side-effect import: registers the AG Grid Community modules in this lazy chunk.
import '@/core/ag-grid-setup'
import { apiErrorCode, apiErrorMessage, isBareDenial } from '@/core/api'
import { SERVING_LIST_ERRORS, type ServingListMemberRow, type ServingListRow } from '@/core/models/serving-list'
import { OMS_GRID_HEADER_HEIGHT, OMS_GRID_ROW_HEIGHT, omsGridTheme } from '@/core/theme/ag-grid-theme'
import Button from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Ltr from '@/core/ui/Ltr'
import { useUrlQuery } from '@/core/ui/use-url-query'
import { formatFigure } from '@/core/util/number-format'
import { membersQuery } from './api'
import { MEMBERS_DEFAULT_COL_DEF, buildMemberColumns, type MembersGridContext } from './member-columns'
import {
  EMPTY_MEMBERS_FILTER,
  MEMBER_DUTY_OPTIONS,
  MEMBER_ENABLED_OPTIONS,
  isFilteredMembers,
  membersDoorFilter,
  membersFilterFromParams,
  membersFilterToParams,
  type MembersFilter,
} from './members-filter'
import { MemberActionsCell } from './MemberActions'
import MembersToolbar from './MembersToolbar'

/** The door has no paging; a 500-store list is one read, paged by the grid. */
const MEMBERS_PAGE_SIZE = 50

/**
 * The Members tab (oms ticket 568): `GET ServingListWeb/Lists/{id}/Members?city=&enabled=&duty=`, the
 * filters held in the URL (`./members-filter`). Every member with its duty today — read-only: the roster
 * is edited elsewhere. A deactivated list still lists its members. An unknown id (`SVL-00001`) reads "This
 * serving list does not exist" in place of the grid; a bare 403 reads "You do not have access".
 *
 * Seams: `MembersToolbar` at the filter bar's end (569), `MemberActionsCell` as the grid's actions column
 * (570), both handed `{ servingListId, list, canEdit }`.
 */
export default function MembersTab({ servingListId, list, canEdit }: { servingListId: string; list: ServingListRow | undefined; canEdit: boolean }) {
  const { t } = useTranslation('serving-lists')
  const { query: filter, update, changedFromOutside } = useUrlQuery(membersFilterFromParams, membersFilterToParams)
  const members = useQuery(membersQuery(servingListId, membersDoorFilter(filter)))
  // No actions column at all without Execute (570).
  const columns = useMemo(() => buildMemberColumns(t, { actions: canEdit ? MemberActionsCell : null }), [t, canEdit])
  const context = useMemo<MembersGridContext>(() => ({ servingListId, list, canEdit }), [servingListId, list, canEdit])

  const unknownList = members.isError && apiErrorCode(members.error) === SERVING_LIST_ERRORS.UnknownList
  const refused = members.isError && isBareDenial(members.error)

  let body: ReactNode
  if (unknownList) {
    body = (
      <div className="mx-auto my-6 max-w-md rounded-lg border border-border/60 bg-card p-6 text-center" role="alert" data-list-not-found="">
        <SearchX className="mx-auto mb-2 h-6 w-6 text-muted-foreground" aria-hidden />
        <div className="text-base font-semibold tracking-tight">{t('members.notFoundTitle')}</div>
        <p className="mt-2 text-sm text-muted-foreground">
          <Trans t={t} i18nKey="members.notFoundHint" values={{ id: servingListId }} components={{ v: <Ltr /> }} />
        </p>
      </div>
    )
  } else if (refused) {
    body = (
      <div className="mx-auto my-6 max-w-md rounded-lg border border-border/60 bg-card p-6 text-center" role="alert" data-members-denied="">
        <ShieldAlert className="mx-auto mb-2 h-6 w-6 text-muted-foreground" aria-hidden />
        <div className="text-base font-semibold tracking-tight">{t('access.deniedTitle')}</div>
        <p className="mt-2 text-sm text-muted-foreground">{t('access.deniedHint')}</p>
      </div>
    )
  } else if (members.isError) {
    body = <ErrorBanner className="p-3" message={apiErrorMessage(members.error, t('members.failed'))} />
  } else if (!members.data) {
    body = (
      <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground" role="status">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        {t('members.loading')}
      </div>
    )
  } else if (members.data.length === 0) {
    body = (
      <p className="rounded-md border border-border/60 py-6 text-center text-sm text-muted-foreground" data-members-empty={isFilteredMembers(filter) ? 'filtered' : 'list'}>
        {t(isFilteredMembers(filter) ? 'members.noMatch' : 'members.empty')}
      </p>
    )
  } else {
    const n = members.data.length
    body = (
      <div className="flex min-w-0 flex-col gap-2">
        <p className="text-xs text-muted-foreground" data-members-count={n}>
          <Trans t={t} i18nKey="members.count" count={n} values={{ n: formatFigure(n) }} components={{ v: <Ltr /> }} />
        </p>
        <div className="overflow-hidden rounded-md border border-border/60" data-members-grid="">
          <AgGridReact<ServingListMemberRow>
            theme={omsGridTheme}
            rowData={members.data}
            columnDefs={columns}
            defaultColDef={MEMBERS_DEFAULT_COL_DEF}
            context={context}
            getRowId={({ data }) => data.storeCode}
            rowHeight={OMS_GRID_ROW_HEIGHT}
            headerHeight={OMS_GRID_HEADER_HEIGHT}
            domLayout="autoHeight"
            tooltipShowDelay={500}
            animateRows={false}
            suppressColumnVirtualisation
            pagination
            paginationPageSize={MEMBERS_PAGE_SIZE}
            paginationPageSizeSelector={false}
          />
        </div>
        <p className="text-xs text-muted-foreground">{t('members.dutyReadOnly')}</p>
      </div>
    )
  }

  return (
    <div className="flex min-w-0 flex-col gap-3" data-members-tab="">
      <div className="flex flex-wrap items-end gap-2">
        <Filters filter={filter} onApply={(f) => update(() => f)} resetFromOutside={changedFromOutside} />
        <div className="ms-auto flex items-center gap-2" data-members-toolbar="">
          <MembersToolbar servingListId={servingListId} list={list} canEdit={canEdit} />
        </div>
      </div>
      {body}
    </div>
  )
}

const FIELD = 'h-8 rounded-md border border-border/60 bg-background px-2 text-sm text-foreground focus:border-primary/50 focus:outline-none'

function Filters({ filter, onApply, resetFromOutside }: { filter: MembersFilter; onApply: (f: MembersFilter) => void; resetFromOutside: () => boolean }) {
  const { t } = useTranslation('serving-lists')
  const [draft, setDraft] = useState(filter)
  useEffect(() => {
    if (resetFromOutside()) setDraft(filter)
  }, [filter, resetFromOutside])
  const label = 'flex flex-col gap-0.5 text-xs font-medium text-muted-foreground'

  return (
    <form
      className="flex flex-wrap items-end gap-2"
      onSubmit={(e) => {
        e.preventDefault()
        onApply(draft)
      }}
      data-members-filters=""
    >
      <label className={label}>
        {t('members.filters.city')}
        <input
          value={draft.city}
          onChange={(e) => setDraft((d) => ({ ...d, city: e.target.value }))}
          placeholder={t('members.filters.any')}
          dir="auto"
          className={FIELD + ' w-40'}
          data-filter="city"
        />
      </label>
      <label className={label}>
        {t('members.filters.enabled')}
        <select
          value={draft.enabled}
          onChange={(e) => setDraft((d) => ({ ...d, enabled: e.target.value as MembersFilter['enabled'] }))}
          className={FIELD}
          data-filter="enabled"
        >
          <option value="">{t('members.filters.any')}</option>
          {MEMBER_ENABLED_OPTIONS.map((o) => (
            <option key={o} value={o}>
              {t(`member.${o}`)}
            </option>
          ))}
        </select>
      </label>
      <label className={label}>
        {t('members.filters.duty')}
        <select
          value={draft.duty}
          onChange={(e) => setDraft((d) => ({ ...d, duty: e.target.value as MembersFilter['duty'] }))}
          className={FIELD}
          data-filter="duty"
        >
          <option value="">{t('members.filters.any')}</option>
          {MEMBER_DUTY_OPTIONS.map((o) => (
            <option key={o} value={o}>
              {t(`members.filters.dutyOption.${o}`)}
            </option>
          ))}
        </select>
      </label>
      <Button type="submit" variant="secondary" data-filter-apply="">
        {t('members.filters.apply')}
      </Button>
      {isFilteredMembers(filter) && (
        <Button
          type="button"
          variant="text"
          onClick={() => {
            setDraft(EMPTY_MEMBERS_FILTER)
            onApply(EMPTY_MEMBERS_FILTER)
          }}
          data-filter-clear=""
        >
          {t('members.filters.clear')}
        </Button>
      )}
    </form>
  )
}

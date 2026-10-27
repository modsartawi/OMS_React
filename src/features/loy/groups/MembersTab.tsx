import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { AgGridReact } from 'ag-grid-react'
import { ListPlus, Loader2, Plus, Search } from 'lucide-react'

// Side-effect import: registers the AG Grid Community modules in this lazy chunk.
import '@/core/ag-grid-setup'
import { apiErrorMessage } from '@/core/api'
import { loyGroupRefusal } from '@/core/loy-groups/refusal'
import type { LoyGroupMember } from '@/core/models/loy-groups'
import { notify } from '@/core/services/notify'
import { OMS_GRID_HEADER_HEIGHT, OMS_GRID_ROW_HEIGHT, omsGridTheme } from '@/core/theme/ag-grid-theme'
import Button from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import GridPager from '@/core/ui/GridPager'
import Input from '@/core/ui/Input'
import Modal from '@/core/ui/Modal'
import { clampToLastPageWhenCurrentPageEmpties, showsPager } from '@/core/ui/pager'
import { useUrlQuery } from '@/core/ui/use-url-query'
import { fsi } from '@/core/util/bidi'
import { formatNumber } from '@/core/util/number-format'
import BulkLoadDialog from './BulkLoadDialog'
import { LOY_GROUP_MEMBERS_PAGE_SIZE, loyGroupMembersKey, membersApi } from './api'
import { MEMBERS_DEFAULT_COL_DEF, buildMemberColumns } from './members-columns'
import { membersQueryFromParams, membersQueryToParams } from './members-query'
import RefusalLine from './RefusalLine'

/** Every `['loy', 'groups', …]` read — the members pages, the group (its mobile count) and the list. */
const GROUPS_PREFIX = ['loy', 'groups'] as const

/**
 * A group's Members tab (oms ticket 632; doors BackOffice 3174 `Groups/{groupId}/Members`,
 * `Groups/Members/Add`, `Groups/Members/Remove`). A server-paged grid of mobile, enrolled flag, added
 * by and added at; a search that sends what the user typed (any spelling — the server canonicalises);
 * the search and page in the URL (`?search=`, `?page=`).
 *
 * 🚩 Mobiles are shown exactly as the server returns them (canonical `9665…`), never reformatted.
 *
 * Add one and remove one (after a confirm naming the mobile) are writes: absent on a view-only grant.
 * After either, every `['loy', 'groups']` read refetches, so the group's mobile count follows.
 */
export default function MembersTab({ groupId, mobileCount, canMaintain }: { groupId: string; mobileCount: number; canMaintain: boolean }) {
  const { t, i18n } = useTranslation('loy-groups')
  const queryClient = useQueryClient()
  const { query, update } = useUrlQuery(membersQueryFromParams, membersQueryToParams)
  const [typed, setTyped] = useState(query.search)
  // Back, or a pasted link, moves the URL under the field: follow it.
  useEffect(() => setTyped(query.search), [query.search])

  const members = useQuery({
    queryKey: loyGroupMembersKey(groupId, query),
    queryFn: () => membersApi.members(groupId, query),
    // The previous page stays drawn while the next one loads; the pager goes inert meanwhile.
    placeholderData: keepPreviousData,
  })
  const rows = members.data?.rows ?? []
  const total = members.data?.total ?? 0

  // A remove can empty the last page: step back to the new last page rather than show an empty grid.
  useEffect(() => {
    if (!members.data || members.isPlaceholderData) return
    const page = clampToLastPageWhenCurrentPageEmpties({ page: query.page, rowCount: rows.length, totalMatches: total, pageSize: LOY_GROUP_MEMBERS_PAGE_SIZE })
    if (page !== query.page) update((q) => ({ ...q, page }))
  }, [members.data, members.isPlaceholderData, query.page, rows.length, total, update])

  const search = (e: FormEvent) => {
    e.preventDefault()
    const next = typed.trim()
    if (next === query.search && query.page === 1) void members.refetch()
    else update(() => ({ search: next, page: 1 }))
  }
  const clear = () => {
    setTyped('')
    update(() => ({ search: '', page: 1 }))
  }

  // ── Add one ──
  const [adding, setAdding] = useState('')
  const add = useMutation({
    mutationFn: (mobile: string) => membersApi.add({ groupId, mobile }),
    onSuccess: () => {
      setAdding('')
      void queryClient.invalidateQueries({ queryKey: GROUPS_PREFIX })
      notify.success(t('members.add.done'))
    },
  })
  const addRefusal = add.isError ? loyGroupRefusal(add.error, i18n.language, t('members.add.failed')) : null
  const submitAdd = (e: FormEvent) => {
    e.preventDefault()
    const mobile = adding.trim()
    if (mobile === '' || add.isPending) return
    add.mutate(mobile)
  }

  // ── Remove one ──
  const [removing, setRemoving] = useState<LoyGroupMember | null>(null)
  const remove = useMutation({
    mutationFn: (mobile: string) => membersApi.remove({ groupId, mobile }),
    onSuccess: () => {
      setRemoving(null)
      void queryClient.invalidateQueries({ queryKey: GROUPS_PREFIX })
      notify.success(t('members.remove.done'))
    },
  })
  const removeRefusal = remove.isError ? loyGroupRefusal(remove.error, i18n.language, t('members.remove.failed')) : null
  const askRemove = useMemo(() => (canMaintain ? (m: LoyGroupMember) => setRemoving(m) : null), [canMaintain])
  const columns = useMemo(() => buildMemberColumns(t, askRemove), [t, askRemove])

  // ── Load a list (ticket 633) ──
  const [bulkOpen, setBulkOpen] = useState(false)

  return (
    <section className="flex min-w-0 flex-col gap-2" data-loy-group-members="">
      <header className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h3 className="text-base font-semibold tracking-tight">{t('members.title')}</h3>
        <p className="text-xs text-muted-foreground" data-loy-group-mobile-count={String(mobileCount)}>
          {t('members.count', { total: fsi(formatNumber(mobileCount)) })}
        </p>
      </header>

      <div className="flex flex-wrap items-start gap-2">
        <form className="flex flex-wrap items-center gap-2" onSubmit={search} data-members-search-form="">
          <Input
            type="search"
            dir="ltr"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder={t('members.search.placeholder')}
            aria-label={t('members.search.label')}
            autoComplete="off"
            wrapperClassName="w-64"
            data-members-search=""
          />
          <Button type="submit" variant="secondary" disabled={members.isFetching} data-members-search-submit="">
            <Search className="h-3.5 w-3.5" aria-hidden />
            {t('members.search.submit')}
          </Button>
          {query.search !== '' && (
            <Button variant="text" onClick={clear} data-members-search-clear="">
              {t('members.search.clear')}
            </Button>
          )}
        </form>

        {/* The maintainer's writes: Add one, and Load a list (ticket 633). */}
        {canMaintain && (
          <div className="ms-auto flex flex-wrap items-center gap-2" data-members-actions="">
            <form className="flex flex-wrap items-center gap-2" onSubmit={submitAdd} data-members-add-form="">
              <Input
                dir="ltr"
                value={adding}
                onChange={(e) => setAdding(e.target.value)}
                placeholder={t('members.add.placeholder')}
                aria-label={t('members.add.label')}
                autoComplete="off"
                wrapperClassName="w-56"
                data-members-add-input=""
              />
              <Button type="submit" variant="primary" disabled={adding.trim() === '' || add.isPending} data-members-add-submit="">
                <Plus className="h-3.5 w-3.5" aria-hidden />
                {add.isPending ? t('members.add.saving') : t('members.add.submit')}
              </Button>
            </form>
            <Button variant="secondary" onClick={() => setBulkOpen(true)} data-members-bulk-open="">
              <ListPlus className="h-3.5 w-3.5" aria-hidden />
              {t('members.bulk.open')}
            </Button>
          </div>
        )}
      </div>

      {addRefusal && (
        <div data-members-add-refused="">
          <ErrorBanner className="p-3" title={t('members.add.refused')} message={addRefusal.message}>
            <RefusalLine code={addRefusal.code} />
          </ErrorBanner>
        </div>
      )}

      {members.isError ? (
        <ErrorBanner className="p-3" message={apiErrorMessage(members.error, t('members.failed'))} />
      ) : !members.data ? (
        <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground" role="status">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          {t('members.loading')}
        </div>
      ) : (
        <div className="overflow-hidden rounded-md border border-border/60">
          {rows.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground" data-members-empty="">
              {query.search !== '' ? t('members.emptySearch', { search: fsi(query.search) }) : t(query.page > 1 ? 'members.emptyPage' : 'members.empty')}
            </p>
          ) : (
            <div data-loy-group-members-grid="">
              <AgGridReact<LoyGroupMember>
                theme={omsGridTheme}
                rowData={rows}
                columnDefs={columns}
                defaultColDef={MEMBERS_DEFAULT_COL_DEF}
                getRowId={({ data }) => data.mobile}
                rowHeight={OMS_GRID_ROW_HEIGHT}
                headerHeight={OMS_GRID_HEADER_HEIGHT}
                domLayout="autoHeight"
                animateRows={false}
                suppressColumnVirtualisation
              />
            </div>
          )}
          {/* Drawn beside an empty inner page too, so there is always a way back. */}
          {(showsPager(total, LOY_GROUP_MEMBERS_PAGE_SIZE) || query.page > 1) && (
            <div data-members-pager="">
              <GridPager
                page={query.page}
                pageSize={LOY_GROUP_MEMBERS_PAGE_SIZE}
                totalMatches={total}
                busy={members.isFetching}
                onPage={(page) => update((q) => ({ ...q, page }))}
              />
            </div>
          )}
        </div>
      )}

      {canMaintain && bulkOpen && (
        <BulkLoadDialog
          groupId={groupId}
          onClose={() => setBulkOpen(false)}
          onLoaded={() => void queryClient.invalidateQueries({ queryKey: GROUPS_PREFIX })}
        />
      )}

      {canMaintain && (
        <Modal
          open={removing !== null}
          onClose={() => setRemoving(null)}
          title={t('members.remove.title')}
          onShow={() => remove.reset()}
          width="28rem"
          footer={
            <>
              <Button variant="text" onClick={() => setRemoving(null)}>
                {t('members.remove.cancel')}
              </Button>
              <Button
                variant="danger"
                onClick={() => removing && remove.mutate(removing.mobile)}
                disabled={remove.isPending}
                data-members-remove-confirm=""
              >
                {remove.isPending ? t('members.remove.saving') : t('members.remove.submit')}
              </Button>
            </>
          }
        >
          <div className="flex flex-col gap-3" data-members-remove-dialog="">
            {/* A `t()` sentence is a string-only sink: the whole mobile takes `fsi()`. */}
            <p className="text-sm">{removing ? t('members.remove.confirm', { mobile: fsi(removing.mobile) }) : null}</p>
            {removeRefusal && (
              <ErrorBanner className="p-3" title={t('members.remove.refused')} message={removeRefusal.message}>
                <RefusalLine code={removeRefusal.code} />
              </ErrorBanner>
            )}
          </div>
        </Modal>
      )}
    </section>
  )
}

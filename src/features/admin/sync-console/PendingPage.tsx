import { useEffect, useMemo, useState } from 'react'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Trans, useTranslation } from 'react-i18next'
import { AgGridReact } from 'ag-grid-react'
import type { RowSelectionOptions } from 'ag-grid-community'

// Side-effect import: registers the AG Grid Community modules in this lazy chunk.
import '@/core/ag-grid-setup'
import { apiErrorMessage } from '@/core/api'
import { OMS_GRID_HEADER_HEIGHT, OMS_GRID_ROW_HEIGHT, omsGridTheme } from '@/core/theme/ag-grid-theme'
import Button from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import GridPager from '@/core/ui/GridPager'
import Ltr from '@/core/ui/Ltr'
import ScreenGate from '@/core/ui/ScreenGate'
import { clampToLastPageWhenCurrentPageEmpties, showsPager } from '@/core/ui/pager'
import { notify } from '@/core/services/notify'
import { fsi } from '@/core/util/bidi'
import type { PendingStore } from '@/core/models/sync-console'
import {
  AUDIT_KEY,
  PENDING_KEY,
  PENDING_PAGE_SIZE,
  canOpenSyncConsole,
  pendingStoresQuery,
  syncConsoleAccessQuery,
  syncConsoleApi,
} from './api'
import { SELECTION_CAP } from './control-helpers'
import { CONSOLE_DEFAULT_COL_DEF } from './console-columns'
import { figure } from './helpers'
import { buildPendingColumns } from './onboard-columns'
import ConsoleNav from './ConsoleNav'
import Loading from './Loading'
import ReasonDialog from './ReasonDialog'
import { CHECKBOX_SELECTION, useCappedSelection } from './useCappedSelection'

/**
 * Sync pending (spec 444, ticket 449) — `/admin/sync/pending`: the store masters with
 * no sync location yet, paged by the door at 50, so an unfinished onboarding is never
 * forgotten.
 *
 * With `canOperate`, a row offers **Finish** (the wizard at step 2 for its code), and
 * the list a selection of up to 50 (447's one cap) for **Dismiss**, which asks for a
 * reason on the shared dialog. Without it, the list is read only: no checkbox, no
 * Finish, no Dismiss.
 */
export default function PendingPage() {
  const { t } = useTranslation('sync-console')
  return (
    <ScreenGate
      query={syncConsoleAccessQuery()}
      can={canOpenSyncConsole}
      ns="sync-console"
      title={t('pending.title')}
      subtitle={t('pending.subtitle')}
    >
      <Pending />
    </ScreenGate>
  )
}

const PENDING_SELECTION = CHECKBOX_SELECTION as RowSelectionOptions<PendingStore>
const pendingCode = (row: PendingStore) => row.code

function Pending() {
  const { t } = useTranslation('sync-console')
  const qc = useQueryClient()
  const access = useQuery(syncConsoleAccessQuery())
  const canOperate = access.data?.canOperate === true
  const [page, setPage] = useState(1)
  const pending = useQuery({ ...pendingStoresQuery(page), placeholderData: keepPreviousData })
  const columns = useMemo(() => buildPendingColumns(t, canOperate), [t, canOperate])
  const { selected, setSelected, gridProps } = useCappedSelection(pendingCode)
  const [dismissing, setDismissing] = useState<string[] | null>(null)

  // As on the Fleet table: a failed read draws none of the previous page's rows.
  const shown = pending.isError ? undefined : pending.data
  const rows = shown?.items ?? []
  const total = shown?.total ?? 0

  // A dismiss or a finished onboarding can shrink the list under an inner page.
  const settled = shown && !pending.isPlaceholderData ? shown : undefined
  useEffect(() => {
    if (!settled) return
    const last = clampToLastPageWhenCurrentPageEmpties({
      page: settled.page,
      rowCount: settled.items.length,
      totalMatches: settled.total,
      pageSize: PENDING_PAGE_SIZE,
    })
    if (last !== settled.page) setPage((p) => (p === settled.page ? last : p))
  }, [settled])

  const dismiss = useMutation({
    mutationFn: ({ codes, reason }: { codes: string[]; reason: string }) => syncConsoleApi.dismissPending({ codes, reason }),
    onSuccess: (_data, { codes }) => {
      notify.success(t('pending.dismissed', { count: codes.length, n: fsi(figure(codes.length)) }))
      setSelected([])
      void qc.invalidateQueries({ queryKey: PENDING_KEY })
      void qc.invalidateQueries({ queryKey: AUDIT_KEY })
      close()
    },
  })

  const close = () => {
    dismiss.reset()
    setDismissing(null)
  }

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <ConsoleNav />
      <p className="text-xs text-muted-foreground">{t('pending.note')}</p>

      {pending.isPending && <Loading label={t('pending.loading')} />}
      {pending.isError && <ErrorBanner className="p-3" message={apiErrorMessage(pending.error, t('pending.failed'))} />}

      {shown && (
        <div className="overflow-hidden rounded-md border border-border/60" data-pending-list="">
          {rows.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground" data-pending-empty="">
              {t(page > 1 ? 'pending.emptyPage' : 'pending.empty')}
            </p>
          ) : (
            <AgGridReact<PendingStore>
              theme={omsGridTheme}
              rowData={rows}
              columnDefs={columns}
              defaultColDef={CONSOLE_DEFAULT_COL_DEF}
              getRowId={({ data }) => data.code}
              rowHeight={OMS_GRID_ROW_HEIGHT}
              headerHeight={OMS_GRID_HEADER_HEIGHT}
              domLayout="autoHeight"
              animateRows={false}
              suppressColumnVirtualisation
              rowSelection={canOperate ? PENDING_SELECTION : undefined}
              {...gridProps}
            />
          )}
          {/* Drawn beside an empty inner page too: it is the only way back from one. */}
          {(showsPager(total, PENDING_PAGE_SIZE) || page > 1) && (
            <GridPager
              page={page}
              pageSize={PENDING_PAGE_SIZE}
              totalMatches={total}
              busy={pending.isPlaceholderData}
              onPage={setPage}
            />
          )}
        </div>
      )}

      {canOperate && (
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label={t('controls.label')} data-pending-bar="">
          <span className="text-xs text-muted-foreground" data-selection-count={selected.length}>
            {selected.length === 0 ? (
              t('selection.hint', { cap: fsi(figure(SELECTION_CAP)) })
            ) : (
              <Trans
                t={t}
                i18nKey="selection.count"
                count={selected.length}
                values={{ n: figure(selected.length) }}
                components={{ n: <Ltr /> }}
              />
            )}
          </span>
          <Button
            variant="danger-outlined"
            disabled={selected.length === 0}
            onClick={() => setDismissing(selected)}
            data-pending-dismiss=""
          >
            {t('pending.dismiss')}
          </Button>
          {selected.length > 0 && (
            <Button variant="text" onClick={() => setSelected([])} data-selection-clear="">
              {t('selection.clear')}
            </Button>
          )}
        </div>
      )}

      {dismissing && (
        <ReasonDialog
          open
          title={
            dismissing.length === 1
              ? t('dialog.titleOne', { action: t('pending.dismiss'), code: fsi(dismissing[0]) })
              : t('dialog.titleMany', { action: t('pending.dismiss'), count: dismissing.length, n: fsi(figure(dismissing.length)) })
          }
          codes={dismissing}
          note={t('pending.dismissNote')}
          busy={dismiss.isPending}
          error={dismiss.error}
          confirmLabel={t('pending.dismiss')}
          onConfirm={(reason) => dismiss.mutate({ codes: dismissing, reason })}
          onClose={close}
        />
      )}
    </div>
  )
}

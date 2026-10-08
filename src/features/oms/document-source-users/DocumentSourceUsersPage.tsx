import { useCallback, useMemo, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Trans, useTranslation } from 'react-i18next'
import { AgGridReact } from 'ag-grid-react'
import type { ColDef, GetRowIdFunc, GridApi } from 'ag-grid-community'
import { FileSpreadsheet, Search, Upload } from 'lucide-react'
// Side-effect import: registers AG Grid Community modules within this chunk.
import '@/core/ag-grid-setup'
import { OMS_GRID_HEADER_HEIGHT, OMS_GRID_ROW_HEIGHT, omsGridTheme } from '@/core/theme/ag-grid-theme'
import { OMS_GRID_BASE_COL_DEF } from '@/core/theme/grid-base'
import ScreenGate from '@/core/ui/ScreenGate'
import Button from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Ltr from '@/core/ui/Ltr'
import { apiErrorMessage } from '@/core/api'
import { notify } from '@/core/services/notify'
import { formatCount, fsi } from '@/core/util/bidi'
import { gridSheet, writeWorkbook, xlsxFileName } from '@/core/util/grid-xlsx'
import { omsAccessQuery } from '@/core/oms/api'
import { canOpenDocumentSourceUsers, omsGrants } from '@/core/oms/access'
import ImportDialog from '@/core/import/ImportDialog'
import type { ImportOkLine } from '@/core/import/parse-import'
import type { SdDocumentSourceUserModel } from '@/core/models/document-source-user'
import { documentSourceUsersApi } from './api'
import {
  SOURCE_USERS_KEY,
  SOURCE_USER_IMPORT_COLUMNS,
  sourceUserLines,
  sourceUsersQuery,
  type SourceUserImportColumn,
} from './document-source-users'
import { EXPORT_AS_TEXT, sourceUserColumns } from './columns'

/**
 * Document source users (ticket 438, spec 430 D7/D16/D20): the WPF Document source users inquiry —
 * which staff users are pinned to which document source. Every pin, loaded on open, with a text
 * filter and an xlsx export. Read and import only: there is no single-row edit (D20).
 *
 * Behind `canOpenDocumentSourceUsers` on the ONE shared OMS probe, the same predicate the menu leaf
 * reads. Import is offered only with `canImportDocumentSourceUsers`; it is the core import dialog
 * with WPF's `user ID, document source[, X]` file, posting `isDeleted`.
 * 🚩 Its doors (`SdDocumentWeb/DocumentSourceUsers` and `…/Import`, BackOffice asks BO-6 and BO-7)
 * are not built yet.
 */
export default function DocumentSourceUsersPage() {
  const { t } = useTranslation('document-source-users')
  return (
    <ScreenGate
      query={omsAccessQuery()}
      can={canOpenDocumentSourceUsers}
      ns="document-source-users"
      title={t('title')}
      subtitle={t('subtitle')}
    >
      <DocumentSourceUsers />
    </ScreenGate>
  )
}

// The user ID is the pin's key: WPF's `SdDocumentSourceUser` is keyed on it, one source per user.
const rowId: GetRowIdFunc<SdDocumentSourceUserModel> = ({ data }) => data.userId

/** A count, grouped as figures are drawn across the app. */
const figure = (n: number) => n.toLocaleString('en-US')

function DocumentSourceUsers() {
  const { t } = useTranslation('document-source-users')
  const queryClient = useQueryClient()
  const grants = omsGrants(useQuery(omsAccessQuery()).data)
  const users = useQuery(sourceUsersQuery())
  const rows = users.data
  const loading = users.isFetching
  const error = users.isError ? apiErrorMessage(users.error, t('list.failed')) : null

  const gridApi = useRef<GridApi<SdDocumentSourceUserModel> | null>(null)
  const [quick, setQuick] = useState('')
  const [importing, setImporting] = useState(false)
  // What the grid shows once the filters have narrowed it; `null` until the grid has counted these
  // rows, so the list never flashes "nothing matches" first.
  const [shown, setShown] = useState<number | null>(null)
  const total = rows?.length ?? 0

  // Adjusted while rendering, not in an effect, so a stale count is never drawn.
  const [seen, setSeen] = useState(rows)
  if (seen !== rows) {
    setSeen(rows)
    setShown(null)
  }

  const columns = useMemo(() => sourceUserColumns(t), [t])
  // The preview reads like the grid: each file column under the grid's own label.
  const importHeader = useCallback((key: SourceUserImportColumn) => t(`columns.${key}`), [t])
  const send = useCallback(
    (lines: readonly ImportOkLine<SourceUserImportColumn>[]) => documentSourceUsersApi.importLines(sourceUserLines(lines)),
    [],
  )
  const defaultColDef = useMemo<ColDef<SdDocumentSourceUserModel>>(
    () => ({ ...OMS_GRID_BASE_COL_DEF, sortable: true, resizable: true, filter: true, suppressHeaderMenuButton: true }),
    [],
  )

  /** The list as shown — its columns, its filters, its sort — through the core writer. */
  async function exportXlsx() {
    const api = gridApi.current
    if (!api) return
    try {
      const sheet = gridSheet(api, t('export.sheet'), { asText: (colId) => EXPORT_AS_TEXT.has(colId) })
      await writeWorkbook([sheet], xlsxFileName(t('export.fileName')))
      notify.success(t('export.done'), t('export.written', { count: sheet.count, n: fsi(figure(sheet.count)) }))
    } catch {
      notify.error(t('export.failed'), t('export.failedDetail'))
    }
  }

  return (
    <section className="flex min-w-0 flex-col gap-1.5" data-dsu-pane="">
      <div className="flex flex-wrap items-center gap-3">
        <div className="ms-auto flex items-center gap-2">
          <label className="relative flex items-center">
            <Search className="pointer-events-none absolute start-2.5 h-3.5 w-3.5 text-muted-foreground" aria-hidden />
            <input
              type="search"
              value={quick}
              onChange={(e) => setQuick(e.target.value)}
              placeholder={t('filter')}
              aria-label={t('filter')}
              disabled={rows === undefined}
              className="h-8 w-64 rounded-md border border-border/60 bg-background ps-8 pe-2.5 text-sm text-foreground focus:border-primary/50 focus:outline-none disabled:opacity-50"
              data-dsu-filter=""
            />
          </label>
          <Button variant="outlined" disabled={rows === undefined || loading || !shown} onClick={() => void exportXlsx()} data-dsu-export="">
            <FileSpreadsheet className="h-3.5 w-3.5" aria-hidden />
            {t('export.button')}
          </Button>
          {grants.canImportDocumentSourceUsers && (
            <Button variant="outlined" onClick={() => setImporting(true)} data-dsu-import="">
              <Upload className="h-3.5 w-3.5" aria-hidden />
              {t('importButton')}
            </Button>
          )}
        </div>
      </div>

      {error && <ErrorBanner className="p-2.5" title={rows ? t('list.reloadFailedTitle') : t('list.failedTitle')} message={error} />}

      <div className="relative h-[calc(100vh-15rem)] min-h-64" data-dsu-list="">
        <AgGridReact<SdDocumentSourceUserModel>
          theme={omsGridTheme}
          rowData={rows ?? []}
          columnDefs={columns}
          defaultColDef={defaultColDef}
          getRowId={rowId}
          quickFilterText={quick}
          onGridReady={({ api }) => {
            gridApi.current = api
          }}
          onModelUpdated={({ api }) => setShown(api.getDisplayedRowCount())}
          rowHeight={OMS_GRID_ROW_HEIGHT}
          headerHeight={OMS_GRID_HEADER_HEIGHT}
          animateRows={false}
          // Render every column, so a cell off to the side is in the DOM for find-in-page and the drive.
          suppressColumnVirtualisation
          loading={loading && rows === undefined}
          // The empty state is drawn below: AG Grid's overlay keeps the params it was shown with.
          suppressNoRowsOverlay
        />
        {/* A first load that failed is the banner's to say. */}
        {rows !== undefined && !loading && shown === 0 && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center pt-8" data-dsu-empty="">
            <span className="text-sm text-muted-foreground">{total > 0 ? t('list.noneMatch') : t('list.empty')}</span>
          </div>
        )}
      </div>

      {rows !== undefined && (
        <div
          className="flex h-7 shrink-0 items-center gap-3 overflow-hidden rounded-md border border-border bg-card-2 px-3 text-[11.5px] whitespace-nowrap text-muted-foreground"
          data-status-bar=""
        >
          {loading || shown === null ? (
            <span>{t('statusBar.loading')}</span>
          ) : (
            <span data-status-count="">
              {shown !== total ? (
                <Trans
                  t={t}
                  i18nKey="statusBar.filtered"
                  count={total}
                  values={{ n: formatCount(figure(shown), figure(total)) }}
                  components={{ n: <Ltr /> }}
                />
              ) : (
                <Trans t={t} i18nKey="statusBar.count" count={total} values={{ n: figure(total) }} components={{ n: <Ltr /> }} />
              )}
            </span>
          )}
        </div>
      )}

      {/* Mounted per import, so a reopened dialog starts empty. */}
      {importing && (
        <ImportDialog
          ns="document-source-users"
          kind="document-source-users"
          title={t('import.title')}
          format={t('import.format')}
          columns={SOURCE_USER_IMPORT_COLUMNS}
          header={importHeader}
          send={send}
          onClose={() => setImporting(false)}
          onImported={() => void queryClient.invalidateQueries({ queryKey: SOURCE_USERS_KEY })}
        />
      )}
    </section>
  )
}

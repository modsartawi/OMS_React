import { useMemo, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Trans, useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { AgGridReact } from 'ag-grid-react'
import type { ColDef, GridApi } from 'ag-grid-community'
import { FileSpreadsheet, Loader2 } from 'lucide-react'
// Side-effect import: registers AG Grid Community modules within this chunk.
import '@/core/ag-grid-setup'
import { apiErrorMessage } from '@/core/api'
import type { DispatchScorecardDrillRow, DispatchScorecardFigure, DispatchScorecardQuery } from '@/core/models/dispatch-scorecard'
import { notify } from '@/core/services/notify'
import { OMS_GRID_HEADER_HEIGHT, OMS_GRID_ROW_HEIGHT, omsGridTheme } from '@/core/theme/ag-grid-theme'
import { OMS_GRID_BASE_COL_DEF } from '@/core/theme/grid-base'
import Button from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Ltr from '@/core/ui/Ltr'
import { fsi } from '@/core/util/bidi'
import { gridSheet, writeWorkbook, xlsxFileName } from '@/core/util/grid-xlsx'
import { dispatchScorecardApi } from './api'
import { drillColumns } from './columns'
import { drillPath } from './figures'
import { refusalKey } from './range'
import Sheet from './Sheet'

const DEFAULT_COL_DEF: ColDef<DispatchScorecardDrillRow> = {
  ...OMS_GRID_BASE_COL_DEF,
  sortable: true,
  resizable: true,
  flex: 1,
  suppressHeaderMenuButton: true,
}

const RATES = new Set<string>(['ignoreRate', 'winRate', 'declineRate'])

/** What the drawer is opened on: a figure, and whose — one store's, or one person's own. */
export interface DrillTarget {
  figure: DispatchScorecardFigure
  store?: string
  staff?: string
}

/**
 * The bids behind one figure (2950 point 3): `DispatchScorecard/Drill` for the range and filters on
 * screen, narrowed to the store or the person. For a rate the rows are its denominator and "Counted"
 * marks its numerator, as the door marks them. A row opens that delivery's details (its Activity, 542).
 * Exported to `.xlsx` as shown.
 */
export default function DrillDrawer({
  query,
  target,
  onClose,
}: {
  query: DispatchScorecardQuery
  target: DrillTarget
  onClose: () => void
}) {
  const { t } = useTranslation('dispatch-scorecard')
  const navigate = useNavigate()
  const gridApi = useRef<GridApi<DispatchScorecardDrillRow> | null>(null)
  // A person's drill is their own answers across stores: the store filter is not theirs to narrow.
  const wire = useMemo(() => ({ ...query, store: target.store ?? (target.staff ? '' : query.store) }), [query, target])
  const drill = useQuery({
    queryKey: ['oms', 'dispatch-scorecard', 'drill', wire, target.figure, target.staff ?? ''],
    queryFn: () => dispatchScorecardApi.drill(wire, target.figure, target.staff ?? ''),
    retry: false,
  })
  const rate = RATES.has(target.figure)
  const columns = useMemo(() => drillColumns(t, rate), [t, rate])
  const rows = drill.data?.rows ?? []
  const figureLabel = t(`figure.${target.figure}`)
  const who = target.staff ?? target.store ?? ''

  async function exportXlsx() {
    const api = gridApi.current
    if (!api) return
    try {
      const sheet = gridSheet(api, t('export.drillSheet'), { asText: (colId) => colId === 'subjectId' || colId === 'party' })
      await writeWorkbook([sheet], xlsxFileName(t('export.drillFileName')))
      notify.success(t('export.done'), t('export.doneDetail', { count: sheet.count, n: fsi(String(sheet.count)) }))
    } catch {
      notify.error(t('export.failed'), t('export.failedDetail'))
    }
  }

  const refusal = drill.isError ? refusalKey(drill.error) : null

  return (
    <Sheet
      data-sc-drawer={target.figure}
      eyebrow={target.staff ? t('drill.eyebrowStaff') : t('drill.eyebrow')}
      title={
        <span data-sc-drawer-title="">
          {figureLabel} · <bdi>{who || t('drill.everyStore')}</bdi>
        </span>
      }
      actions={
        <Button variant="outlined" disabled={!drill.isSuccess || rows.length === 0} onClick={() => void exportXlsx()} data-sc-drawer-export="">
          <FileSpreadsheet className="h-3.5 w-3.5" aria-hidden />
          {t('export.button')}
        </Button>
      }
      onClose={onClose}
    >
      {drill.isPending ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          {t('drill.loading')}
        </p>
      ) : drill.isError ? (
        <ErrorBanner
          className="p-2.5"
          title={t('drill.failedTitle')}
          message={refusal ? t(refusal) : apiErrorMessage(drill.error, t('drill.failed'))}
        />
      ) : (
        <>
          <p className="text-xs text-muted-foreground" data-sc-drawer-count={rows.length}>
            <Trans
              t={t}
              i18nKey="drill.count"
              count={rows.length}
              values={{ n: String(rows.length), from: drill.data.from.slice(0, 10), to: drill.data.to.slice(0, 10) }}
              components={{ n: <Ltr />, from: <Ltr />, to: <Ltr /> }}
            />{' '}
            {t('drill.openHint')}
          </p>
          <div className="h-[calc(100dvh-10rem)] min-h-64" data-sc-drawer-grid="">
            <AgGridReact<DispatchScorecardDrillRow>
              theme={omsGridTheme}
              rowData={rows}
              columnDefs={columns}
              defaultColDef={DEFAULT_COL_DEF}
              onGridReady={({ api }) => {
                gridApi.current = api
              }}
              onRowClicked={({ data }) => {
                const to = data ? drillPath(data) : null
                if (to) void navigate(to)
              }}
              rowClass="cursor-pointer"
              rowHeight={OMS_GRID_ROW_HEIGHT}
              headerHeight={OMS_GRID_HEADER_HEIGHT}
              animateRows={false}
              suppressColumnVirtualisation
              noRowsOverlayComponent={NoBids}
            />
          </div>
        </>
      )}
    </Sheet>
  )
}

function NoBids() {
  const { t } = useTranslation('dispatch-scorecard')
  return <span className="text-sm text-muted-foreground">{t('drill.empty')}</span>
}

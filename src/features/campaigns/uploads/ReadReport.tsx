import { useId, useMemo, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { AgGridReact } from 'ag-grid-react'
import type { ColDef, ICellRendererParams } from 'ag-grid-community'
// Side-effect import: registers AG Grid Community modules within this chunk.
import '@/core/ag-grid-setup'
import { OMS_GRID_HEADER_HEIGHT, OMS_GRID_ROW_HEIGHT, omsGridTheme } from '@/core/theme/ag-grid-theme'
import { OMS_GRID_BASE_COL_DEF } from '@/core/theme/grid-base'
import type { RuleUploadCampaign, RuleUploadReport } from '@/core/models/rule-upload'
import Ltr from '@/core/ui/Ltr'
import StatusBadge from '@/core/ui/StatusBadge'
import type { Severity } from '@/core/ui/severity'
import { fsi } from '@/core/util/bidi'
import CampaignJsonDrawer from './CampaignJsonDrawer'
import { issueRows, issueSheets, type IssueKind, type IssueView, type ReadReportView } from './report'

/**
 * The read report (ticket 530), for both 200 outcomes: the header, the tiles, the errors and
 * warnings as one grid, and the campaigns grid whose row opens the campaign's JSON read-only.
 */
export default function ReadReport({ report, view }: { report: RuleUploadReport; view: ReadReportView }) {
  const { t } = useTranslation('campaign-uploads')
  return (
    <section className="flex flex-col gap-4" data-upload-report="">
      <h2 className="text-sm font-semibold">{t('report.title')}</h2>

      <dl className="grid grid-cols-2 gap-3 rounded-lg border border-border bg-card p-4 sm:grid-cols-4" data-upload-header="">
        <Fact k="promotion" label={t('report.promotion')}>
          <span className="font-mono font-medium">
            <Ltr>{view.promotionCode}</Ltr>
          </span>
        </Fact>
        <Fact k="stacking" label={t('report.stacking')}>
          <Ltr>{view.stacking}</Ltr>
        </Fact>
        <Fact k="note" label={t('report.note')}>
          <bdi>{view.note}</bdi>
        </Fact>
        {view.revision !== null && (
          <Fact k="revision" label={t('report.revision')}>
            <Ltr>{view.revision}</Ltr>
          </Fact>
        )}
      </dl>

      <ul className="flex flex-wrap gap-2" aria-label={t('report.tiles')} data-upload-tiles="">
        <Tile k="campaigns" label={t('report.campaigns')}>
          <Ltr>{view.campaignCount}</Ltr>
        </Tile>
        {view.mechanics.map(({ mechanic, count }) => (
          // The mechanic is the workbook's own word (a closed list HQ may grow): shown as sent.
          <Tile key={mechanic} k={`mechanic:${mechanic}`} label={<Ltr>{mechanic}</Ltr>} title={t('report.mechanicTile')}>
            <Ltr>{count}</Ltr>
          </Tile>
        ))}
        <Tile k="generated" label={t('report.generated')}>
          <Ltr>{view.generatedNames}</Ltr>
        </Tile>
        <Tile k="skus" label={t('report.skus')}>
          <Ltr>{view.skuCount}</Ltr>
        </Tile>
        <Tile k="window" label={t('report.window')}>
          {view.window ? <Ltr>{view.window}</Ltr> : <span className="text-muted-foreground">{t('report.noWindow')}</span>}
        </Tile>
        <Tile k="errors" label={t('report.errors')}>
          <Ltr>{view.errorCount}</Ltr>
        </Tile>
        <Tile k="warnings" label={t('report.warnings')}>
          <Ltr>{view.warningCount}</Ltr>
        </Tile>
      </ul>

      <Issues report={report} />
      <Campaigns campaigns={report.campaigns ?? []} />
    </section>
  )
}

export function Fact({ k, label, children }: { k: string; label: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5" data-upload-fact={k}>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm break-words">{children}</dd>
    </div>
  )
}

export function Tile({ k, label, title, children }: { k: string; label: ReactNode; title?: string; children: ReactNode }) {
  return (
    <li className="flex min-w-[7rem] flex-col gap-0.5 rounded-lg border border-border bg-card px-3 py-2" title={title} data-upload-tile={k}>
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-base font-semibold tabular-nums">{children}</span>
    </li>
  )
}

const KIND_SEV: Record<IssueKind, Severity> = { error: 'bad', warning: 'warn' }

/** Errors red, warnings amber. */
function KindCell({ data }: ICellRendererParams<IssueView>) {
  const { t } = useTranslation('campaign-uploads')
  if (!data) return null
  return (
    <span data-issue-kind={data.kind}>
      <StatusBadge sev={KIND_SEV[data.kind]}>{t(`issues.kind.${data.kind}`)}</StatusBadge>
    </span>
  )
}

/** Free text in either script (a server message, a name it quotes): isolated as such. */
function MessageCell({ value }: ICellRendererParams<IssueView, string>) {
  return <bdi>{value}</bdi>
}

const ISSUE_COL_DEF: ColDef<IssueView> = {
  ...OMS_GRID_BASE_COL_DEF,
  sortable: true,
  resizable: true,
  suppressHeaderMenuButton: true,
}

/** Errors and warnings as one grid, errors first, filterable by sheet and sortable. */
function Issues({ report }: { report: RuleUploadReport }) {
  const { t } = useTranslation('campaign-uploads')
  const selectId = useId()
  const rows = useMemo(() => issueRows(report), [report])
  const sheets = useMemo(() => issueSheets(rows), [rows])
  const [sheet, setSheet] = useState('')
  const shown = useMemo(() => (sheet ? rows.filter((r) => r.sheet === sheet) : rows), [rows, sheet])

  const columns = useMemo(
    (): ColDef<IssueView>[] => [
      // The kind sorts errors first: "error" < "warning".
      { colId: 'kind', field: 'kind', headerName: t('issues.columns.kind'), cellRenderer: KindCell, width: 110 },
      { colId: 'at', field: 'at', headerName: t('issues.columns.at'), width: 190, cellClass: 'font-mono' },
      { colId: 'sheet', field: 'sheet', headerName: t('issues.columns.sheet'), width: 120 },
      {
        colId: 'row',
        field: 'row',
        headerName: t('issues.columns.row'),
        width: 120,
        valueFormatter: ({ data, value }) => (data?.place === 'sheet' ? t('issues.wholeSheet') : String(value ?? '')),
      },
      {
        colId: 'column',
        field: 'column',
        headerName: t('issues.columns.column'),
        width: 140,
        valueFormatter: ({ data, value }) =>
          data?.place === 'sheet' ? t('issues.wholeSheet') : data?.place === 'row' ? t('issues.wholeRow') : String(value ?? ''),
      },
      { colId: 'message', field: 'message', headerName: t('issues.columns.message'), cellRenderer: MessageCell, flex: 1, minWidth: 320, wrapText: true, autoHeight: true },
    ],
    [t],
  )

  return (
    <section className="flex flex-col gap-2" data-upload-issues={rows.length}>
      <div className="flex flex-wrap items-end justify-between gap-2">
        <h3 className="text-sm font-semibold">{t('issues.title')}</h3>
        {rows.length > 0 && (
          <label htmlFor={selectId} className="flex items-center gap-2 text-xs text-muted-foreground">
            {t('issues.sheet')}
            <select
              id={selectId}
              value={sheet}
              onChange={(e) => setSheet(e.target.value)}
              className="rounded-md border border-border bg-card px-2 py-1 text-sm text-foreground"
              data-upload-sheet-filter=""
            >
              <option value="">{t('issues.allSheets')}</option>
              {sheets.map((s) => (
                <option key={s} value={s}>
                  {fsi(s)}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground" data-upload-no-issues="">
          {t('issues.none')}
        </p>
      ) : (
        <div data-upload-issues-grid="">
          <AgGridReact<IssueView>
            theme={omsGridTheme}
            rowData={shown}
            columnDefs={columns}
            defaultColDef={ISSUE_COL_DEF}
            getRowId={({ data }) => data.key}
            rowHeight={OMS_GRID_ROW_HEIGHT}
            headerHeight={OMS_GRID_HEADER_HEIGHT}
            animateRows={false}
            suppressColumnVirtualisation
            domLayout="autoHeight"
          />
        </div>
      )}
    </section>
  )
}

/** HQ generated the Arabic name: the approver must see which. */
function GeneratedCell({ data }: ICellRendererParams<RuleUploadCampaign>) {
  const { t } = useTranslation('campaign-uploads')
  if (!data?.nameArGenerated) return null
  return (
    <span data-upload-generated="">
      <StatusBadge sev="warn">{t('campaigns.generated')}</StatusBadge>
    </span>
  )
}

function ViewCell({ context, data }: ICellRendererParams<RuleUploadCampaign, unknown, CampaignsContext>) {
  const { t } = useTranslation('campaign-uploads')
  if (!data) return null
  return (
    <button
      type="button"
      onClick={(e) => {
        // The row's own click opens it too; one opening, not two.
        e.stopPropagation()
        context.open(data)
      }}
      className="font-medium text-primary hover:underline"
      data-upload-view={data.id}
    >
      {t('campaigns.view')}
    </button>
  )
}

interface CampaignsContext {
  open: (campaign: RuleUploadCampaign) => void
}

const CAMPAIGN_COL_DEF: ColDef<RuleUploadCampaign> = {
  ...OMS_GRID_BASE_COL_DEF,
  sortable: true,
  resizable: true,
  suppressHeaderMenuButton: true,
}

/** The campaigns the read composed; a row opens its JSON read-only. */
function Campaigns({ campaigns }: { campaigns: RuleUploadCampaign[] }) {
  const { t } = useTranslation('campaign-uploads')
  const [open, setOpen] = useState<RuleUploadCampaign | null>(null)
  const context = useMemo((): CampaignsContext => ({ open: setOpen }), [])
  const columns = useMemo(
    (): ColDef<RuleUploadCampaign>[] => [
      { colId: 'code', field: 'code', headerName: t('campaigns.columns.code'), width: 140, cellClass: 'font-mono' },
      { colId: 'id', field: 'id', headerName: t('campaigns.columns.id'), flex: 1, minWidth: 260, cellClass: 'font-mono' },
      { colId: 'row', field: 'row', headerName: t('campaigns.columns.row'), width: 110 },
      { colId: 'mechanic', field: 'mechanic', headerName: t('campaigns.columns.mechanic'), width: 150 },
      { colId: 'stacking', field: 'stacking', headerName: t('campaigns.columns.stacking'), width: 120 },
      { colId: 'nameAr', field: 'nameArGenerated', headerName: t('campaigns.columns.nameAr'), cellRenderer: GeneratedCell, width: 160 },
      { colId: 'json', headerName: t('campaigns.columns.json'), cellRenderer: ViewCell, width: 100, sortable: false },
    ],
    [t],
  )

  return (
    <section className="flex flex-col gap-2" data-upload-campaigns={campaigns.length}>
      <h3 className="text-sm font-semibold">{t('campaigns.title')}</h3>
      {campaigns.length === 0 ? (
        <p className="text-sm text-muted-foreground" data-upload-no-campaigns="">
          {t('campaigns.none')}
        </p>
      ) : (
        <div data-upload-campaigns-grid="">
          <AgGridReact<RuleUploadCampaign>
            theme={omsGridTheme}
            rowData={campaigns}
            columnDefs={columns}
            defaultColDef={CAMPAIGN_COL_DEF}
            context={context}
            getRowId={({ data }) => `${data.row}-${data.id}`}
            onRowClicked={({ data }) => data && setOpen(data)}
            rowClass="cursor-pointer"
            rowHeight={OMS_GRID_ROW_HEIGHT}
            headerHeight={OMS_GRID_HEADER_HEIGHT}
            animateRows={false}
            suppressColumnVirtualisation
            domLayout="autoHeight"
          />
        </div>
      )}
      {open && (
        <CampaignJsonDrawer
          id={open.id}
          eyebrow={t('json.eyebrow')}
          sides={[{ key: 'read', campaign: open.campaign, none: t('json.none') }]}
          onClose={() => setOpen(null)}
        />
      )}
    </section>
  )
}

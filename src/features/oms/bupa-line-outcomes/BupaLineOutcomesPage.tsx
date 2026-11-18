import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Trans, useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { AgGridReact } from 'ag-grid-react'
import type { ColDef, GridApi, RowClassParams, RowClickedEvent } from 'ag-grid-community'
import { ChevronDown, ChevronRight, Download, Loader2, RotateCcw, X } from 'lucide-react'
// Side-effect import: registers AG Grid Community modules within this chunk.
import '@/core/ag-grid-setup'
import { ApiError, apiErrorCode, apiErrorMessage } from '@/core/api'
import { BUPA_OUTCOME_KINDS, type BupaOutcomeDetail, type BupaOutcomeKind, type BupaOutcomeSummaryRow } from '@/core/models/bupa-line-outcome'
import { notify } from '@/core/services/notify'
import { OMS_GRID_HEADER_HEIGHT, OMS_GRID_ROW_HEIGHT, omsGridTheme } from '@/core/theme/ag-grid-theme'
import { OMS_GRID_BASE_COL_DEF } from '@/core/theme/grid-base'
import Button from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Field from '@/core/ui/Field'
import IconButton from '@/core/ui/IconButton'
import Input from '@/core/ui/Input'
import Ltr from '@/core/ui/Ltr'
import ScreenGate from '@/core/ui/ScreenGate'
import Select from '@/core/ui/Select'
import { useUrlQuery } from '@/core/ui/use-url-query'
import { formatPair } from '@/core/util/bidi'
import { formatDateTime } from '@/core/util/date-format'
import { saveBlob } from '@/core/util/download-file'
import { canViewBupaOutcomes } from './access'
import { bupaOutcomeApi, exportFileName } from './api'
import { summaryColumns, type SummaryGridRow } from './columns'
import { DEFAULT_FILTERS, MAX_MONTHS, filtersFromParams, filtersToParams, normalizeStore, outcomeQuery, resolveRange, type OutcomeFilters } from './filters'
import { actKey, kindKey, linesOf, summaryKey } from './outcomes'

/**
 * Bupa line outcomes (oms 899, BackOffice spec 3888, doors 3889–3891): every Bupa Care Connect line whose dispensed
 * item or quantity differs from what Bupa sent, over a range of placed days, so the insurance team stops opening
 * orders one by one. A summary per kind × sent × dispensed, its totals, the lines behind a row with each line's act
 * history, and the server's `.xlsx` for the same query.
 *
 * Behind `canViewBupaOutcomes` on its own key of the one permissions answer (oms 914), the predicate the menu leaf reads,
 * failing closed. No patient identity is shown: the doors carry none.
 */
export default function BupaLineOutcomesPage() {
  const { t } = useTranslation('bupa-line-outcomes')
  return (
    <ScreenGate can={canViewBupaOutcomes} ns="bupa-line-outcomes" title={t('title')} subtitle={t('subtitle')}>
      <Report />
    </ScreenGate>
  )
}

const DEFAULT_COL_DEF: ColDef = {
  ...OMS_GRID_BASE_COL_DEF,
  resizable: true,
  sortable: true,
  suppressHeaderMenuButton: true,
  wrapHeaderText: true,
  autoHeaderHeight: true,
}

function Report() {
  const { t } = useTranslation('bupa-line-outcomes')
  const { query: filters, update, changedFromOutside } = useUrlQuery(filtersFromParams, filtersToParams)
  // The store box is a draft, applied on Enter or Apply: typed into the URL on every key, each key would read.
  const [storeDraft, setStoreDraft] = useState(filters.store)
  useEffect(() => {
    if (changedFromOutside()) setStoreDraft(filters.store)
  }, [filters, changedFromOutside])

  // "Today" is read once per visit: a range defaulted at 23:59 does not slide under the reader.
  const [now] = useState(() => new Date())
  const range = useMemo(() => resolveRange(filters, now), [filters, now])
  const query = useMemo(() => (range.ok ? outcomeQuery(filters, range) : null), [filters, range])

  const read = useQuery({
    queryKey: ['oms', 'bupa-line-outcomes', 'report', query],
    queryFn: () => bupaOutcomeApi.report(query!),
    enabled: query !== null,
    retry: false,
  })
  const report = read.data
  const patch = (p: Partial<OutcomeFilters>) => update((prev) => ({ ...prev, ...p }))

  // The open summary row, by its identity: a new answer without it closes the drill-down by itself.
  const [openKey, setOpenKey] = useState<string | null>(null)
  const openRow = useMemo(
    () => (openKey && report ? (report.summary.find((r) => summaryKey(r) === openKey) ?? null) : null),
    [openKey, report],
  )
  const lines = useMemo(() => (openRow && report ? linesOf(openRow, report.details) : []), [openRow, report])
  // `getRowClass` runs only when a row is drawn, so a new open row redraws them to move the highlight.
  const gridApi = useRef<GridApi<SummaryGridRow> | null>(null)
  useEffect(() => {
    gridApi.current?.redrawRows()
  }, [openKey])

  const [exporting, setExporting] = useState(false)
  async function exportXlsx() {
    if (!query) return
    setExporting(true)
    try {
      const file = await bupaOutcomeApi.export(query)
      saveBlob(file.filename || exportFileName(query), file.blob)
    } catch (err) {
      notify.apiError(t('export.failed'), err, t('export.failed'))
    } finally {
      setExporting(false)
    }
  }

  const columns = useMemo(() => summaryColumns(t), [t])
  const totalsRow = useMemo<SummaryGridRow[]>(() => (report && report.summary.length ? [{ total: true, ...report.totals }] : []), [report])

  return (
    <div className="flex flex-col gap-3">
      <form
        className="flex flex-wrap items-end gap-3 rounded-lg border border-border/60 bg-card/40 p-3"
        onSubmit={(e) => {
          e.preventDefault()
          const store = normalizeStore(storeDraft)
          setStoreDraft(store)
          patch({ store })
        }}
        data-blo-filters=""
      >
        <Field label={t('filters.from')}>
          <Input
            type="date"
            value={filters.from || (range.ok ? range.from : '')}
            onChange={(e) => patch({ from: e.target.value, to: filters.to || (range.ok ? range.to : '') })}
            className="w-40"
            data-blo-filter="from"
          />
        </Field>
        <Field label={t('filters.to')}>
          <Input
            type="date"
            value={filters.to || (range.ok ? range.to : '')}
            onChange={(e) => patch({ to: e.target.value, from: filters.from || (range.ok ? range.from : '') })}
            className="w-40"
            data-blo-filter="to"
          />
        </Field>
        <Field label={t('filters.store')}>
          <Input
            type="text"
            value={storeDraft}
            onChange={(e) => setStoreDraft(e.target.value)}
            placeholder={t('filters.storePlaceholder')}
            className="w-40"
            data-blo-filter="store"
          />
        </Field>
        <Field label={t('filters.kind')}>
          <Select value={filters.kind} onChange={(e) => patch({ kind: e.target.value as BupaOutcomeKind | '' })} className="w-44" data-blo-filter="kind">
            <option value="">{t('filters.anyKind')}</option>
            {BUPA_OUTCOME_KINDS.map((k) => (
              <option key={k} value={k}>
                {t(`kind.${k}`)}
              </option>
            ))}
          </Select>
        </Field>
        <Button type="submit" variant="secondary" data-blo-apply="">
          {t('filters.apply')}
        </Button>
        <Button
          variant="outlined"
          onClick={() => {
            setStoreDraft('')
            update(() => DEFAULT_FILTERS)
          }}
          data-blo-reset=""
        >
          <RotateCcw className="h-3.5 w-3.5" aria-hidden />
          {t('filters.reset')}
        </Button>
        <div className="ms-auto">
          <Button
            variant="outlined"
            disabled={!query || exporting}
            aria-busy={exporting || undefined}
            onClick={() => void exportXlsx()}
            data-blo-export=""
          >
            {exporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Download className="h-3.5 w-3.5" aria-hidden />}
            {t('export.button')}
          </Button>
        </div>
        {!range.ok && (
          <p role="alert" className="basis-full text-xs text-danger-800" data-blo-problem={range.problem}>
            {range.problem === 'tooLong' ? (
              <Trans t={t} i18nKey="problem.tooLong" values={{ max: String(MAX_MONTHS) }} components={{ max: <Ltr /> }} />
            ) : (
              t(`problem.${range.problem}`)
            )}
          </p>
        )}
      </form>

      {read.isError && (
        // The door's coded refusal (a reversed or over-long range) is a business outcome, shown inline in its words.
        <div data-blo-refusal={apiErrorCode(read.error) ?? ''}>
          <ErrorBanner
            className="p-2.5"
            title={read.error instanceof ApiError && read.error.kind === 'business' ? t('report.refusedTitle') : t('report.failedTitle')}
            message={apiErrorMessage(read.error, t('report.failed'))} />
        </div>
      )}

      <div className="relative h-80 min-h-64" data-blo-summary="">
        <AgGridReact<SummaryGridRow>
          theme={omsGridTheme}
          rowData={read.isError || !range.ok ? [] : (report?.summary ?? [])}
          pinnedBottomRowData={read.isError || !range.ok ? [] : totalsRow}
          columnDefs={columns}
          defaultColDef={DEFAULT_COL_DEF}
          onGridReady={({ api }) => {
            gridApi.current = api
          }}
          onRowClicked={(e: RowClickedEvent<SummaryGridRow>) => {
            if (e.data && !e.data.total) setOpenKey(summaryKey(e.data as BupaOutcomeSummaryRow))
          }}
          getRowClass={(p: RowClassParams<SummaryGridRow>) =>
            p.data?.total ? 'font-semibold' : openKey && p.data && summaryKey(p.data as BupaOutcomeSummaryRow) === openKey ? 'cursor-pointer bg-primary/10' : 'cursor-pointer'
          }
          rowHeight={OMS_GRID_ROW_HEIGHT}
          headerHeight={OMS_GRID_HEADER_HEIGHT}
          tooltipShowDelay={400}
          animateRows={false}
          suppressColumnVirtualisation
          loading={read.isFetching && !report}
          noRowsOverlayComponent={NoRows}
          suppressNoRowsOverlay={read.isError || !range.ok}
        />
      </div>
      <p className="text-xs text-muted-foreground">{t('report.hint')}</p>

      {openRow && <Lines key={openKey} row={openRow} lines={lines} onClose={() => setOpenKey(null)} />}
    </div>
  )
}

function NoRows() {
  const { t } = useTranslation('bupa-line-outcomes')
  return <span className="text-sm text-muted-foreground">{t('report.empty')}</span>
}

/**
 * What was sent, as one value: a pair led by the code (material, else SFDA) isolated LTR once, or the free text alone
 * isolated by its own direction (Bupa's text may be Arabic).
 */
function Sent({ sent, dash }: { sent: BupaOutcomeDetail['sent'] | BupaOutcomeSummaryRow['sent']; dash: string }) {
  const code = sent.materialNumber || sent.sfdaCode
  if (code) return <Ltr>{formatPair(code, sent.text)}</Ltr>
  return <bdi>{sent.text || dash}</bdi>
}

/** A quantity and its unit, as one machine value. */
const qty = (quantity: number | null | undefined, uom: string | null | undefined) =>
  [quantity == null ? '' : String(quantity), uom ?? ''].filter(Boolean).join(' ')

const lineId = (d: BupaOutcomeDetail) => `${d.documentNo}|${d.lineNumber}`

/** The detail lines behind the open summary row; each expands to its act history. */
function Lines({ row, lines, onClose }: { row: BupaOutcomeSummaryRow; lines: BupaOutcomeDetail[]; onClose: () => void }) {
  const { t } = useTranslation('bupa-line-outcomes')
  const [open, setOpen] = useState<ReadonlySet<string>>(new Set())
  const toggle = (id: string) =>
    setOpen((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  const dash = t('dash')
  const th = 'px-2 py-1.5 text-start font-medium text-muted-foreground'
  const td = 'px-2 py-1.5 align-top'

  return (
    <section className="flex flex-col gap-2 rounded-lg border border-border/60 bg-card/40 p-3" data-blo-lines="">
      <header className="flex flex-wrap items-center gap-2">
        <h2 className="text-sm font-semibold">{t('detail.title')}</h2>
        <span className="text-xs text-muted-foreground" data-blo-lines-of="">
          {row.dispensed ? (
            <Trans
              t={t}
              i18nKey="detail.ofRowDispensed"
              values={{ kind: t(kindKey(row.kind)) }}
              components={{
                sent: <Sent sent={row.sent} dash={t('dash')} />,
                dispensed: <Ltr>{formatPair(row.dispensed.materialNumber, row.dispensed.nameEn)}</Ltr>,
              }}
            />
          ) : (
            <Trans t={t} i18nKey="detail.ofRow" values={{ kind: t(kindKey(row.kind)) }} components={{ sent: <Sent sent={row.sent} dash={t('dash')} /> }} />
          )}
        </span>
        <span className="text-xs text-muted-foreground">
          <Trans t={t} i18nKey="detail.count" values={{ count: String(lines.length) }} components={{ n: <Ltr /> }} />
        </span>
        <IconButton className="ms-auto" label={t('detail.close')} onClick={onClose} data-blo-lines-close="">
          <X className="size-3.5" aria-hidden />
        </IconButton>
      </header>
      <div className="max-h-[28rem] overflow-auto">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-card">
            <tr>
              <th className={th} aria-label={t('detail.acts')} />
              <th className={th}>{t('detail.bupaReference')}</th>
              <th className={th}>{t('detail.documentNo')}</th>
              <th className={th}>{t('detail.approvalNo')}</th>
              <th className={th}>{t('detail.placedAt')}</th>
              <th className={th}>{t('detail.store')}</th>
              <th className={th}>{t('detail.line')}</th>
              <th className={th}>{t('detail.kind')}</th>
              <th className={th}>{t('detail.sent')}</th>
              <th className={th}>{t('detail.dispensed')}</th>
            </tr>
          </thead>
          <tbody>
            {lines.length === 0 && (
              <tr>
                <td className={td} colSpan={10}>
                  {t('detail.none')}
                </td>
              </tr>
            )}
            {lines.map((d) => {
              const id = lineId(d)
              const expanded = open.has(id)
              return (
                <LineRows key={id} line={d} expanded={expanded} onToggle={() => toggle(id)} td={td} dash={dash} />
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function LineRows({
  line: d,
  expanded,
  onToggle,
  td,
  dash,
}: {
  line: BupaOutcomeDetail
  expanded: boolean
  onToggle: () => void
  td: string
  dash: string
}) {
  const { t } = useTranslation('bupa-line-outcomes')
  return (
    <>
      <tr className="border-t border-border/60" data-blo-line={`${d.documentNo}-${d.lineNumber}`}>
        <td className={td}>
          <IconButton
            size="compact"
            label={expanded ? t('detail.hideActs') : t('detail.showActs')}
            aria-expanded={expanded}
            onClick={onToggle}
            data-blo-acts-toggle=""
          >
            {expanded ? <ChevronDown className="size-3.5" aria-hidden /> : <ChevronRight className="size-3.5 rtl:rotate-180" aria-hidden />}
          </IconButton>
        </td>
        <td className={`${td} font-mono`}>
          <Ltr>{d.bupaReference || dash}</Ltr>
        </td>
        <td className={`${td} font-mono`}>
          <Link to={`/oms/document/${encodeURIComponent(d.documentNo)}`} className="text-primary hover:underline" data-blo-document={d.documentNo}>
            <Ltr>{d.documentNo}</Ltr>
          </Link>
        </td>
        <td className={`${td} font-mono`}>
          <Ltr>{d.approvalNo || dash}</Ltr>
        </td>
        <td className={td}>
          <Ltr>{formatDateTime(d.placedAt) || dash}</Ltr>
        </td>
        <td className={`${td} font-mono`}>
          <Ltr>{d.storeCode}</Ltr>
        </td>
        <td className={td}>
          <Ltr>{String(d.lineNumber)}</Ltr>
        </td>
        <td className={td} data-blo-line-kind={d.kind}>
          {t(kindKey(d.kind))}
        </td>
        <td className={td}>
          <div>
            <Sent sent={d.sent} dash={dash} />
          </div>
          <div className="text-muted-foreground">
            <Ltr>{qty(d.sent.quantity, d.sent.uom) || dash}</Ltr>
          </div>
        </td>
        <td className={td} data-blo-dispensed="">
          {d.dispensed ? (
            <>
              <div>
                <Ltr>{formatPair(d.dispensed.materialNumber, d.dispensed.sfdaCode) || dash}</Ltr>
              </div>
              <div>
                <bdi>{d.dispensed.nameEn}</bdi>
              </div>
              <div>
                <bdi>{d.dispensed.nameAr}</bdi>
              </div>
              <div className="text-muted-foreground">
                <Ltr>{qty(d.dispensed.quantity, d.dispensed.uom) || dash}</Ltr>
              </div>
            </>
          ) : (
            dash
          )}
        </td>
      </tr>
      {expanded && (
        <tr data-blo-acts={`${d.documentNo}-${d.lineNumber}`}>
          <td />
          <td colSpan={9} className="pb-2">
            <Acts line={d} dash={dash} />
          </td>
        </tr>
      )}
    </>
  )
}

/** A line's act history: act · item before → after · quantity before → after · reason · who · when. */
function Acts({ line, dash }: { line: BupaOutcomeDetail; dash: string }) {
  const { t } = useTranslation('bupa-line-outcomes')
  if (line.acts.length === 0) return <p className="text-muted-foreground">{t('detail.noActs')}</p>
  const th = 'px-2 py-1 text-start font-medium text-muted-foreground'
  const td = 'px-2 py-1'
  return (
    <table className="w-full rounded border border-border/60 bg-background text-xs">
      <thead>
        <tr>
          <th className={th}>{t('actCol.act')}</th>
          <th className={th}>{t('actCol.itemBefore')}</th>
          <th className={th}>{t('actCol.itemAfter')}</th>
          <th className={th}>{t('actCol.quantityBefore')}</th>
          <th className={th}>{t('actCol.quantityAfter')}</th>
          <th className={th}>{t('actCol.reason')}</th>
          <th className={th}>{t('actCol.user')}</th>
          <th className={th}>{t('actCol.at')}</th>
        </tr>
      </thead>
      <tbody>
        {line.acts.map((a, i) => (
          <tr key={i} className="border-t border-border/60" data-blo-act={a.act}>
            <td className={`${td} font-medium`}>{t(actKey(a.act))}</td>
            <td className={`${td} font-mono`}>
              <Ltr>{a.itemBefore || dash}</Ltr>
            </td>
            <td className={`${td} font-mono`}>
              <Ltr>{a.itemAfter || dash}</Ltr>
            </td>
            <td className={td}>
              <Ltr>{qty(a.quantityBefore, a.uomBefore) || dash}</Ltr>
            </td>
            <td className={td}>
              <Ltr>{qty(a.quantityAfter, a.uomAfter) || dash}</Ltr>
            </td>
            <td className={td}>
              <bdi>{a.reason || dash}</bdi>
            </td>
            <td className={`${td} font-mono`}>
              <Ltr>{a.user || dash}</Ltr>
            </td>
            <td className={td}>
              <Ltr>{formatDateTime(a.at) || dash}</Ltr>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

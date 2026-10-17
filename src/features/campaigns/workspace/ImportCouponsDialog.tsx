import { useId, useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Trans, useTranslation } from 'react-i18next'
import { AgGridReact } from 'ag-grid-react'
import type { ColDef, ICellRendererParams } from 'ag-grid-community'
import type { TFunction } from 'i18next'
import { Loader2, Upload } from 'lucide-react'
// Side-effect import: registers AG Grid Community modules within this chunk.
import '@/core/ag-grid-setup'
import { OMS_GRID_HEADER_HEIGHT, OMS_GRID_ROW_HEIGHT, omsGridTheme } from '@/core/theme/ag-grid-theme'
import { OMS_GRID_BASE_COL_DEF } from '@/core/theme/grid-base'
import type { RuleCampaign, RuleCouponBatch } from '@/core/models/rule-campaign'
import { ruleCampaignApi, ruleCouponsKey } from '@/core/rules/api'
import Button from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Ltr from '@/core/ui/Ltr'
import Modal from '@/core/ui/Modal'
import { fsi } from '@/core/util/bidi'
import { formatNumber } from '@/core/util/number-format'
import { MAX_BATCH } from './coupon-form'
import { importTally, importableRows, readCouponCsv, withHqCheck, type CouponCsvRow } from './coupon-csv'
import { Refusal } from './settings-ui'

/** The rows as last checked, and the text they were read from: an edit makes them stale. */
interface Checked {
  text: string
  rows: CouponCsvRow[]
  noCodeColumn: boolean
}

/**
 * Import coupons (ticket 516; the prototype's coupon Uploader): codes from a CSV file — chosen or
 * dropped — or pasted rows. The text box is the one source: a file fills it and is checked at once;
 * pasted or edited text is checked with "Check the rows". Each row is checked before anything is
 * imported — on this side for a missing code, bad characters, a repeat in the file and a code the
 * campaign has; then on HQ's import check for a code SIS.Coupons holds and an unknown member. The
 * rejected rows are shown with their reason and left out; the rest are imported as one batch, whose
 * id the page shows.
 *
 * It is open while it is mounted: the page mounts it per import, so nothing of one import is drawn in
 * the next.
 */
export default function ImportCouponsDialog({
  campaign: c,
  taken,
  onClose,
  onImported,
}: {
  campaign: RuleCampaign
  /** The codes the campaign has. */
  taken: readonly string[]
  onClose: () => void
  /** HQ took the rows: its batch, and how many rows were left out. */
  onImported: (batch: RuleCouponBatch, leftOut: number) => void
}) {
  const { t } = useTranslation('campaign-workspace')
  const queryClient = useQueryClient()
  const [text, setText] = useState('')
  const [lastChecked, setLastChecked] = useState<Checked | null>(null)
  const [fileFailed, setFileFailed] = useState(false)
  const [drag, setDrag] = useState(false)
  const fileId = useId()
  const pasteId = useId()

  const hqCheck = useMutation({
    mutationFn: (rows: CouponCsvRow[]) => ruleCampaignApi.checkCouponImport(c.id, importableRows(rows)),
  })
  const send = useMutation({
    mutationFn: (rows: ReturnType<typeof importableRows>) => ruleCampaignApi.importCoupons(c.id, rows),
    // The list is read afresh BEFORE the page hears of the batch, so "Show the codes" finds it.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ruleCouponsKey(c.id) }),
  })
  const busy = hqCheck.isPending || send.isPending

  /** Reads the text and checks it: on this side, then — when a row is still good — on HQ's door. */
  const check = (source: string) => {
    hqCheck.reset()
    send.reset()
    const read = readCouponCsv(source, taken)
    if (read.noCodeColumn || !read.rows.some((r) => !r.problem)) {
      setLastChecked({ text: source, rows: read.rows, noCodeColumn: read.noCodeColumn })
      return
    }
    setLastChecked(null)
    hqCheck.mutate(read.rows, {
      onSuccess: (answer) => setLastChecked({ text: source, rows: withHqCheck(read.rows, answer), noCodeColumn: false }),
    })
  }

  const readFile = (file: File | undefined) => {
    if (!file || busy) return
    setFileFailed(false)
    file.text().then(
      (body) => {
        setText(body)
        check(body)
      },
      () => setFileFailed(true),
    )
  }

  const edit = (value: string) => {
    setText(value)
    // Rows checked from other text are stale.
    if (lastChecked || hqCheck.isError) {
      setLastChecked(null)
      hqCheck.reset()
    }
    if (send.isError) send.reset()
  }

  // Only rows read from the text as it stands count: a check that answers after an edit is stale.
  const checked = lastChecked?.text === text ? lastChecked : null
  const rows = checked?.rows ?? []
  const tally = importTally(rows)
  const good = importableRows(rows)
  const n = (x: number) => fsi(formatNumber(x))

  const close = () => {
    if (!send.isPending) onClose()
  }
  const submit = () => {
    if (!checked || !good.length || busy) return
    send.mutate(good, { onSuccess: (batch) => onImported(batch, tally.rejected) })
  }

  const columns = useMemo(() => previewColumns(t), [t])
  const gridContext = useMemo(() => ({ t }), [t])

  return (
    <Modal
      open
      onClose={close}
      title={t('coupons.import.title')}
      width="46rem"
      footer={
        <>
          <Button variant="text" disabled={send.isPending} onClick={close}>
            {t('coupons.import.cancel')}
          </Button>
          <Button variant="primary" disabled={!checked || !good.length || busy} onClick={submit} data-coupons-import-submit="">
            {send.isPending && <Loader2 className="size-3.5 animate-spin" aria-hidden />}
            {t('coupons.import.submit', { count: good.length, n: n(good.length) })}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3" data-coupons-import="">
        <p className="text-sm text-muted-foreground">{t('coupons.import.intro', { max: n(MAX_BATCH) })}</p>

        <label
          htmlFor={fileId}
          className={
            'flex cursor-pointer flex-col items-center gap-1.5 rounded-md border border-dashed px-4 py-4 text-center text-sm transition-colors ' +
            (drag ? 'border-primary bg-primary-050' : 'border-border bg-card-2 hover:bg-accent')
          }
          onDragOver={(e) => {
            e.preventDefault()
            setDrag(true)
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDrag(false)
            readFile(e.dataTransfer.files[0])
          }}
          data-coupons-import-drop=""
        >
          <Upload className="size-4 text-muted-foreground" aria-hidden />
          <span className="font-medium">{t('coupons.import.drop')}</span>
          <input
            id={fileId}
            type="file"
            accept=".csv,.txt,text/csv,text/plain"
            className="sr-only"
            disabled={busy}
            onChange={(e) => {
              const file = e.target.files?.[0]
              e.target.value = ''
              readFile(file)
            }}
            data-coupons-import-file=""
          />
        </label>
        {fileFailed && <ErrorBanner message={t('coupons.import.fileFailed')} className="px-3 py-2" />}

        <div className="flex flex-col gap-1.5">
          <label htmlFor={pasteId} className="text-xs font-medium text-muted-foreground">
            {t('coupons.import.paste')}
          </label>
          <textarea
            id={pasteId}
            dir="ltr"
            rows={5}
            value={text}
            onChange={(e) => edit(e.target.value)}
            placeholder={t('coupons.import.pastePlaceholder')}
            className="w-full rounded-md border border-border/60 bg-background px-2.5 py-1.5 font-mono text-xs text-foreground focus:border-primary/50 focus:outline-none"
            data-coupons-import-text=""
          />
          <p className="text-xs text-muted-foreground">{t('coupons.import.format')}</p>
          <div>
            <Button variant="outlined" disabled={!text.trim() || busy || (!!checked && !send.isError)} onClick={() => check(text)} data-coupons-import-check="">
              {hqCheck.isPending && <Loader2 className="size-3.5 animate-spin" aria-hidden />}
              {t('coupons.import.check')}
            </Button>
          </div>
        </div>

        {hqCheck.isError && (
          <div data-coupons-import-check-refusal="">
            <Refusal title={t('coupons.import.checkRefusedTitle')} fallback={t('coupons.import.checkRefused')} error={hqCheck.error} />
          </div>
        )}

        {checked?.noCodeColumn && (
          <p className="text-sm text-danger-800" data-coupons-import-no-code="">
            {t('coupons.import.noCodeColumn')}
          </p>
        )}

        {checked && !checked.noCodeColumn && (
          <>
            <p className="text-sm" data-coupons-import-tally="">
              <Trans
                t={t}
                i18nKey="coupons.import.tally"
                count={tally.rows}
                values={{ rows: formatNumber(tally.rows), ok: formatNumber(tally.ok), rejected: formatNumber(tally.rejected) }}
                components={{ rows: <Ltr />, ok: <Ltr />, rejected: <Ltr /> }}
              />
            </p>
            {rows.length > 0 && (
              <div className="h-56" data-coupons-import-preview="">
                <AgGridReact<CouponCsvRow>
                  theme={omsGridTheme}
                  rowData={rows}
                  columnDefs={columns}
                  defaultColDef={DEFAULT_COL_DEF}
                  getRowId={({ data }) => String(data.line)}
                  context={gridContext}
                  rowClassRules={{ 'bg-danger-050': ({ data }) => !!data?.problem }}
                  rowHeight={OMS_GRID_ROW_HEIGHT}
                  headerHeight={OMS_GRID_HEADER_HEIGHT}
                  animateRows={false}
                  suppressColumnVirtualisation
                />
              </div>
            )}
            {tally.rejected > 0 && good.length > 0 && <p className="text-xs text-muted-foreground">{t('coupons.import.leftOut')}</p>}
          </>
        )}

        {send.isError && (
          <div data-coupons-import-refusal="">
            <Refusal title={t('coupons.import.refusedTitle')} fallback={t('coupons.import.refused')} error={send.error} />
          </div>
        )}
      </div>
    </Modal>
  )
}

const DEFAULT_COL_DEF: ColDef<CouponCsvRow> = { ...OMS_GRID_BASE_COL_DEF, sortable: false, resizable: true }

/** The row's check: Ready, or why it is left out. */
function CheckCell({ data, context }: ICellRendererParams<CouponCsvRow, unknown, { t: TFunction }>) {
  if (!data) return null
  const { t } = context
  if (!data.problem) return <span data-coupons-import-row="ok">{t('coupons.import.ready')}</span>
  return (
    <span className="text-danger-800" data-coupons-import-row={data.problem}>
      {/* A grid cell: the bound is isolated by a <bdi>, never by fsi (it would reach Ctrl+C). */}
      <Trans t={t} i18nKey={`coupons.import.problems.${data.problem}`} values={{ max: formatNumber(MAX_BATCH) }} components={{ v: <bdi dir="ltr" /> }} />
    </span>
  )
}

function previewColumns(t: TFunction): ColDef<CouponCsvRow>[] {
  return [
    { colId: 'line', field: 'line', headerName: t('coupons.import.columns.line'), width: 80 },
    { colId: 'code', field: 'code', headerName: t('coupons.import.columns.code'), cellClass: 'font-mono', width: 170 },
    { colId: 'member', field: 'member', headerName: t('coupons.import.columns.member'), valueFormatter: ({ value }) => value || t('coupons.columns.anyone'), width: 140 },
    { colId: 'check', headerName: t('coupons.import.columns.check'), cellRenderer: CheckCell, flex: 1, minWidth: 220 },
  ]
}

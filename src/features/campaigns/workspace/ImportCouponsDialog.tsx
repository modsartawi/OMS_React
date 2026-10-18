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
import type { RuleCouponBatchCreated } from '@/core/models/rule-campaign'
import { ruleCampaignApi, ruleCouponBatchesKey } from '@/core/rules/api'
import Button from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Ltr from '@/core/ui/Ltr'
import Modal from '@/core/ui/Modal'
import { fsi } from '@/core/util/bidi'
import { formatNumber } from '@/core/util/number-format'
import { MAX_BATCH, MAX_CODE, MAX_MEMBER, MAX_TEMPLATE, couponImportBody, templateProblem } from './coupon-form'
import { importCsv, importTally, readCouponCsv, type CouponCsvRow } from './coupon-csv'
import { Refusal, SETTINGS_INPUT } from './settings-ui'

/**
 * Import coupons (tickets 516, 526; the prototype's coupon Uploader): codes from a CSV file — chosen
 * or dropped — or pasted rows, as one batch under the campaign's coupon template
 * (`CouponBatches/Create`, `kind: import`). The text box is the one source; it is read as it is
 * typed: each row is checked here for a missing code, a code or member id HQ would not take, and a
 * repeat in the file, and shown with its reason. The good rows are sent as `code[,customerId]` lines.
 *
 * HQ has no pre-import check: a code SIS.Coupons already holds (`RULES_BATCH_CODE_TAKEN`) or a member
 * it does not know (`RULES_BATCH_BAD`, naming the ids) refuses the whole import, all or none, and the
 * refusal shows here verbatim with the rows kept to fix.
 *
 * It is open while it is mounted: the page mounts it per import, so nothing of one import is drawn in
 * the next.
 */
export default function ImportCouponsDialog({
  campaignId,
  templateId: suggested,
  onClose,
  onImported,
}: {
  campaignId: string
  /** The template the import starts from (the newest batch's, or ''). */
  templateId: string
  onClose: () => void
  /** HQ took the rows: its batch, and how many rows were left out. */
  onImported: (batch: RuleCouponBatchCreated, leftOut: number) => void
}) {
  const { t } = useTranslation('campaign-workspace')
  const queryClient = useQueryClient()
  const [text, setText] = useState('')
  const [templateId, setTemplateId] = useState(suggested)
  const [tried, setTried] = useState(false)
  const [fileFailed, setFileFailed] = useState(false)
  const [drag, setDrag] = useState(false)
  const fileId = useId()
  const pasteId = useId()
  const templateFieldId = useId()

  const send = useMutation({
    mutationFn: (csv: string) => ruleCampaignApi.createBatch(couponImportBody(templateId, csv)),
    // The batches are read afresh BEFORE the page hears of the batch, so "Show the codes" finds it.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ruleCouponBatchesKey(campaignId) }),
  })

  const read = useMemo(() => readCouponCsv(text), [text])
  const rows = read.rows
  const tally = importTally(rows)
  const csv = importCsv(rows)
  const n = (x: number) => fsi(formatNumber(x))
  const template = templateProblem(templateId)

  const readFile = (file: File | undefined) => {
    if (!file || send.isPending) return
    setFileFailed(false)
    file.text().then(
      (body) => {
        setText(body)
        send.reset()
      },
      () => setFileFailed(true),
    )
  }

  const edit = (value: string) => {
    setText(value)
    // A refusal was about the rows as they were sent.
    if (send.isError) send.reset()
  }

  const close = () => {
    if (!send.isPending) onClose()
  }
  const submit = () => {
    setTried(true)
    if (template || !tally.ok || send.isPending) return
    send.mutate(csv, { onSuccess: (batch) => onImported(batch, tally.rejected) })
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
          <Button variant="primary" disabled={!tally.ok || send.isPending} onClick={submit} data-coupons-import-submit="">
            {send.isPending && <Loader2 className="size-3.5 animate-spin" aria-hidden />}
            {t('coupons.import.submit', { count: tally.ok, n: n(tally.ok) })}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3" data-coupons-import="">
        <p className="text-sm text-muted-foreground">{t('coupons.import.intro', { max: n(MAX_BATCH) })}</p>

        <div className="flex flex-col gap-1">
          <label htmlFor={templateFieldId} className="text-xs font-medium text-muted-foreground">
            {t('coupons.create.template')}
          </label>
          <input
            id={templateFieldId}
            dir="ltr"
            value={templateId}
            onChange={(e) => {
              setTemplateId(e.target.value)
              if (send.isError) send.reset()
            }}
            className={`${SETTINGS_INPUT} max-w-xs font-mono ${tried && template ? 'border-danger' : 'border-border/60'}`}
            data-coupons-import-template=""
          />
          {tried && template ? (
            <p className="text-xs text-danger" role="alert" data-coupon-problem={template}>
              {t(`coupons.create.problems.${template}`, { max: fsi(MAX_TEMPLATE) })}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">{t('coupons.create.templateHint')}</p>
          )}
        </div>

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
            disabled={send.isPending}
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
        </div>

        {read.noCodeColumn && (
          <p className="text-sm text-danger-800" data-coupons-import-no-code="">
            {t('coupons.import.noCodeColumn')}
          </p>
        )}

        {rows.length > 0 && (
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
            {tally.rejected > 0 && tally.ok > 0 && <p className="text-xs text-muted-foreground">{t('coupons.import.leftOut')}</p>}
            <p className="text-xs text-muted-foreground">{t('coupons.import.hqChecks')}</p>
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
      <Trans t={t} i18nKey={`coupons.import.problems.${data.problem}`} values={{ max: formatNumber(MAX_BATCH), code: MAX_CODE, member: MAX_MEMBER }} components={{ v: <bdi dir="ltr" /> }} />
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

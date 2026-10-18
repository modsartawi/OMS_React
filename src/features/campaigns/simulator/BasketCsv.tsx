import { useId, useMemo, useState } from 'react'
import { useQueries } from '@tanstack/react-query'
import { Trans, useTranslation } from 'react-i18next'
import { AgGridReact } from 'ag-grid-react'
import type { ColDef, ICellRendererParams } from 'ag-grid-community'
import type { TFunction } from 'i18next'
// Side-effect import: registers AG Grid Community modules within this chunk.
import '@/core/ag-grid-setup'
import { OMS_GRID_HEADER_HEIGHT, OMS_GRID_ROW_HEIGHT, omsGridTheme } from '@/core/theme/ag-grid-theme'
import { OMS_GRID_BASE_COL_DEF } from '@/core/theme/grid-base'
import { ruleLookupQuery } from '@/core/rules/api'
import { lookupName } from '@/core/rules/lookups'
import { RULE_INPUT } from '@/core/rules/LookupPicks'
import Button from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import { fsi } from '@/core/util/bidi'
import { formatNumber } from '@/core/util/number-format'
import { useDebounced } from '@/core/util/use-debounced'
import {
  MAX_BASKET_LINES,
  MAX_QTY,
  checkBasketRow,
  csvVerdict,
  overflowsQty,
  parseBasketCsv,
  takeRows,
  type BasketCsvRow,
  type BasketLine,
  type BasketRowCheck,
  type SkuCheck,
} from './basket'

interface PreviewRow extends BasketCsvRow {
  check: BasketRowCheck
}

/**
 * A basket from a CSV (ticket 514), uploaded or pasted. Every row is read and checked before it is
 * used — its SKU and quantity as written, then the SKU on HQ's materials lookup — and the rows are
 * taken only when every one is good: a bad row is fixed in the text or removed, never dropped
 * silently. They replace the basket or are added to it.
 */
export default function BasketCsv({
  basket,
  onUse,
  onCancel,
}: {
  basket: BasketLine[]
  onUse: (basket: BasketLine[]) => void
  onCancel: () => void
}) {
  const { t } = useTranslation('rule-simulator')
  const [text, setText] = useState('')
  const [mode, setMode] = useState<'replace' | 'add'>('replace')
  const [fileFailed, setFileFailed] = useState(false)
  const fileId = useId()
  const pasteId = useId()

  // Read once the typing settles: every distinct SKU is a lookup on HQ.
  const settled = useDebounced(text, 300)
  const rows = useMemo(() => parseBasketCsv(settled), [settled])
  const skus = useMemo(() => [...new Set(rows.filter((r) => !r.problem).map((r) => r.sku))], [rows])
  const lookups = useQueries({ queries: skus.map((sku) => ruleLookupQuery('materials', sku)) })
  const found = new Map<string, SkuCheck>(
    skus.map((sku, i) => {
      const q = lookups[i]
      if (q.isPending) return [sku, { state: 'checking' }]
      if (q.isError) return [sku, { state: 'failed' }]
      const hit = q.data.find((m) => m.code.toUpperCase() === sku)
      return [sku, hit ? { state: 'found', code: hit.code, name: lookupName(hit) } : { state: 'missing' }]
    }),
  )
  const preview: PreviewRow[] = rows.map((r) => ({ ...r, check: checkBasketRow(r, found.get(r.sku)) }))
  const verdict = csvVerdict(preview.map((r) => r.check))
  // A good row takes the SKU as HQ keeps it, so it merges with a typed line of the same item.
  const good = verdict.usable
    ? preview.flatMap((r) => (r.check.status === 'ok' ? [{ sku: r.check.code, name: r.check.name, qty: r.qty ?? 1 }] : []))
    : null
  const taken = good ? takeRows(basket, good, mode) : null
  const tooBig = !!taken && taken.length > MAX_BASKET_LINES
  const tooMuch = !!good && overflowsQty(basket, good, mode)
  const n = (x: number) => fsi(formatNumber(x))

  const columns = useMemo(() => previewColumns(t), [t])
  const gridContext = useMemo(() => ({ t }), [t])

  return (
    <div className="flex flex-col gap-3 rounded-md border border-border bg-card-2 p-3" data-basket-csv="">
      <div>
        <h3 className="text-sm font-semibold">{t('csv.title')}</h3>
        <p className="mt-1 text-xs text-muted-foreground">{t('csv.format')}</p>
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor={fileId} className="text-xs font-medium text-muted-foreground">
          {t('csv.file')}
        </label>
        <input
          id={fileId}
          type="file"
          accept=".csv,.txt,text/csv,text/plain"
          className="text-xs"
          onChange={(e) => {
            const file = e.target.files?.[0]
            e.target.value = ''
            if (!file) return
            setFileFailed(false)
            file.text().then(setText, () => setFileFailed(true))
          }}
          data-csv-file=""
        />
        {fileFailed && <ErrorBanner message={t('csv.fileFailed')} className="px-3 py-2" />}
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor={pasteId} className="text-xs font-medium text-muted-foreground">
          {t('csv.paste')}
        </label>
        <textarea
          id={pasteId}
          dir="ltr"
          rows={5}
          className={`${RULE_INPUT} h-auto py-1.5 font-mono text-xs`}
          placeholder={t('csv.pastePlaceholder')}
          value={text}
          onChange={(e) => setText(e.target.value)}
          data-csv-text=""
        />
      </div>

      {rows.length > 0 && (
        <>
          <div className="h-56" data-csv-preview="">
            <AgGridReact<PreviewRow>
              theme={omsGridTheme}
              rowData={preview}
              columnDefs={columns}
              defaultColDef={DEFAULT_COL_DEF}
              getRowId={({ data }) => String(data.line)}
              context={gridContext}
              rowClassRules={{ 'bg-danger-050': ({ data }) => data?.check.status === 'bad' }}
              rowHeight={OMS_GRID_ROW_HEIGHT}
              headerHeight={OMS_GRID_HEADER_HEIGHT}
              animateRows={false}
              suppressColumnVirtualisation
            />
          </div>
          <p className="text-xs text-muted-foreground" data-csv-tally="">
            {t('csv.tally', { ok: n(verdict.ok), bad: n(verdict.bad), waiting: n(verdict.waiting) })}
          </p>
          {verdict.bad > 0 && (
            <p className="text-xs text-danger-800" data-csv-fix="">
              {t('csv.fixFirst')}
            </p>
          )}
          {tooBig && (
            <p className="text-xs text-danger-800" data-csv-too-big="">
              {t('csv.tooBig', { max: n(MAX_BASKET_LINES) })}
            </p>
          )}
          {tooMuch && (
            <p className="text-xs text-danger-800" data-csv-too-much="">
              {t('csv.tooMuch', { max: n(MAX_QTY) })}
            </p>
          )}
        </>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <fieldset className="flex items-center gap-3 text-xs">
          {(['replace', 'add'] as const).map((m) => (
            <label key={m} className="inline-flex items-center gap-1.5">
              <input type="radio" name={`csv-mode-${fileId}`} checked={mode === m} onChange={() => setMode(m)} data-csv-mode={m} />
              {t(`csv.${m}`)}
            </label>
          ))}
        </fieldset>
        <div className="ms-auto flex items-center gap-2">
          <Button variant="text" onClick={onCancel} data-csv-cancel="">
            {t('csv.cancel')}
          </Button>
          <Button variant="primary" disabled={!taken || tooBig || tooMuch} onClick={() => taken && onUse(taken)} data-csv-use="">
            {t('csv.use', { count: verdict.ok, n: n(verdict.ok) })}
          </Button>
        </div>
      </div>
    </div>
  )
}

const DEFAULT_COL_DEF: ColDef<PreviewRow> = { ...OMS_GRID_BASE_COL_DEF, sortable: false, resizable: true }

/** The check's words; a good row reads its item's name. */
function CheckCell({ data, context }: ICellRendererParams<PreviewRow, unknown, { t: TFunction }>) {
  if (!data) return null
  const { check } = data
  const { t } = context
  if (check.status === 'ok') return <bdi data-csv-check="ok">{check.name}</bdi>
  if (check.status === 'checking') return <span className="text-muted-foreground" data-csv-check="checking">{t('csv.status.checking')}</span>
  if (check.status === 'failed') return <span className="text-danger-800" data-csv-check="failed">{t('csv.status.failed')}</span>
  return (
    <span className="text-danger-800" data-csv-check={check.problem}>
      {/* A grid cell: the figure is isolated by a <bdi>, never by fsi (it would reach Ctrl+C). */}
      <Trans
        t={t}
        i18nKey={`csv.status.${check.problem}`}
        values={{ max: formatNumber(check.problem === 'badQty' ? MAX_QTY : MAX_BASKET_LINES) }}
        components={{ v: <bdi dir="ltr" /> }}
      />
    </span>
  )
}

function previewColumns(t: TFunction): ColDef<PreviewRow>[] {
  return [
    { colId: 'line', field: 'line', headerName: t('csv.columns.line'), width: 80 },
    { colId: 'sku', field: 'sku', headerName: t('csv.columns.sku'), width: 150 },
    { colId: 'qty', field: 'qty', headerName: t('csv.columns.qty'), width: 90 },
    { colId: 'check', headerName: t('csv.columns.check'), cellRenderer: CheckCell, flex: 1, minWidth: 200 },
  ]
}

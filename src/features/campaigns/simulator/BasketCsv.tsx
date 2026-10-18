import { useId, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AgGridReact } from 'ag-grid-react'
import type { ColDef, ICellRendererParams } from 'ag-grid-community'
import type { TFunction } from 'i18next'
// Side-effect import: registers AG Grid Community modules within this chunk.
import '@/core/ag-grid-setup'
import { OMS_GRID_HEADER_HEIGHT, OMS_GRID_ROW_HEIGHT, omsGridTheme } from '@/core/theme/ag-grid-theme'
import { OMS_GRID_BASE_COL_DEF } from '@/core/theme/grid-base'
import { RULE_INPUT } from '@/core/rules/LookupPicks'
import Button from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import { fsi } from '@/core/util/bidi'
import { formatNumber } from '@/core/util/number-format'
import { fileUsable, readBasketFile, type BasketFileRow } from './basket'

/**
 * A basket from a CSV (tickets 514, 525), uploaded or pasted. HQ reads the file itself
 * (`Rules/Authoring/Simulate`'s `csv`); every line is first checked here by HQ's own rules and shown,
 * and the file is used only when every line is good — a bad line is fixed in the text or removed,
 * never dropped silently. The file then IS the basket, sent as written.
 */
export default function BasketCsv({ onUse, onCancel }: { onUse: (text: string) => void; onCancel: () => void }) {
  const { t } = useTranslation('rule-simulator')
  const [text, setText] = useState('')
  const [fileFailed, setFileFailed] = useState(false)
  const fileId = useId()
  const pasteId = useId()

  const file = useMemo(() => readBasketFile(text), [text])
  const bad = file.rows.filter((r) => r.problems.length > 0).length
  const usable = fileUsable(file)
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
            const picked = e.target.files?.[0]
            e.target.value = ''
            if (!picked) return
            setFileFailed(false)
            picked.text().then(setText, () => setFileFailed(true))
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

      {text.trim() !== '' && file.problem && (
        <p className="text-xs text-danger-800" data-csv-problem={file.problem}>
          {t(`csv.${file.problem}`)}
        </p>
      )}
      {file.rows.length > 0 && (
        <>
          <div className="h-56" data-csv-preview="">
            <AgGridReact<BasketFileRow>
              theme={omsGridTheme}
              rowData={file.rows}
              columnDefs={columns}
              defaultColDef={DEFAULT_COL_DEF}
              getRowId={({ data }) => String(data.line)}
              context={gridContext}
              rowClassRules={{ 'bg-danger-050': ({ data }) => (data?.problems.length ?? 0) > 0 }}
              rowHeight={OMS_GRID_ROW_HEIGHT}
              headerHeight={OMS_GRID_HEADER_HEIGHT}
              animateRows={false}
              suppressColumnVirtualisation
            />
          </div>
          <p className="text-xs text-muted-foreground" data-csv-tally="">
            {t('csv.tally', { ok: n(file.rows.length - bad), bad: n(bad) })}
          </p>
          {bad > 0 && (
            <p className="text-xs text-danger-800" data-csv-fix="">
              {t('csv.fixFirst')}
            </p>
          )}
        </>
      )}

      <div className="flex items-center justify-end gap-2">
        <Button variant="text" onClick={onCancel} data-csv-cancel="">
          {t('csv.cancel')}
        </Button>
        <Button variant="primary" disabled={!usable} onClick={() => usable && onUse(text)} data-csv-use="">
          {t('csv.use', { count: file.rows.length, n: n(file.rows.length) })}
        </Button>
      </div>
    </div>
  )
}

const DEFAULT_COL_DEF: ColDef<BasketFileRow> = { ...OMS_GRID_BASE_COL_DEF, sortable: false, resizable: true }

/** The line's check: good, or each of HQ's reasons it is refused. */
function CheckCell({ data, context }: ICellRendererParams<BasketFileRow, unknown, { t: TFunction }>) {
  if (!data) return null
  const { t } = context
  if (data.problems.length === 0) return <span data-csv-check="ok">{t('csv.status.ok')}</span>
  return (
    <span className="flex flex-wrap gap-x-2 text-danger-800" data-csv-check={data.problems.join(' ')}>
      {data.problems.map((p) => (
        <span key={p}>{t(`csv.status.${p}`)}</span>
      ))}
    </span>
  )
}

function previewColumns(t: TFunction): ColDef<BasketFileRow>[] {
  return [
    { colId: 'line', field: 'line', headerName: t('csv.columns.line'), width: 70 },
    { colId: 'article', field: 'article', headerName: t('csv.columns.article'), width: 130 },
    { colId: 'qty', field: 'quantity', headerName: t('csv.columns.qty'), width: 70 },
    { colId: 'net', field: 'net', headerName: t('csv.columns.net'), width: 90 },
    { colId: 'category', field: 'category', headerName: t('csv.columns.category'), width: 100 },
    { colId: 'check', headerName: t('csv.columns.check'), cellRenderer: CheckCell, flex: 1, minWidth: 180 },
  ]
}

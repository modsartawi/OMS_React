// THROWAWAY: shared-state proposal, hosted in the accepted inquiry shell.
// Collection is a visual specimen, not a replacement search/workflow implementation.
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AgGridReact } from 'ag-grid-react'
import type { ColDef } from 'ag-grid-community'
import i18n from '@/core/i18n'
import Button from '@/core/ui/Button'
import StatusBadge from '@/core/ui/StatusBadge'
import { omsGridTheme } from '@/core/theme/ag-grid-theme'
import copy from './state-copy.json'
import './theme-state-review.css'

i18n.addResourceBundle('en', 'theme-states', copy, true, true)
const theme = omsGridTheme.withParams({
  wrapperBorderRadius: 0, inputBorderRadius: 3, buttonBorderRadius: 3,
  inputHeight: 28, rowHoverColor: 'var(--accent)',
  inputFocusBorder: { color: 'var(--ring)', width: 2 },
  inputFocusShadow: 'none', inputInvalidBorder: { color: 'var(--danger)', width: 2 },
  inputDisabledBackgroundColor: 'var(--muted)', inputDisabledTextColor: 'var(--muted-foreground)',
})
type Row = { reference: string; store: string; collectedBy: string; amount: number; status: string; note: string }
const rows: Row[] = [
  { reference: 'COL-00048', store: 'PH-019 (P019)', collectedBy: 'Operator A', amount: 12750.50, status: 'recorded', note: 'Business date · 2026-10-01' },
  { reference: 'COL-00047', store: 'PH-042 (P042)', collectedBy: 'Operator B', amount: 890.25, status: 'recorded', note: 'Business date · 2026-10-01' },
  { reference: 'COL-00046', store: 'P107', collectedBy: 'Operator C', amount: 200.00, status: 'recorded', note: 'Business date · 2026-09-30' },
]

export default function ThemeStateReview({ rtl }: { rtl: boolean }) {
  const { t } = useTranslation('theme-states')
  const [scene, setScene] = useState('default')
  const [rich, setRich] = useState(false)
  const [scoped, setScoped] = useState(false)
  const [draft, setDraft] = useState<Record<string, string>>({ businessFrom: '2026-10-01', businessTo: '2026-10-01' })
  const [selection, setSelection] = useState(0)
  const [amount, setAmount] = useState('-10')
  const invalid = !amount.trim() || !Number.isFinite(Number(amount)) || Number(amount) < 0
  const columns = useMemo<ColDef<Row>[]>(() => [
    { field: 'reference', headerName: t('reference'), pinned: rtl ? 'right' : 'left', width: 170 },
    { field: 'store', headerName: t('store'), width: 240, cellRenderer: ({ data }: { data?: Row }) => data && <div className="state-store"><span>{data.store}</span>{rich && data.note && <small>{data.note}</small>}</div> },
    { field: 'collectedBy', headerName: t('collectedBy'), width: 170 },
    { field: 'status', headerName: t('status'), width: 150, cellRenderer: ({ value }: { value: string }) => value ? <StatusBadge sev="mute">{t(value)}</StatusBadge> : null },
    { field: 'amount', headerName: t('amount'), width: 180, type: 'numericColumn', filter: 'agNumberColumnFilter', valueFormatter: p => p.value?.toLocaleString('en-SA', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) },
  ], [t, rtl, rich])
  return <section className="state-review" aria-label={t('title')}>
    <header className="state-intro"><div><h1>{t('title')}</h1><p>{t('intro')}</p></div><span>{t('proposal')}</span></header>
    <div className="state-rules">{['geometry', 'surfaces', 'interaction'].map(key => <div key={key}><strong>{t(key)}</strong><p>{t(`${key}Hint`)}</p></div>)}</div>
    <section className="state-panel"><h2>{t('collection')}</h2><p>{t('collectionHint')}</p>
      <div className="state-collection-fields">
        {['businessFrom', 'businessTo', 'collectionFrom', 'collectionTo', 'storeCode', 'collectedBy', 'servedBy'].map((key, index) => <label key={key}>{t(key)}<input type={index < 4 ? 'date' : 'text'} disabled={scoped} value={scoped ? '' : draft[key] ?? ''} onChange={e => setDraft(previous => ({ ...previous, [key]: e.target.value }))} /></label>)}
        <Button disabled={scoped} onClick={() => setScene('default')}>{t('previewResults')}</Button>
      </div>
      <div className="state-inline"><label><input type="checkbox" checked={scoped} onChange={e => setScoped(e.target.checked)} />{t('scope')}</label>{scoped && <span className="state-chip">{t('scopeHint')}</span>}</div>
    </section>
    <section className="state-panel"><div className="state-section-heading"><h2>{t('grid')}</h2><div className="state-inline">{['default', 'loading', 'empty'].map(key => <Button key={key} variant="outlined" aria-pressed={scene === key} onClick={() => setScene(key)}>{t(key)}</Button>)}<label><input type="checkbox" checked={rich} onChange={e => setRich(e.target.checked)} />{t('rich')}</label></div></div>
      <p>{t('gridHint')}</p>
      <div className="state-grid"><AgGridReact<Row> key={`${rtl}-${rich}`} theme={theme} enableRtl={rtl}
        rowData={scene === 'default' ? rows : []} loading={scene === 'loading'} columnDefs={columns}
        defaultColDef={{ sortable: true, resizable: true, filter: true, floatingFilter: true }}
        rowHeight={rich ? 44 : 28} headerHeight={32} floatingFiltersHeight={36}
        rowSelection={{ mode: 'multiRow', checkboxes: true, headerCheckbox: true, enableClickSelection: true }}
        selectionColumnDef={{ pinned: rtl ? 'right' : 'left', width: 45 }}
        enableCellTextSelection ensureDomOrder getRowId={p => p.data.reference}
        onGridReady={() => setSelection(0)} onSelectionChanged={e => setSelection(e.api.getSelectedRows().length)}
        pinnedBottomRowData={scene === 'default' ? [{ reference: t('total'), store: '', collectedBy: '', amount: 13840.75, status: '', note: '' }] : []}
        overlayLoadingTemplate={`<span role="status">${t('loadingHint')}</span>`}
        overlayNoRowsTemplate={`<span role="status">${t('emptyHint')}</span>`} /></div>
      <output className="state-output" aria-live="polite">{t('state', { scene: t(scene), count: selection, height: rich ? 44 : 28, direction: rtl ? 'RTL' : 'LTR' })}</output>
    </section>
    <div className="state-pair">
      <section className="state-panel"><h2>{t('fields')}</h2><p>{t('fieldsHint')}</p><div className="state-field-samples">
        <label>{t('default')}<input placeholder={t('typeHere')} /></label>
        <label>{t('disabled')}<input disabled value={t('unavailable')} readOnly /></label>
        <label>{t('amount')}<input inputMode="decimal" dir="ltr" value={amount} onChange={e => setAmount(e.target.value)} aria-invalid={invalid} aria-describedby="state-amount-help" /><small id="state-amount-help" className={invalid ? 'state-error' : ''}>{t(invalid ? 'invalidHint' : 'validHint')}</small></label>
      </div><div className="state-inline"><Button>{t('primary')}</Button><Button variant="outlined">{t('secondary')}</Button><Button disabled>{t('disabled')}</Button></div></section>
      <section className="state-panel"><h2>{t('commands')}</h2><p>{t('commandsHint')}</p><div className="state-inline state-command-samples"><Button variant="fulfilment">{t('reschedule')}</Button><Button variant="cancel-request">{t('requestCancellation')}</Button><Button variant="danger">{t('cancel')}</Button><Button variant="ghost">{t('addNote')}</Button></div><div className="state-inline"><StatusBadge sev="bad">{t('cancelled')}</StatusBadge><span className="prototype-request">{t('cancellationRequested')}</span><span className="state-prescription">{t('prescription')}</span><span className="state-provenance">{t('post')}</span></div><p>{t('amountExample')}</p></section>
    </div>
  </section>
}

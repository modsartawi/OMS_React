// THROWAWAY: chosen combination plus original directions at ?variant=selected|A|B|C.
// Decision ticket: Choose the app theme through three visual directions.
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import { AgGridReact } from 'ag-grid-react'
import type { ColDef, GridApi } from 'ag-grid-community'
import { SlidersHorizontal, ArrowUpRight, Sun, Moon } from 'lucide-react'
import '@/core/ag-grid-setup'
import i18n from '@/core/i18n'
import Button from '@/core/ui/Button'
import StatusBadge from '@/core/ui/StatusBadge'
import PrototypeSwitcher from '@/core/ui/ThemePrototypeSwitcher'
import { omsGridTheme } from '@/core/theme/ag-grid-theme'
import copy from './copy.json'
import ThemePrototypeFilters from './ThemePrototypeFilters'
import ThemeStateReview from './ThemeStateReview'
import { BLANK_CRITERIA, buildDeliveryQuery, type DeliveryFilterCriteria } from '../filter'
import './theme-prototype.css'
import ThemePreviewNav from '@/core/ui/ThemePreviewNav'
import '@/core/ui/theme-preview-nav.css'

i18n.addResourceBundle('en', 'theme-prototype', copy, true, true)
const keys = ['A', 'B', 'C', 'selected'] as const
type Variant = typeof keys[number]
type Row = { deliveryNo: string; orderNo: string; customer: string; store: string; date: string; status: string; slot: string; total: number; due: number; source: string; city: string; jobs: number; note: string; rescheduled: boolean; documentNo: string; customerPhone: string; documentType: string; deliveryDocumentType: string; deliveryType: string; documentReason: string; isExpress: boolean }
// Invented display data; no customer data or API mutations.
const rows: Row[] = Array.from({ length: 48 }, (_, i) => ({
  deliveryNo: String(8000048 - i), orderNo: String(1000080421 - i),
  customer: ['Reem Al-Harbi', 'Omar Al-Qahtani', 'Noura Al-Salem', 'Fahad Al-Otaibi', 'Lina Al-Dossari', 'Abdullah Al-Zahrani'][i % 6],
  store: ['P019', 'P042', 'P107'][i % 3], date: `2026-10-0${i % 3 + 1}`,
  status: ['ready', 'delivered', 'pending', 'ready', 'cancelled', 'delivered'][i % 6],
  slot: ['10:00–12:00', '12:00–14:00', '16:00–18:00'][i % 3],
  total: Math.round((92.5 + i * 17.35) * 100) / 100, due: i % 4 === 0 ? 72.5 : 0,
  source: ['Call center', 'Web', 'Store'][i % 3], city: ['Riyadh', 'Dammam', 'Khobar'][i % 3],
  documentNo: String(2000080421 - i), customerPhone: `050000${String(i + 1).padStart(4, '0')}`,
  documentType: ['Call Center', 'Web Order', 'Store Order'][i % 3],
  deliveryDocumentType: i % 8 === 0 ? 'Return Delivery' : 'Standard Delivery',
  deliveryType: i % 4 === 0 ? 'PickInStore' : 'Delivery', documentReason: i % 5 === 0 ? 'TMRA' : 'STANDARD', isExpress: i % 3 === 0,
  jobs: i % 7 === 0 ? 2 : 0, rescheduled: i % 5 === 0, note: i % 5 === 0 ? 'Customer requested an afternoon slot' : '',
}))
const palette = ['background', 'card', 'foreground', 'primary', 'success', 'attention', 'danger', 'prescription', 'post']
const gridTheme = omsGridTheme.withParams({ wrapperBorderRadius: 'var(--prototype-radius)', rowHoverColor: 'var(--accent)' })

export default function ThemePrototypePage() {
  const { t } = useTranslation('theme-prototype')
  const [params, setParams] = useSearchParams()
  const stateReview = params.get('review') === 'states'
  const variant = !stateReview && keys.includes(params.get('variant') as Variant) ? params.get('variant') as Variant : 'selected'
  const composition = variant === 'selected' ? 'C' : variant
  const dark = params.get('mode') === 'dark'
  const rtl = params.get('dir') === 'rtl'
  const [scope, setScope] = useState('all')
  const [applied, setApplied] = useState<DeliveryFilterCriteria>(BLANK_CRITERIA)
  const [selected, setSelected] = useState<Row | null>(null)
  const [api, setApi] = useState<GridApi<Row> | null>(null)
  const [chooser, setChooser] = useState(false)
  const [hidden, setHidden] = useState<string[]>([])
  const [swatches, setSwatches] = useState<Record<string, string>>({})
  const update = useCallback((key: string, value: string) => {
    setParams(previous => { const next = new URLSearchParams(previous); next.set(key, value); return next }, { replace: true })
  }, [setParams])
  const changeVariant = useCallback((index: number) => update('variant', keys[index]), [update])
  useEffect(() => {
    const toggle = () => update('mode', dark ? 'light' : 'dark')
    window.addEventListener('theme-prototype-toggle', toggle)
    return () => window.removeEventListener('theme-prototype-toggle', toggle)
  }, [dark, update])
  useEffect(() => {
    const root = document.documentElement
    const previous = { dark: root.classList.contains('dark'), mode: root.dataset.agThemeMode, dir: root.dir }
    root.dataset.themePrototype = variant
    root.classList.toggle('dark', dark)
    root.dataset.agThemeMode = dark ? 'dark' : 'light'
    root.dir = rtl ? 'rtl' : 'ltr'
    const css = getComputedStyle(root)
    setSwatches(Object.fromEntries(palette.map(name => [name, css.getPropertyValue(`--${name}`).trim()])))
    return () => {
      delete root.dataset.themePrototype
      root.classList.toggle('dark', previous.dark)
      if (previous.mode) root.dataset.agThemeMode = previous.mode
      else delete root.dataset.agThemeMode
      root.dir = previous.dir
    }
  }, [variant, dark, rtl])
  const data = useMemo(() => {
    const query = buildDeliveryQuery(applied)
    const matches = (value: string, criterion: unknown) => !criterion || value.toLowerCase().includes(String(criterion).toLowerCase())
    // Local fixture matching only; production matching remains server-owned.
    return rows.filter(row => (!query.FromDate || row.date >= String(query.FromDate))
      && (!query.ToDate || row.date <= String(query.ToDate))
      && matches(row.store, query.StoreCode) && matches(row.deliveryNo, query.DeliveryNo)
      && matches(row.documentNo, query.DocumentNo) && matches(row.orderNo, query.OrderNo)
      && matches(row.customerPhone, query.CustomerPhone) && matches(row.documentReason, query.DocumentReason)
      && (!query.DocumentType || row.documentType === query.DocumentType)
      && (!query.DocumentSource || row.source === query.DocumentSource)
      && (!query.DeliveryDocumentType || row.deliveryDocumentType === query.DeliveryDocumentType)
      && (!query.DeliveryType || row.deliveryType === query.DeliveryType)
      && (query.IsExpress === undefined || row.isExpress === query.IsExpress)
      && (scope === 'all' || (scope === 'failed' ? row.jobs > 0 : row.rescheduled)))
      .slice(0, Number(query.Limit))
  }, [applied, scope])
  useEffect(() => { api?.deselectAll(); setSelected(null) }, [data, api])
  const columns = useMemo<ColDef<Row>[]>(() => [
    { field: 'deliveryNo', width: 125, pinned: rtl ? 'right' : 'left', lockPinned: true, cellClass: 'prototype-identity' },
    { field: 'status', width: 190, cellRenderer: ({ value }: { value: string }) => value === 'pending'
      ? <span className="prototype-request">{t(value)}</span>
      : <StatusBadge sev={value === 'cancelled' ? 'bad' : value === 'delivered' ? 'ok' : 'mute'}>{t(value)}</StatusBadge> },
    { field: 'store', width: 86 }, { field: 'customer', width: 175 },
    { field: 'total', width: 142, type: 'numericColumn', valueFormatter: (p: { value: number }) => p.value?.toFixed(2) },
    { field: 'due', width: 150, type: 'numericColumn', valueFormatter: (p: { value: number }) => p.value?.toFixed(2) },
    { field: 'date', width: 125 }, { field: 'slot', width: 135, cellRenderer: ({ value }: { value: string }) => <bdi dir="ltr">{value}</bdi> }, { field: 'orderNo', width: 145 },
    { field: 'jobs', width: 115, cellRenderer: ({ value }: { value: number }) => value ? <StatusBadge sev="bad">{value}</StatusBadge> : '—' },
    { field: 'source', width: 130 }, { field: 'city', width: 130 }, { field: 'note', width: 310 },
  ].map(col => ({ ...col, headerName: t(col.field!), hide: hidden.includes(col.field!) })) as ColDef<Row>[], [t, rtl, hidden])
  const reset = () => { setApplied(BLANK_CRITERIA); setScope('all'); api?.setFilterModel(null) }
  const filters = <ThemePrototypeFilters applied={applied} onApply={setApplied} onReset={reset} />
  const scopes = <div className="prototype-scopes">{['all', 'failed', 'rescheduled'].map(key => <button key={key} aria-pressed={scope === key} onClick={() => { setScope(key); setSelected(null) }}><span>{t(key)}</span><strong>{rows.filter(r => key === 'all' || (key === 'failed' ? r.jobs > 0 : r.rescheduled)).length}</strong></button>)}</div>
  const grid = <section className="prototype-results">
    <div className="prototype-results-toolbar"><h2>{t('results')} <span>{t('count', { count: data.length })}</span></h2><div className="flex items-center gap-2"><Button variant="outlined" onClick={() => setChooser(!chooser)} aria-expanded={chooser}><SlidersHorizontal size={14} />{t('columns')}</Button><Button disabled={!selected} onClick={() => window.location.assign(`/oms/delivery/${selected!.deliveryNo}?${params}`)}>{t('open')}<ArrowUpRight size={14} /></Button></div></div>
    {chooser && <div className="prototype-column-chooser">{columns.filter(c => c.field !== 'deliveryNo').map(col => <label key={col.field}><input type="checkbox" checked={!hidden.includes(col.field!)} onChange={e => setHidden(old => e.target.checked ? old.filter(key => key !== col.field) : [...old, col.field!])} />{col.headerName}</label>)}</div>}
    <div className="prototype-grid"><AgGridReact<Row> key={String(rtl)} theme={gridTheme} enableRtl={rtl} rowData={data} columnDefs={columns}
      enableCellTextSelection ensureDomOrder
      defaultColDef={{ sortable: true, resizable: true, filter: true, floatingFilter: true }} rowHeight={28} headerHeight={30} floatingFiltersHeight={30}
      rowSelection={{ mode: 'singleRow', checkboxes: false, enableClickSelection: true }} getRowId={p => p.data.deliveryNo}
      onGridReady={e => setApi(e.api)} onSelectionChanged={e => setSelected(e.api.getSelectedRows()[0] ?? null)}
      overlayNoRowsTemplate={`<span>${t('empty')}</span>`} /></div>
    <div className="prototype-grid-footer"><span>{selected ? t('selected', { id: selected.deliveryNo }) : t('none')}</span><span>{t('copyHint')} {t('scope')}</span></div>
  </section>
  return <div className={`theme-prototype prototype-${composition}${variant === 'selected' ? ' prototype-selected' : ''}`}>
    <ThemePreviewNav />
    {params.get('review') === 'states' ? <ThemeStateReview rtl={rtl} /> : <>
    <div className="prototype-heading"><div><div className="prototype-eyebrow">{t('review')}</div><h1>{t('title')}</h1><p>{t('subtitle')}</p></div><span className="prototype-fixture">{t('fixture')}</span></div>
    {composition === 'A' && <>{filters}{scopes}{grid}</>}
    {composition === 'B' && <div className="prototype-workspace"><aside>{filters}<p className="prototype-aside-note">{t('descriptionB')}</p></aside><div>{scopes}{grid}</div></div>}
    {composition === 'C' && <>{scopes}<div className="prototype-command-strip">{filters}</div>{grid}</>}
    <section className="prototype-specimens"><div><strong>{t('palette')}</strong><p>{t(`description${variant}`)}</p></div><div className="prototype-swatches">{palette.map(name => <div key={name}><i style={{ background: `var(--${name})` }} /><span>{t(name)}<code>{swatches[name]}</code></span></div>)}</div>
      <div className="prototype-components"><span>{t('specimens')}</span><Button variant="cancel-request" disabled>{t('requestCancellation')}</Button><Button variant="danger-outlined" disabled>{t('cancel')}</Button><span className="rounded-full bg-prescription-050 px-2 py-0.5 text-xs text-prescription-800">{t('prescription')}</span><span className="rounded-full bg-post-050 px-2 py-0.5 text-xs text-post-800">{t('post')}</span></div>
    </section>
    <output className="prototype-state">{t('state', { variant: t(variant === 'selected' ? 'selectedDesign' : variant), mode: t(dark ? 'dark' : 'light'), direction: rtl ? 'RTL' : 'LTR', count: data.length, selection: selected?.deliveryNo ?? '—' })}</output>
    </>}
    <PrototypeSwitcher names={stateReview ? [t('selectedDesign')] : keys.map(key => t(key === 'selected' ? 'selectedDesign' : key))} current={stateReview ? 0 : keys.indexOf(variant)} onChange={stateReview ? () => {} : changeVariant} previousLabel={t('previous')} nextLabel={t('next')}>
      <button aria-pressed={dark} onClick={() => update('mode', dark ? 'light' : 'dark')}>{dark ? <Sun size={15} /> : <Moon size={15} />}{t(dark ? 'light' : 'dark')}</button>
      <button aria-pressed={rtl} onClick={() => update('dir', rtl ? 'ltr' : 'rtl')}>{t('rtl')}</button>
    </PrototypeSwitcher>
  </div>
}

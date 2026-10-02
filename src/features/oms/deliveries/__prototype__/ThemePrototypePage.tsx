// THROWAWAY: three visual directions on /oms/deliveries?variant=A|B|C.
// Decision ticket: Choose the app theme through three visual directions.
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import { AgGridReact } from 'ag-grid-react'
import type { ColDef, GridApi } from 'ag-grid-community'
import { Search, RotateCcw, SlidersHorizontal, ArrowUpRight, Sun, Moon } from 'lucide-react'
import '@/core/ag-grid-setup'
import i18n from '@/core/i18n'
import Button from '@/core/ui/Button'
import StatusBadge from '@/core/ui/StatusBadge'
import PrototypeSwitcher from '@/core/ui/ThemePrototypeSwitcher'
import { omsGridTheme } from '@/core/theme/ag-grid-theme'
import copy from './copy.json'
import './theme-prototype.css'

i18n.addResourceBundle('en', 'theme-prototype', copy, true, true)
const keys = ['A', 'B', 'C'] as const
type Variant = typeof keys[number]
type Row = { deliveryNo: string; orderNo: string; customer: string; store: string; date: string; status: string; slot: string; total: number; due: number; source: string; city: string; jobs: number; note: string; rescheduled: boolean }
// Invented display data; no customer data or API mutations.
const rows: Row[] = Array.from({ length: 48 }, (_, i) => ({
  deliveryNo: String(8000048 - i), orderNo: String(1000080421 - i),
  customer: ['Reem Al-Harbi', 'Omar Al-Qahtani', 'Noura Al-Salem', 'Fahad Al-Otaibi', 'Lina Al-Dossari', 'Abdullah Al-Zahrani'][i % 6],
  store: ['P019', 'P042', 'P107'][i % 3], date: `2026-10-0${i % 3 + 1}`,
  status: ['ready', 'delivered', 'pending', 'ready', 'cancelled', 'delivered'][i % 6],
  slot: ['10:00–12:00', '12:00–14:00', '16:00–18:00'][i % 3],
  total: Math.round((92.5 + i * 17.35) * 100) / 100, due: i % 4 === 0 ? 72.5 : 0,
  source: ['Call center', 'Web', 'Store'][i % 3], city: ['Riyadh', 'Dammam', 'Khobar'][i % 3],
  jobs: i % 7 === 0 ? 2 : 0, rescheduled: i % 5 === 0, note: i % 5 === 0 ? 'Customer requested an afternoon slot' : '',
}))
const palette = ['background', 'card', 'foreground', 'primary', 'success', 'attention', 'danger', 'prescription', 'post']
const gridTheme = omsGridTheme.withParams({ wrapperBorderRadius: 'var(--prototype-radius)', rowHoverColor: 'var(--accent)' })

export default function ThemePrototypePage() {
  const { t } = useTranslation('theme-prototype')
  const [params, setParams] = useSearchParams()
  const variant = keys.includes(params.get('variant') as Variant) ? params.get('variant') as Variant : 'A'
  const dark = params.get('mode') === 'dark'
  const rtl = params.get('dir') === 'rtl'
  const [query, setQuery] = useState('')
  const [store, setStore] = useState('')
  const [from, setFrom] = useState('2026-10-01')
  const [to, setTo] = useState('2026-10-03')
  const [scope, setScope] = useState('all')
  const [applied, setApplied] = useState({ query: '', store: '', from, to })
  const [selected, setSelected] = useState<Row | null>(null)
  const [api, setApi] = useState<GridApi<Row> | null>(null)
  const [chooser, setChooser] = useState(false)
  const [hidden, setHidden] = useState<string[]>([])
  const [preview, setPreview] = useState(false)
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
  const data = useMemo(() => rows.filter(row => (!applied.store || row.store === applied.store)
    && (!applied.from || row.date >= applied.from) && (!applied.to || row.date <= applied.to)
    && `${row.deliveryNo} ${row.orderNo} ${row.customer}`.toLowerCase().includes(applied.query.toLowerCase())
    && (scope === 'all' || (scope === 'failed' ? row.jobs > 0 : row.rescheduled))), [applied, scope])
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
  const reset = () => {
    setQuery(''); setStore(''); setFrom('2026-10-01'); setTo('2026-10-03'); setScope('all')
    setApplied({ query: '', store: '', from: '2026-10-01', to: '2026-10-03' }); api?.setFilterModel(null)
  }
  const filters = <form className="prototype-filters" onSubmit={event => { event.preventDefault(); setApplied({ query, store, from, to }); setSelected(null) }}>
    <div className="prototype-filter-intro"><h2>{t('filterTitle')}</h2><p>{t('filterHint')}</p></div>
    <label className="prototype-query">{t('lookup')}<input value={query} onChange={e => setQuery(e.target.value)} placeholder={t('placeholder')} /></label>
    <label>{t('store')}<select value={store} onChange={e => setStore(e.target.value)}><option value="">{t('allStores')}</option>{['P019', 'P042', 'P107'].map(s => <option key={s}>{s}</option>)}</select></label>
    <label>{t('from')}<input type="date" value={from} onChange={e => setFrom(e.target.value)} /></label>
    <label>{t('to')}<input type="date" value={to} min={from} onChange={e => setTo(e.target.value)} /></label>
    <div className="prototype-filter-actions"><Button type="submit"><Search size={14} />{t('search')}</Button><Button variant="outlined" onClick={reset} aria-label={t('reset')}><RotateCcw size={14} /></Button></div>
  </form>
  const scopes = <div className="prototype-scopes">{['all', 'failed', 'rescheduled'].map(key => <button key={key} aria-pressed={scope === key} onClick={() => { setScope(key); setSelected(null) }}><span>{t(key)}</span><strong>{rows.filter(r => key === 'all' || (key === 'failed' ? r.jobs > 0 : r.rescheduled)).length}</strong></button>)}</div>
  const grid = <section className="prototype-results">
    <div className="prototype-results-toolbar"><h2>{t('results')} <span>{t('count', { count: data.length })}</span></h2><div className="flex items-center gap-2"><Button variant="outlined" onClick={() => setChooser(!chooser)} aria-expanded={chooser}><SlidersHorizontal size={14} />{t('columns')}</Button><Button disabled={!selected} onClick={() => setPreview(true)}>{t('open')}<ArrowUpRight size={14} /></Button></div></div>
    {chooser && <div className="prototype-column-chooser">{columns.filter(c => c.field !== 'deliveryNo').map(col => <label key={col.field}><input type="checkbox" checked={!hidden.includes(col.field!)} onChange={e => setHidden(old => e.target.checked ? old.filter(key => key !== col.field) : [...old, col.field!])} />{col.headerName}</label>)}</div>}
    <div className="prototype-grid"><AgGridReact<Row> key={String(rtl)} theme={gridTheme} enableRtl={rtl} rowData={data} columnDefs={columns}
      defaultColDef={{ sortable: true, resizable: true, filter: true, floatingFilter: true }} rowHeight={28} headerHeight={30} floatingFiltersHeight={30}
      rowSelection={{ mode: 'singleRow', checkboxes: false, enableClickSelection: true }} getRowId={p => p.data.deliveryNo}
      onGridReady={e => setApi(e.api)} onSelectionChanged={e => setSelected(e.api.getSelectedRows()[0] ?? null)}
      overlayNoRowsTemplate={`<span>${t('empty')}</span>`} /></div>
    <div className="prototype-grid-footer"><span>{selected ? t('selected', { id: selected.deliveryNo }) : t('none')}</span><span>{t('scope')}</span></div>
  </section>
  return <div className={`theme-prototype prototype-${variant}`}>
    <div className="prototype-heading"><div><div className="prototype-eyebrow">{t('review')}</div><h1>{t('title')}</h1><p>{t('subtitle')}</p></div><span className="prototype-fixture">{t('fixture')}</span></div>
    {variant === 'A' && <>{filters}{scopes}{grid}</>}
    {variant === 'B' && <div className="prototype-workspace"><aside>{filters}<p className="prototype-aside-note">{t('descriptionB')}</p></aside><div>{scopes}{grid}</div></div>}
    {variant === 'C' && <>{scopes}<div className="prototype-command-strip">{filters}</div>{grid}</>}
    <section className="prototype-specimens"><div><strong>{t('palette')}</strong><p>{t(`description${variant}`)}</p></div><div className="prototype-swatches">{palette.map(name => <div key={name}><i style={{ background: `var(--${name})` }} /><span>{t(name)}<code>{swatches[name]}</code></span></div>)}</div>
      <div className="prototype-components"><span>{t('specimens')}</span><Button variant="cancel-request" disabled>{t('requestCancellation')}</Button><Button variant="danger-outlined" disabled>{t('cancel')}</Button><span className="rounded-full bg-prescription-050 px-2 py-0.5 text-xs text-prescription-800">{t('prescription')}</span><span className="rounded-full bg-post-050 px-2 py-0.5 text-xs text-post-800">{t('post')}</span></div>
    </section>
    <output className="prototype-state">{t('state', { variant: t(variant), mode: t(dark ? 'dark' : 'light'), direction: rtl ? 'RTL' : 'LTR', count: data.length, selection: selected?.deliveryNo ?? '—' })}</output>
    {preview && selected && <div className="prototype-preview" role="region" aria-label={t('open')}><div><span>{t('previewHint')}</span><h2>{selected.deliveryNo}</h2><p>{selected.customer} · {selected.store} · {t(selected.status)}</p></div><Button variant="outlined" onClick={() => setPreview(false)}>{t('close')}</Button></div>}
    <PrototypeSwitcher names={keys.map(key => t(key))} current={keys.indexOf(variant)} onChange={changeVariant} previousLabel={t('previous')} nextLabel={t('next')}>
      <button aria-pressed={dark} onClick={() => update('mode', dark ? 'light' : 'dark')}>{dark ? <Sun size={15} /> : <Moon size={15} />}{t(dark ? 'light' : 'dark')}</button>
      <button aria-pressed={rtl} onClick={() => update('dir', rtl ? 'ltr' : 'rtl')}>{t('rtl')}</button>
    </PrototypeSwitcher>
  </div>
}

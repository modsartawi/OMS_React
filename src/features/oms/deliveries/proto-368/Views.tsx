/* PROTOTYPE 368 — lenses + saved views (366), drawn three ways. */
import { useEffect, useRef, useState, type ReactNode } from 'react'
import {
  AlertTriangle, Ban, CalendarClock, Check, ChevronDown, Columns3, Download, Layers, MoreHorizontal,
  PanelRightClose, PanelRightOpen, Pencil, Plus, Save, Star, Trash2, Zap,
} from 'lucide-react'
import { toast } from 'sonner'
import { exportDeliveriesToExcel } from '../export'
import { c } from './copy'
import { LENSES, lensCount, type LensKey } from './model'
import {
  activeView, applyView, deleteView, isCut, isModified, nameTaken, renameView, saveAsNew, setLens,
  toggleDefault, updateActive, useProto, type SavedView,
} from './store'

const LENS_ICON: Record<LensKey, typeof Layers> = {
  all: Layers,
  attention: AlertTriangle,
  cancelRequested: Ban,
  dawaaNow: Zap,
  rescheduled: CalendarClock,
}

function useCounts() {
  const rows = useProto((s) => s.rows)
  const applied = useProto((s) => s.applied)
  const cut = isCut({ rows, applied })
  return (k: LensKey) => lensCount(rows, k, cut)
}

export function ModifiedDot() {
  const modified = useProto(isModified)
  if (!modified) return null
  return <span className="inline-block size-2 shrink-0 rounded-full bg-attention" title={c('views.modified')} aria-label={c('views.modified')} />
}

// ---------- the name dialog (Save as new / Rename) -----------------------------------

type DialogMode = { mode: 'save' } | { mode: 'rename'; view: SavedView }

export function ViewNameDialog({ state, onClose }: { state: DialogMode | null; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null)
  const [name, setName] = useState('')
  useEffect(() => {
    if (!state) return
    setName(state.mode === 'rename' ? state.view.name : '')
    ref.current?.showModal()
  }, [state])
  const taken = name.trim() !== '' && nameTaken(name, state?.mode === 'rename' ? state.view.id : undefined)
  const ok = name.trim() !== '' && !taken
  const submit = () => {
    if (!ok || !state) return
    if (state.mode === 'save') saveAsNew(name)
    else renameView(state.view.id, name)
    ref.current?.close()
  }
  return (
    <dialog ref={ref} onClose={onClose}
      className="m-auto w-[22rem] rounded-[10px] border border-border bg-card p-4 text-foreground shadow-[0_10px_30px_rgb(16_24_40/.16)] backdrop:bg-[rgb(13_16_21/.32)]">
      <form method="dialog" onSubmit={(e) => { e.preventDefault(); submit() }} className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold">{c(state?.mode === 'rename' ? 'views.dialogRename' : 'views.dialogSave')}</h2>
        <label htmlFor="p368-view-name" className="text-[11px] font-medium text-muted-foreground">{c('views.nameLabel')}</label>
        <input id="p368-view-name" autoFocus autoComplete="off" value={name} onChange={(e) => setName(e.target.value)}
          aria-invalid={taken}
          className="h-7 rounded-md border border-input bg-card px-2 text-xs focus:outline-2 focus:outline-offset-1 focus:outline-ring aria-invalid:border-danger" />
        {taken && <p className="text-[11px] text-danger">{c('views.nameTaken')}</p>}
        {state?.mode === 'save' && <p className="text-[11px] leading-snug text-muted-foreground">{c('views.dialogCaptures')}</p>}
        <div className="mt-2 flex justify-end gap-2">
          <button type="button" onClick={() => ref.current?.close()} className="h-7 rounded-md px-3 text-xs text-muted-foreground hover:bg-accent">{c('views.cancel')}</button>
          <button type="submit" disabled={!ok} data-btn="" className="h-7 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground disabled:opacity-50">
            {c(state?.mode === 'rename' ? 'views.dialogRename' : 'views.dialogSave')}
          </button>
        </div>
      </form>
    </dialog>
  )
}

function useOutside(open: boolean, close: () => void) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const down = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && close()
    const key = (e: KeyboardEvent) => e.key === 'Escape' && close()
    document.addEventListener('mousedown', down)
    document.addEventListener('keydown', key)
    return () => {
      document.removeEventListener('mousedown', down)
      document.removeEventListener('keydown', key)
    }
  }, [open, close])
  return ref
}

function MenuItem({ icon: Icon, children, onClick, danger, disabled }: { icon: typeof Save; children: ReactNode; onClick: () => void; danger?: boolean; disabled?: boolean }) {
  return (
    <button type="button" role="menuitem" disabled={disabled} onClick={onClick}
      className={`flex h-7 w-full items-center gap-2 rounded px-2 text-start text-xs hover:bg-accent disabled:opacity-50 ${danger ? 'text-danger' : ''}`}>
      <Icon className="size-3.5 shrink-0" aria-hidden />
      <span className="flex-1 truncate">{children}</span>
    </button>
  )
}

/** The five actions for one saved view. `onDialog` opens Save as new / Rename. */
function ViewActions({ view, close, onDialog }: { view: SavedView; close: () => void; onDialog: (d: DialogMode) => void }) {
  const active = useProto((s) => s.activeViewId === view.id)
  const modified = useProto(isModified)
  return (
    <div role="menu" className="flex w-56 flex-col">
      <MenuItem icon={Check} disabled={!active || !modified} onClick={() => { updateActive(); close() }}>{c('views.update', { name: view.name })}</MenuItem>
      <MenuItem icon={Plus} onClick={() => { close(); onDialog({ mode: 'save' }) }}>{c('views.saveAs')}</MenuItem>
      <MenuItem icon={Pencil} onClick={() => { close(); onDialog({ mode: 'rename', view }) }}>{c('views.rename')}</MenuItem>
      <MenuItem icon={Star} onClick={() => { toggleDefault(view.id); close() }}>{c(view.starred ? 'views.clearDefault' : 'views.setDefault')}</MenuItem>
      <div className="my-0.5 border-t border-divider" />
      <MenuItem icon={Trash2} danger onClick={() => { deleteView(view.id); close() }}>{c('views.delete')}</MenuItem>
    </div>
  )
}

function ViewBadges({ view }: { view: SavedView }) {
  return (
    <>
      {!view.criteria && (
        <span title={c('views.layoutOnlyHint')} className="rounded border border-border px-1 text-[10px] uppercase tracking-wide text-ink-3">{c('views.layoutOnly')}</span>
      )}
      {view.starred && <Star className="size-3 shrink-0 fill-current text-attention" aria-label={c('views.starred')} />}
    </>
  )
}

// ---------- A: the views rail ----------------------------------------------------------

function RailRow({ active, icon: Icon, label, count, tone, onClick, children }: {
  active: boolean; icon?: typeof Layers; label: string; count?: string; tone?: string; onClick: () => void; children?: ReactNode
}) {
  return (
    <div className={`group relative flex h-7 items-center rounded-md text-xs ${active ? 'bg-primary-050 font-semibold text-foreground' : 'text-muted-foreground hover:bg-accent hover:text-foreground'}`}>
      {active && <span className="absolute inset-y-1 start-0 w-[3px] rounded-full bg-cursor" aria-hidden />}
      <button type="button" aria-current={active || undefined} onClick={onClick} className="flex h-full min-w-0 flex-1 items-center gap-2 ps-2.5 pe-1 text-start">
        {Icon && <Icon className="size-3.5 shrink-0" aria-hidden />}
        <span className="min-w-0 flex-1 truncate">{label}</span>
      </button>
      {children}
      {count !== undefined && <span className={`pe-2 font-mono text-[11px] ${tone ?? 'text-ink-3'}`}>{count}</span>}
    </div>
  )
}

export function ViewsRail({ onDialog }: { onDialog: (d: DialogMode) => void }) {
  const lens = useProto((s) => s.lens)
  const views = useProto((s) => s.views)
  const activeId = useProto((s) => s.activeViewId)
  const count = useCounts()
  const [menu, setMenu] = useState<string | null>(null)
  const ref = useOutside(menu !== null, () => setMenu(null))
  return (
    <nav aria-label={c('views.switcher')} className="flex w-[220px] shrink-0 flex-col gap-px border-e border-border bg-card-2 p-2">
      <div className="px-2 pb-1.5 pt-1 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-ink-3" title={c('lens.hint')}>{c('lens.heading')}</div>
      {LENSES.map((l) => {
        const n = count(l.key)
        return (
          <RailRow key={l.key} active={lens === l.key} icon={LENS_ICON[l.key]} label={c(`lens.${l.key}`)} count={n}
            tone={l.key === 'attention' && n !== '—' && parseInt(n) > 0 ? 'text-danger font-semibold' : undefined}
            onClick={() => setLens(l.key)} />
        )
      })}
      <div className="mt-3 flex items-center px-2 pb-1.5 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-ink-3">
        <span className="flex-1">{c('views.heading')}</span>
      </div>
      <div ref={ref} className="flex flex-col gap-px">
        {views.length === 0 && <p className="px-2 text-[11px] text-ink-3">{c('views.none')}</p>}
        {views.map((v) => (
          <RailRow key={v.id} active={activeId === v.id} label={v.name} onClick={() => applyView(v.id)}>
            <span className="flex items-center gap-1 pe-1">
              <ViewBadges view={v} />
              {activeId === v.id && <ModifiedDot />}
            </span>
            <button type="button" aria-label={c('views.menu')} aria-haspopup="menu" aria-expanded={menu === v.id}
              onClick={() => setMenu(menu === v.id ? null : v.id)}
              className={`me-1 rounded p-0.5 hover:bg-card ${menu === v.id ? '' : 'opacity-0 group-hover:opacity-100 focus-visible:opacity-100'}`}>
              <MoreHorizontal className="size-3.5" aria-hidden />
            </button>
            {menu === v.id && (
              <div className="absolute start-full top-0 z-50 ms-1 rounded-lg border border-border bg-card p-1 shadow-[0_10px_30px_rgb(16_24_40/.16)]">
                <ViewActions view={v} close={() => setMenu(null)} onDialog={onDialog} />
              </div>
            )}
          </RailRow>
        ))}
      </div>
      <div className="mt-auto pt-2">
        <button type="button" onClick={() => onDialog({ mode: 'save' })}
          className="flex h-7 w-full items-center gap-2 rounded-md px-2.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground">
          <Plus className="size-3.5" aria-hidden />
          {c('views.save')}
        </button>
      </div>
    </nav>
  )
}

// ---------- B / C: lens tabs + views menu -----------------------------------------------

export function LensTabs() {
  const lens = useProto((s) => s.lens)
  const count = useCounts()
  return (
    <div role="tablist" aria-label={c('lens.heading')} title={c('lens.hint')} className="flex items-end gap-0.5 overflow-x-auto">
      {LENSES.map((l) => {
        const Icon = LENS_ICON[l.key]
        const on = lens === l.key
        const n = count(l.key)
        return (
          <button key={l.key} type="button" role="tab" aria-selected={on} onClick={() => setLens(l.key)}
            className={`relative inline-flex h-8 shrink-0 items-center gap-1.5 px-2.5 text-xs ${on ? 'font-semibold text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
            <Icon className="size-3.5" aria-hidden />
            {c(`lens.${l.key}`)}
            <span className={`rounded-full px-1.5 font-mono text-[10.5px] leading-4 ${on ? 'bg-primary-050 text-primary' : 'bg-muted text-muted-foreground'} ${l.key === 'attention' && n !== '—' && parseInt(n) > 0 ? '!bg-danger-050 !text-danger' : ''}`}>{n}</span>
            {on && <span className="absolute inset-x-1.5 bottom-0 h-[2px] rounded-full bg-cursor" aria-hidden />}
          </button>
        )
      })}
    </div>
  )
}

export function ViewsMenu({ onDialog, align = 'start' }: { onDialog: (d: DialogMode) => void; align?: 'start' | 'end' }) {
  const views = useProto((s) => s.views)
  const active = useProto(activeView)
  const [open, setOpen] = useState(false)
  const [sub, setSub] = useState(false)
  const ref = useOutside(open, () => { setOpen(false); setSub(false) })
  return (
    <div ref={ref} className="relative">
      <button type="button" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}
        className="inline-flex h-7 max-w-64 items-center gap-1.5 rounded-md border border-border-strong bg-card px-2 text-xs hover:bg-accent">
        <span className="text-muted-foreground">{c('views.switcher')}:</span>
        <span className="truncate font-semibold">{active?.name ?? c('views.unsaved')}</span>
        <ModifiedDot />
        <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
      </button>
      {open && (
        <div className={`absolute top-full z-50 mt-1 flex w-72 flex-col rounded-lg border border-border bg-card p-1 shadow-[0_10px_30px_rgb(16_24_40/.16)] ${align === 'end' ? 'end-0' : 'start-0'}`}>
          <div className="px-2 py-1 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-ink-3">{c('views.heading')}</div>
          {views.map((v) => (
            <button key={v.id} type="button" onClick={() => { applyView(v.id); setOpen(false) }}
              className={`flex h-7 items-center gap-2 rounded px-2 text-start text-xs hover:bg-accent ${active?.id === v.id ? 'bg-primary-050 font-semibold' : ''}`}>
              <span className="min-w-0 flex-1 truncate">{v.name}</span>
              <ViewBadges view={v} />
            </button>
          ))}
          <div className="my-0.5 border-t border-divider" />
          {active ? (
            sub ? (
              <ViewActions view={active} close={() => { setOpen(false); setSub(false) }} onDialog={onDialog} />
            ) : (
              <MenuItem icon={MoreHorizontal} onClick={() => setSub(true)}>{c('views.menu')}: {active.name}</MenuItem>
            )
          ) : (
            <MenuItem icon={Save} onClick={() => { setOpen(false); onDialog({ mode: 'save' }) }}>{c('views.save')}</MenuItem>
          )}
        </div>
      )}
    </div>
  )
}

// ---------- grid bar pieces --------------------------------------------------------------

export function ViewTitle() {
  const active = useProto(activeView)
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5">
      <span className="truncate text-[13px] font-semibold">{active?.name ?? c('views.unsaved')}</span>
      <ModifiedDot />
    </span>
  )
}

/** "40 deliveries" · "12 of 40 shown" · the cut line. Counts ignore column filters (366). */
export function RowSummary() {
  const rows = useProto((s) => s.rows)
  const applied = useProto((s) => s.applied)
  const lens = useProto((s) => s.lens)
  const shown = useProto((s) => s.shown)
  const filterModel = useProto((s) => s.filterModel)
  const gridApi = useProto((s) => s.gridApi)
  const searching = useProto((s) => s.searching)
  if (rows === null) return <span className="text-xs text-ink-3">{searching ? c('query.searching') : c('grid.before')}</span>
  const total = Number(lensCount(rows, lens, false))
  const filtered = Object.keys(filterModel ?? {}).length > 0
  const cut = isCut({ rows, applied })
  return (
    <span className="inline-flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
      <span className="rounded-full bg-muted px-2 font-mono text-[11px] leading-[18px] text-muted-foreground">
        {filtered ? c('grid.shown', { shown, total }) : c('grid.rows', { count: total })}
        {cut ? '+' : ''}
      </span>
      {filtered && (
        <button type="button" onClick={() => gridApi?.setFilterModel(null)} className="text-[11.5px] text-primary underline-offset-2 hover:underline">
          {c('grid.clearFilters')}
        </button>
      )}
      {cut && (
        <span className="inline-flex items-center gap-1 text-[11.5px] text-attention-800">
          <AlertTriangle className="size-3" aria-hidden />
          {c('grid.cut', { limit: applied?.limit ?? 200 })}
        </span>
      )}
    </span>
  )
}

export function GridTools({ withInspectorToggle = true, iconOnly = false }: { withInspectorToggle?: boolean; iconOnly?: boolean }) {
  const open = useProto((s) => s.inspectorOpen)
  const gridApi = useProto((s) => s.gridApi)
  const rows = useProto((s) => s.rows)
  const ghost = 'inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-xs text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-50'
  return (
    <span className="inline-flex items-center gap-0.5">
      <button type="button" className={ghost} onClick={() => toast.info('Columns chooser: today’s, unchanged')}>
        <Columns3 className="size-3.5" aria-hidden />
        <span className={iconOnly ? 'sr-only' : ''}>{c('grid.columns')}</span>
      </button>
      <button type="button" className={ghost} disabled={!rows?.length} onClick={() => gridApi && void exportDeliveriesToExcel(gridApi)}>
        <Download className="size-3.5" aria-hidden />
        <span className={iconOnly ? 'sr-only' : ''}>{c('grid.export')}</span>
      </button>
      {withInspectorToggle && (
        <button type="button" className={ghost} aria-pressed={open} onClick={() => useProto.setState({ inspectorOpen: !open })}
          title={c(open ? 'insp.collapse' : 'insp.expand')}>
          {open ? <PanelRightClose className="size-3.5 rtl:rotate-180" aria-hidden /> : <PanelRightOpen className="size-3.5 rtl:rotate-180" aria-hidden />}
          <span className={iconOnly ? 'sr-only' : ''}>{c('grid.inspector')}</span>
        </button>
      )}
    </span>
  )
}

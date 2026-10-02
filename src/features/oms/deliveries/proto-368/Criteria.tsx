/* PROTOTYPE 368 — the two criteria editors: tokens (A, B) and a labelled panel (C).
 * Both edit the same DRAFT; only Search (or Enter in a field) runs it. */
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Filter, Loader2, PanelLeftClose, PanelLeftOpen, Plus, RotateCcw, Search, X } from 'lucide-react'
import { c } from './copy'
import {
  FIELDS,
  fieldValue,
  isSet,
  pendingFields,
  rangeLabel,
  isoToday,
  type DateRange,
  type FieldKey,
  type ProtoCriteria,
} from './model'
import { discardDraft, runSearch, setDraft, useProto } from './store'
import { Kbd } from './Inspector'

const CONTROL =
  'h-[26px] w-full rounded-md border border-input bg-card px-2 text-xs focus:outline-2 focus:outline-offset-1 focus:outline-ring'

export function displayValue(k: FieldKey, v: unknown): string {
  if (v === null || v === undefined || v === '') return ''
  if (k === 'range') return rangeLabel(v as DateRange, (key) => c(key))
  if (k === 'isExpress') return v ? c('yes') : c('no')
  return String(v)
}

/** One field's control, by kind. Enter = Search (the deliberate act, 365). */
export function FieldControl({ k, autoFocus, onEnter }: { k: FieldKey; autoFocus?: boolean; onEnter?: () => void }) {
  const draft = useProto((s) => s.draft)
  const f = FIELDS.find((x) => x.key === k)!
  const value = fieldValue(draft, k)
  const id = `p368-${k}`
  const enter = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      e.stopPropagation()
      onEnter?.()
      void runSearch()
    }
  }
  const patch = (v: unknown) => setDraft({ [k]: v } as Partial<ProtoCriteria>)

  if (f.kind === 'range') {
    const r = value as DateRange | null
    return (
      <div className="flex flex-col gap-1">
        <select id={id} autoFocus={autoFocus} className={CONTROL} onKeyDown={enter} value={r?.preset ?? ''}
          onChange={(e) => {
            const p = e.target.value
            patch(p === '' ? null : p === 'custom' ? { preset: 'custom', from: isoToday(), to: isoToday() } : { preset: p })
          }}>
          <option value="">{c('any')}</option>
          {(['today', 'yesterday', 'last3', 'last7', 'custom'] as const).map((p) => (
            <option key={p} value={p}>{c(`range.${p}`)}</option>
          ))}
        </select>
        {r?.preset === 'custom' && (
          <div className="grid grid-cols-2 gap-1">
            <input type="date" aria-label={c('range.from')} className={CONTROL} value={r.from ?? ''} onKeyDown={enter}
              onChange={(e) => patch({ ...r, from: e.target.value })} />
            <input type="date" aria-label={c('range.to')} className={CONTROL} value={r.to ?? ''} onKeyDown={enter}
              onChange={(e) => patch({ ...r, to: e.target.value })} />
          </div>
        )}
      </div>
    )
  }
  if (f.kind === 'select' || f.kind === 'tri') {
    const opts = f.kind === 'tri' ? [['true', c('yes')], ['false', c('no')]] : (f.options ?? []).map((o) => [o, o])
    return (
      <select id={id} autoFocus={autoFocus} className={CONTROL} onKeyDown={enter}
        value={value === null || value === undefined ? '' : String(value)}
        onChange={(e) => {
          const v = e.target.value
          patch(v === '' ? null : f.kind === 'tri' ? v === 'true' : v)
        }}>
        <option value="">{c('any')}</option>
        {opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    )
  }
  return (
    <input id={id} autoFocus={autoFocus} autoComplete="off" className={CONTROL + (f.kind !== 'text' || k !== 'customerPhone' ? '' : '')}
      type={f.kind === 'number' ? 'number' : 'text'} min={1} max={20000} onKeyDown={enter}
      value={value === null || value === undefined ? '' : String(value)}
      onChange={(e) => {
        const v = e.target.value
        patch(v === '' ? null : f.kind === 'number' ? Number(v) : v)
      }} />
  )
}

function usePending() {
  const draft = useProto((s) => s.draft)
  const applied = useProto((s) => s.applied)
  return pendingFields(draft, applied)
}

export function SearchButton({ compact = false }: { compact?: boolean }) {
  const searching = useProto((s) => s.searching)
  const pending = usePending().length > 0
  return (
    <button type="button" data-btn="" onClick={() => void runSearch()} disabled={searching}
      className={`relative inline-flex h-7 items-center gap-1.5 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-primary/85 disabled:opacity-60 ${compact ? '' : 'min-w-24 justify-center'}`}>
      {searching ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <Search className="size-3.5" aria-hidden />}
      {searching ? c('query.searching') : c('query.search')}
      {pending && !searching && (
        <span className="absolute -end-1 -top-1 size-2.5 rounded-full border-2 border-card bg-attention" aria-hidden />
      )}
    </button>
  )
}

export function PendingNote() {
  const pending = usePending()
  if (!pending.length) return null
  return (
    <span className="inline-flex items-center gap-1.5 text-[11.5px] font-medium text-attention-800" role="status">
      <span className="size-1.5 rounded-full bg-attention" aria-hidden />
      {c('query.pending', { count: pending.length })}
      <button type="button" onClick={discardDraft} className="inline-flex items-center gap-0.5 rounded px-1 text-muted-foreground underline-offset-2 hover:underline">
        <RotateCcw className="size-3" aria-hidden />
        {c('query.discard')}
      </button>
    </span>
  )
}

function Popover({ onClose, children, className = '' }: { onClose: () => void; children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const down = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && onClose()
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }
    const id = setTimeout(() => document.addEventListener('mousedown', down))
    document.addEventListener('keydown', key)
    return () => {
      clearTimeout(id)
      document.removeEventListener('mousedown', down)
      document.removeEventListener('keydown', key)
    }
  }, [onClose])
  return (
    <div ref={ref} className={`absolute start-0 top-full z-50 mt-1 rounded-lg border border-border bg-card p-2 shadow-[0_10px_30px_rgb(16_24_40/.16)] ${className}`}>
      {children}
    </div>
  )
}

/** A token: "Field: value", click to edit, × to drop. Flagged while it differs from what ran. */
function Token({ k, editing, setEditing }: { k: FieldKey; editing: FieldKey | null; setEditing: (k: FieldKey | null) => void }) {
  const draft = useProto((s) => s.draft)
  const applied = useProto((s) => s.applied)
  const pending = pendingFields(draft, applied).includes(k)
  const removed = !isSet(draft, k) && editing !== k
  const shown = removed ? displayValue(k, fieldValue(applied!, k)) : displayValue(k, fieldValue(draft, k))
  const base =
    'inline-flex h-6 items-center rounded-md border text-xs ' +
    (pending ? 'border-dashed border-attention bg-attention-050 ' : 'border-border-strong bg-card-2 ')
  return (
    <span className="relative">
      <span className={base + (removed ? 'opacity-70' : '')}>
        <button type="button" onClick={() => setEditing(editing === k ? null : k)}
          className="inline-flex h-full items-center gap-1 rounded-s-md ps-2 pe-1 hover:bg-accent"
          title={removed ? c('query.removed') : undefined}>
          <span className="text-muted-foreground">{c(`field.${k}`)}:</span>
          <span className={`font-medium ${removed ? 'line-through' : ''} ${/No$|no\.$|^Store$|^Mobile$/.test(c(`field.${k}`)) ? 'font-mono' : ''}`}>
            {shown || '…'}
          </span>
        </button>
        {k !== 'limit' && !removed && (
          <button type="button" aria-label={c('query.remove', { field: c(`field.${k}`) })}
            onClick={() => setDraft({ [k]: null } as Partial<ProtoCriteria>)}
            className="inline-flex h-full items-center rounded-e-md px-1 text-muted-foreground hover:bg-accent">
            <X className="size-3" aria-hidden />
          </button>
        )}
        {removed && (
          <button type="button" onClick={() => setDraft({ [k]: fieldValue(applied!, k) } as Partial<ProtoCriteria>)}
            aria-label={c('query.discard')} className="inline-flex h-full items-center rounded-e-md px-1 text-muted-foreground hover:bg-accent">
            <RotateCcw className="size-3" aria-hidden />
          </button>
        )}
      </span>
      {editing === k && (
        <Popover onClose={() => setEditing(null)} className="w-60">
          <label htmlFor={`p368-${k}`} className="mb-1 block text-[11px] font-medium text-muted-foreground">{c(`field.${k}`)}</label>
          <FieldControl k={k} autoFocus onEnter={() => setEditing(null)} />
          {k === 'limit' && <p className="mt-1.5 text-[11px] leading-snug text-muted-foreground">{c('query.limitHint', { n: draft.limit ?? 200 })}</p>}
          <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1"><Kbd>↵</Kbd> {c('query.enterSearches')}</span>
            <button type="button" className="rounded px-1.5 py-0.5 hover:bg-accent" onClick={() => setEditing(null)}>{c('query.done')}</button>
          </div>
        </Popover>
      )}
    </span>
  )
}

/** Token bar (variants A and B). */
export function QueryTokens({ trailing }: { trailing?: ReactNode }) {
  const draft = useProto((s) => s.draft)
  const applied = useProto((s) => s.applied)
  const [editing, setEditing] = useState<FieldKey | null>(null)
  const [adding, setAdding] = useState(false)
  const keys = FIELDS.map((f) => f.key).filter(
    (k) => k !== 'limit' && (isSet(draft, k) || editing === k || (applied && isSet(applied, k))),
  )
  return (
    <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label={c('query.label')}>
      <Filter className="size-3.5 text-ink-3" aria-hidden />
      {keys.map((k) => <Token key={k} k={k} editing={editing} setEditing={setEditing} />)}
      <span className="relative">
        <button type="button" data-query-focus="" onClick={() => setAdding((a) => !a)} aria-expanded={adding}
          className="inline-flex h-6 items-center gap-1 rounded-md border border-dashed border-border-strong px-2 text-xs text-muted-foreground hover:bg-accent hover:text-foreground">
          <Plus className="size-3" aria-hidden />
          {c('query.add')}
        </button>
        {adding && (
          <Popover onClose={() => setAdding(false)} className="w-72 p-1">
            <div className="px-2 py-1 text-[11px] font-medium text-muted-foreground">{c('query.addMenu')}</div>
            {(['when', 'find', 'narrow', 'limit'] as const).map((g) => (
              <div key={g} className="border-t border-divider py-0.5 first-of-type:border-t-0">
                {FIELDS.filter((f) => f.group === g).map((f) => {
                  const used = isSet(draft, f.key)
                  return (
                    <button key={f.key} type="button"
                      onClick={() => {
                        setAdding(false)
                        if (f.key === 'range' && !used) setDraft({ range: { preset: 'today' } })
                        setEditing(f.key)
                      }}
                      className="flex h-7 w-full items-center gap-2 rounded px-2 text-start text-xs hover:bg-accent">
                      <span className="flex-1">{c(`field.${f.key}`)}</span>
                      <span className={`text-[10.5px] ${used ? 'text-success' : 'text-ink-3'}`}>
                        {used ? c('query.inQuery') : f.key === 'range' ? c('query.pairHint') : ''}
                      </span>
                    </button>
                  )
                })}
              </div>
            ))}
          </Popover>
        )}
      </span>
      <span className="flex-1" />
      {/* The limit is always visible: it decides whether the page was cut. */}
      <Token k="limit" editing={editing} setEditing={setEditing} />
      <PendingNote />
      {trailing}
      <SearchButton />
    </div>
  )
}

/** Read-only applied-criteria chips (C, when the panel is collapsed). */
export function AppliedSummary() {
  const applied = useProto((s) => s.applied)
  if (!applied) return null
  const keys = FIELDS.map((f) => f.key).filter((k) => isSet(applied, k))
  return (
    <div className="flex flex-wrap items-center gap-1 text-[11.5px]">
      <span className="text-ink-3">{c('query.applied')}:</span>
      {keys.map((k) => (
        <span key={k} className="inline-flex h-5 items-center gap-1 rounded border border-border bg-card-2 px-1.5">
          <span className="text-muted-foreground">{c(`field.${k}`)}</span>
          <span className="font-medium">{displayValue(k, fieldValue(applied, k))}</span>
        </span>
      ))}
    </div>
  )
}

/** Labelled criteria panel (variant C). */
export function CriteriaPanel() {
  const open = useProto((s) => s.criteriaOpen)
  const pending = usePending()
  const applied = useProto((s) => s.applied)
  if (!open) {
    const n = applied ? FIELDS.filter((f) => isSet(applied, f.key)).length : 0
    return (
      <div className="flex w-9 shrink-0 flex-col items-center gap-2 border-e border-border bg-card-2 py-2">
        <button type="button" data-query-focus="" aria-label={c('query.expand')} title={c('query.expand')}
          onClick={() => useProto.setState({ criteriaOpen: true })} className="rounded p-1 text-muted-foreground hover:bg-accent">
          <PanelLeftOpen className="size-4 rtl:rotate-180" aria-hidden />
        </button>
        <Filter className="size-3.5 text-ink-3" aria-hidden />
        <span className="font-mono text-[11px] text-muted-foreground">{n}</span>
        {pending.length > 0 && <span className="size-2 rounded-full bg-attention" aria-hidden />}
      </div>
    )
  }
  return (
    <form className="flex w-[248px] shrink-0 flex-col border-e border-border bg-card-2" aria-label={c('query.label')}
      onSubmit={(e) => {
        e.preventDefault()
        void runSearch()
      }}>
      <div className="flex h-9 shrink-0 items-center gap-2 border-b border-divider px-3">
        <Filter className="size-3.5 text-ink-3" aria-hidden />
        <span className="flex-1 text-xs font-semibold">{c('query.label')}</span>
        <button type="button" aria-label={c('query.collapse')} title={c('query.collapse')}
          onClick={() => useProto.setState({ criteriaOpen: false })} className="rounded p-1 text-muted-foreground hover:bg-accent">
          <PanelLeftClose className="size-4 rtl:rotate-180" aria-hidden />
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2">
        {(['when', 'find', 'narrow', 'limit'] as const).map((g) => (
          <fieldset key={g} className="mb-3">
            <legend className="mb-1 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-ink-3">{c(`group.${g}`)}</legend>
            <div className="flex flex-col gap-1.5">
              {FIELDS.filter((f) => f.group === g).map((f) => {
                const changed = pending.includes(f.key)
                return (
                  <div key={f.key} className={`flex flex-col gap-0.5 ${changed ? '-ms-3 border-s-2 border-attention ps-2.5' : ''}`}>
                    <label htmlFor={`p368-${f.key}`} className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
                      {c(`field.${f.key}`)}
                      {changed && <span className="size-1.5 rounded-full bg-attention" aria-label={c('query.pending', { count: 1 })} />}
                    </label>
                    <FieldControl k={f.key} />
                    {f.key === 'limit' && <p className="text-[10.5px] leading-snug text-ink-3">{c('query.limitHint', { n: 200 })}</p>}
                  </div>
                )
              })}
            </div>
          </fieldset>
        ))}
      </div>
      <div className="flex shrink-0 flex-col gap-1.5 border-t border-border bg-card px-3 py-2">
        <PendingNote />
        <SearchButton />
      </div>
    </form>
  )
}

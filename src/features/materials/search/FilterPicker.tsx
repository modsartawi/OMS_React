import { useEffect, useRef, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronDown, Loader2 } from 'lucide-react'
import Ltr from '@/core/ui/Ltr'
import { fsi } from '@/core/util/bidi'

/**
 * One value a picker offers. `text` is built WHOLE by the caller — a level's `code · description`
 * through `formatPair` — and drawn isolated once: a machine-led value (a level pair, a vendor
 * number) in `Ltr`, free text (a brand, a status) in `<bdi>` (`.claude/rules/bidi.md`).
 */
export interface PickerOption {
  value: string
  text: string
  machine: boolean
}

/**
 * A multi-select drop-down for the search page's filters (ticket 451): the A–E levels, the four
 * typeahead side filters and the material type (`itemType`). Presentational — the caller owns the choices (they
 * live in the URL), the options and their query, and whether the panel is open (an option list is
 * only asked for while it is). AG Grid Community and the repo have no multi-select of their own.
 *
 * - `filterLocally` narrows `options` by what is typed (the levels, whose full list is loaded);
 *   without it the caller re-asks the door with `query` (the facets' typeahead).
 * - `entry` turns a typed value into a choice on Enter — the material type, which has no list.
 *
 * A chosen value the list does not hold (a choice read from a shared URL, a facet off the current
 * page of 50) is still drawn, checked, at the top, through `textOf`, so it can be taken off.
 */
export default function FilterPicker({
  name,
  label,
  selected,
  onChange,
  options,
  textOf,
  open,
  onOpenChange,
  query,
  onQuery,
  loading = false,
  failed = false,
  filterLocally = false,
  entry,
  placeholder,
}: {
  name: string
  label: string
  selected: readonly string[]
  /** An UPDATER over the current choices, not a new list: two quick ticks must compose even
   *  before the first has come back through the URL. */
  onChange: (change: (prev: string[]) => string[]) => void
  options: readonly PickerOption[]
  textOf: (value: string) => PickerOption
  open: boolean
  onOpenChange: (open: boolean) => void
  query: string
  onQuery: (query: string) => void
  loading?: boolean
  failed?: boolean
  filterLocally?: boolean
  entry?: (typed: string) => string | null
  placeholder?: string
}) {
  const { t } = useTranslation('materials-search')
  const root = useRef<HTMLDivElement>(null)

  // Close on a press outside the picker, or on Escape.
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) onOpenChange(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onOpenChange(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, onOpenChange])

  const chosen = new Set(selected)
  const needle = query.trim().toLowerCase()
  const listed = filterLocally && needle ? options.filter((o) => o.text.toLowerCase().includes(needle)) : options
  const offered = new Set(listed.map((o) => o.value))
  // The chosen values first (those the list does not hold drawn through `textOf`), then the rest.
  const items: PickerOption[] = [
    ...selected.map((v) => listed.find((o) => o.value === v) ?? options.find((o) => o.value === v) ?? textOf(v)),
    ...listed.filter((o) => !chosen.has(o.value)),
  ]

  const toggle = (value: string) =>
    onChange((prev) => (prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]))

  let status: ReactNode = null
  if (loading) status = (
    <span className="inline-flex items-center gap-1.5">
      <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
      {t('picker.loading')}
    </span>
  )
  else if (failed) status = <span className="text-danger-800">{t('picker.failed')}</span>
  else if (!entry && items.length === 0) status = t('picker.empty')

  return (
    <div ref={root} className="relative" data-material-filter={name}>
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => onOpenChange(!open)}
        className={
          'inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium ' +
          (selected.length > 0 ? 'border-primary/50 bg-primary-050 text-primary-800' : 'border-border/60 bg-background text-foreground')
        }
        data-picker-trigger=""
      >
        {label}
        {selected.length > 0 && (
          <span className="rounded-full bg-background px-1.5 text-[11px] tabular-nums" data-picker-count="">
            <Ltr>{selected.length}</Ltr>
          </span>
        )}
        <ChevronDown className="h-3 w-3 text-muted-foreground" aria-hidden />
      </button>
      {open && (
        <div
          role="dialog"
          aria-label={label}
          className="absolute start-0 top-full z-30 mt-1 flex w-80 flex-col gap-1.5 rounded-md border border-border bg-card p-2 shadow-pop"
          data-picker-panel=""
        >
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => onQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== 'Enter') return
              // Never the search form's Enter: the picker sits inside it, and narrowing a list is
              // not a search.
              e.preventDefault()
              if (!entry) return
              const value = entry(query)
              if (value !== null) onChange((prev) => (prev.includes(value) ? prev : [...prev, value]))
              if (value !== null) onQuery('')
            }}
            placeholder={placeholder ?? t('picker.find')}
            className="h-8 rounded-md border border-border/60 bg-background px-2 text-xs focus:border-primary/50 focus:outline-none"
            data-picker-query=""
          />
          <ul className="max-h-64 overflow-auto" aria-label={label} data-picker-options="">
            {items.map((o) => (
              <li key={o.value}>
                <label
                  className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-xs hover:bg-muted"
                  data-picker-option={o.value}
                  data-offered={offered.has(o.value) ? '' : undefined}
                  title={fsi(o.text)}
                >
                  <input type="checkbox" checked={chosen.has(o.value)} onChange={() => toggle(o.value)} />
                  <span className="truncate">{o.machine ? <Ltr>{o.text}</Ltr> : <bdi>{o.text}</bdi>}</span>
                </label>
              </li>
            ))}
          </ul>
          {status && <p className="px-1.5 text-[11px] text-muted-foreground" data-picker-status="">{status}</p>}
          {selected.length > 0 && (
            <button
              type="button"
              onClick={() => onChange(() => [])}
              className="self-end rounded px-1.5 py-0.5 text-[11px] text-muted-foreground hover:bg-muted"
              data-picker-clear=""
            >
              {t('picker.clear')}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

/** The three-state filter (blocked, serialised): any / yes / no, any by default. */
export function TriStateFilter({
  name,
  label,
  value,
  onChange,
}: {
  name: string
  label: string
  value: 'any' | 'yes' | 'no'
  onChange: (value: 'any' | 'yes' | 'no') => void
}) {
  const { t } = useTranslation('materials-search')
  return (
    <div role="group" aria-label={label} className="inline-flex items-center gap-1.5 text-xs" data-material-filter={name}>
      <span className="font-medium text-muted-foreground">{label}</span>
      <span className="inline-flex overflow-hidden rounded-md border border-border/60">
        {(['any', 'yes', 'no'] as const).map((v) => (
          <button
            key={v}
            type="button"
            aria-pressed={value === v}
            onClick={() => onChange(v)}
            className={'h-8 px-2.5 ' + (value === v ? 'bg-primary-050 font-medium text-primary-800' : 'bg-background hover:bg-muted')}
            data-tri={v}
          >
            {t(`tri.${v}`)}
          </button>
        ))}
      </span>
    </div>
  )
}

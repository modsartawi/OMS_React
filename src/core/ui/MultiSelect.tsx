import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronDown, Loader2, X } from 'lucide-react'
import { fsi } from '@/core/util/bidi'
import { DISABLED } from './control-classes'
import { FieldContext, useControlWiring } from './field-control'
import Input from './Input'
import Ltr from './Ltr'

/** How an option or a chosen chip reads: plain, greyed (an inactive choice), or flagged (an unknown one). */
export type MultiSelectTone = 'default' | 'muted' | 'danger'

/**
 * One value the select offers. `text` is built WHOLE by the caller (a `code · name` pair through
 * `formatPair`) and drawn isolated once: `machine` in `Ltr`, free text in `<bdi>` (`.claude/rules/bidi.md`).
 * `note` is a translated word drawn beside it (Inactive, Unknown).
 */
export interface MultiSelectOption {
  value: string
  text: string
  machine?: boolean
  tone?: MultiSelectTone
  note?: string
}

export interface MultiSelectProps {
  /** The chosen values, in order. */
  value: readonly string[]
  /** The next chosen values: a tick appends, an untick or a chip's remove takes the value out. */
  onChange: (next: string[]) => void
  options: readonly MultiSelectOption[]
  /**
   * How a chosen value the options do not hold is drawn (a code authored before the list existed):
   * it is kept and shown, never dropped. Default: the value itself, flagged.
   */
  optionOf?: (value: string) => MultiSelectOption
  /** The accessible name of the panel and its list (the Field's label, already translated). */
  label: string
  /** The trigger's id; inside a `Field` it is wired like `Input` (label, description, validity). */
  id?: string
  disabled?: boolean
  loading?: boolean
  failed?: boolean
  'data-testid'?: string
}

/**
 * The shared multi-select (oms ticket 636): the chosen values as removable chips, and an Add trigger
 * that opens a panel of every option, narrowed by what is typed, each with a check box.
 * Presentational — the caller owns the value, the options and their query.
 */
export default function MultiSelect({
  value,
  onChange,
  options,
  optionOf,
  label,
  id,
  disabled = false,
  loading = false,
  failed = false,
  'data-testid': testId,
}: MultiSelectProps) {
  const { t } = useTranslation('common')
  const wiring = useControlWiring({ id })
  const root = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')

  // Close on a press outside, or on Escape.
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const held = (v: string): MultiSelectOption =>
    options.find((o) => o.value === v) ?? optionOf?.(v) ?? { value: v, text: v, machine: true, tone: 'danger' }
  const chosen = new Set(value)
  const needle = query.trim().toLowerCase()
  const listed = needle ? options.filter((o) => o.text.toLowerCase().includes(needle)) : options
  const toggle = (v: string) => onChange(chosen.has(v) ? value.filter((x) => x !== v) : [...value, v])

  let status: ReactNode = null
  if (loading)
    status = (
      <span className="inline-flex items-center gap-1.5">
        <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
        {t('multiSelect.loading')}
      </span>
    )
  else if (failed) status = <span className="text-danger-800">{t('multiSelect.failed')}</span>
  else if (listed.length === 0) status = t('multiSelect.empty')

  return (
    <div ref={root} className="relative" data-testid={testId} data-multi-select="">
      <div
        className={
          'flex min-h-7 flex-wrap items-center gap-1 rounded-lg border bg-card p-1 ' +
          (wiring['aria-invalid'] ? 'border-danger' : 'border-input')
        }
      >
        {value.map((v) => {
          const o = held(v)
          return (
            <span
              key={v}
              className={`inline-flex h-6 items-center gap-1 rounded-full border ps-2 pe-0.5 text-xs ${TONE[o.tone ?? 'default']}`}
              data-chip={v}
              data-tone={o.tone ?? 'default'}
            >
              <OptionText option={o} />
              <button
                type="button"
                disabled={disabled}
                onClick={() => onChange(value.filter((x) => x !== v))}
                className={`inline-flex size-5 items-center justify-center rounded-full hover:bg-muted ${DISABLED}`}
                aria-label={t('multiSelect.remove', { value: fsi(o.text) })}
                title={t('multiSelect.remove', { value: fsi(o.text) })}
                data-chip-remove={v}
              >
                <X className="size-3" aria-hidden />
              </button>
            </span>
          )
        })}
        <button
          type="button"
          id={wiring.id}
          aria-describedby={wiring['aria-describedby']}
          aria-invalid={wiring['aria-invalid']}
          aria-expanded={open}
          aria-haspopup="dialog"
          disabled={disabled}
          onClick={() => setOpen(!open)}
          className={`inline-flex h-6 items-center gap-1 rounded-full px-2 text-xs text-muted-foreground hover:bg-muted ${DISABLED}`}
          data-multi-select-trigger=""
        >
          {value.length === 0 ? t('multiSelect.none') : t('multiSelect.add')}
          <ChevronDown className="h-3 w-3" aria-hidden />
        </button>
      </div>
      {open && !disabled && (
        <div
          role="dialog"
          aria-label={label}
          className="absolute start-0 top-full z-30 mt-1 flex w-80 max-w-full flex-col gap-1.5 rounded-md border border-border bg-card p-2 shadow-pop"
          data-multi-select-panel=""
        >
          {/* The panel's own box is never the Field's control: it takes none of the Field's wiring. */}
          <FieldContext.Provider value={null}>
            <Input
              type="text"
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                // Narrowing a list is never its form's submit.
                if (e.key === 'Enter') e.preventDefault()
              }}
              placeholder={t('multiSelect.find')}
              aria-label={t('multiSelect.find')}
            />
          </FieldContext.Provider>
          <ul className="max-h-64 overflow-auto" aria-label={label}>
            {listed.map((o) => (
              <li key={o.value}>
                <label
                  className={`flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-xs hover:bg-muted ${o.tone === 'muted' ? 'text-muted-foreground' : ''}`}
                  data-option={o.value}
                  data-tone={o.tone ?? 'default'}
                  title={fsi(o.text)}
                >
                  <input type="checkbox" checked={chosen.has(o.value)} onChange={() => toggle(o.value)} />
                  <OptionText option={o} />
                </label>
              </li>
            ))}
          </ul>
          {status && <p className="px-1.5 text-[11px] text-muted-foreground" data-multi-select-status="">{status}</p>}
        </div>
      )}
    </div>
  )
}

const TONE: Record<MultiSelectTone, string> = {
  default: 'border-primary bg-primary-050 text-primary-800',
  muted: 'border-border bg-muted text-muted-foreground',
  danger: 'border-danger-border bg-danger-050 text-danger-800',
}

function OptionText({ option }: { option: MultiSelectOption }) {
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5">
      <span className="truncate">{option.machine ? <Ltr>{option.text}</Ltr> : <bdi>{option.text}</bdi>}</span>
      {option.note && <span className="shrink-0 text-[10px] font-medium">{option.note}</span>}
    </span>
  )
}

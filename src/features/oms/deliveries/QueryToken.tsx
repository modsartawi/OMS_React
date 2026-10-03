import { useEffect, useId, useRef, type KeyboardEvent as ReactKeyboardEvent, type RefObject } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import { RotateCcw, X } from 'lucide-react'
import { takesEscape } from '@/core/commands/key-layer'
import KeyChord from '@/core/commands/KeyChord'
import Ltr from '@/core/ui/Ltr'
import { POPOVER } from '@/core/ui/overlay'
import { formatRange, fsi } from '@/core/util/bidi'
import { toIsoDate } from '@/core/util/date-format'
import {
  DATE_PRESETS,
  fieldDef,
  limitOf,
  withField,
  type DateEntry,
  type LookupName,
  type QueryCriteria,
  type QueryField,
  type TokenState,
} from './query-model'

/** A popover's control: 26px, the 3:1 field edge, the focus ring. */
const CONTROL =
  'h-[26px] w-full rounded-md border border-input bg-card px-2 text-xs ' +
  'focus:outline-2 focus:outline-offset-1 focus:outline-ring'

/** The dashed amber of an edit that has not been searched (368 §1; amber is attention). */
const STATE_CHIP: Record<TokenState, string> = {
  applied: 'border-border-strong bg-card-2',
  edited: 'border-dashed border-attention bg-attention-050',
  added: 'border-dashed border-attention bg-attention-050',
  ghost: 'border-dashed border-attention bg-attention-050 text-muted-foreground',
}

/** The lookup options each coded dropdown offers, by lookup. */
export type LookupOptions = Record<LookupName, readonly string[]>

/**
 * Closes a popover on a press outside it, and on an Esc that is its to take — the layers above
 * it (a dialog) keep theirs, and the screen's own Esc never sees one it took.
 */
export function usePopoverDismiss(
  open: boolean,
  ref: RefObject<HTMLElement | null>,
  onClose: (by: 'escape' | 'outside') => void,
) {
  const close = useRef(onClose)
  useEffect(() => {
    close.current = onClose
  })
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) close.current('outside')
    }
    const onKey = (e: KeyboardEvent) => {
      if (!takesEscape(e, ref.current)) return
      e.preventDefault()
      close.current('escape')
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, ref])
}

/** A token's value as it reads (`.claude/rules/bidi.md`): IDs mono and LTR, free text in a `<bdi>`. */
function TokenValue({ field, value }: { field: QueryField; value: QueryCriteria[QueryField] }) {
  const { t } = useTranslation()
  if (field === 'limit') return <Ltr>{limitOf({ limit: value as number | null })}</Ltr>
  if (value === null || value === undefined || value === '') return null
  if (field === 'date') {
    const date = value as DateEntry
    if (date.preset !== 'custom') return <>{t(`deliveries:query.date.${date.preset}`)}</>
    // One range, isolated once: two isolates would read backwards under RTL.
    return date.from && date.to ? <Ltr>{formatRange(date.from, date.to)}</Ltr> : <>{t('deliveries:query.date.custom')}</>
  }
  if (field === 'isExpress') return <>{t(value ? 'common:yes' : 'common:no')}</>
  switch (fieldDef(field).value) {
    case 'id':
      return (
        <span className="font-mono">
          <Ltr>{String(value)}</Ltr>
        </span>
      )
    case 'machine':
      return <Ltr>{String(value)}</Ltr>
    default:
      return <bdi>{String(value)}</bdi>
  }
}

/** A select whose blank option means "no filter". */
function AnySelect({
  id,
  value,
  options,
  onChange,
  autoFocus,
}: {
  id: string
  value: string
  options: readonly (readonly [string, string])[]
  onChange: (value: string) => void
  autoFocus: boolean
}) {
  const { t } = useTranslation('deliveries')
  return (
    <select id={id} autoFocus={autoFocus} className={CONTROL} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">{t('query.any')}</option>
      {options.map(([v, label]) => (
        <option key={v} value={v}>
          {label}
        </option>
      ))}
    </select>
  )
}

/** The field's own control, by kind. */
function FieldEditor({
  id,
  field,
  draft,
  lookups,
  onChange,
}: {
  id: string
  field: QueryField
  draft: QueryCriteria
  lookups: LookupOptions
  onChange: (draft: QueryCriteria) => void
}) {
  const { t } = useTranslation('deliveries')
  const control = fieldDef(field).control
  const set = (value: unknown) => onChange(withField(draft, field, value as QueryCriteria[QueryField]))

  switch (control.kind) {
    case 'date': {
      const date = draft.date
      return (
        <div className="flex flex-col gap-1.5">
          <select
            id={id}
            autoFocus
            className={CONTROL}
            value={date?.preset ?? 'today'}
            onChange={(e) => {
              const preset = e.target.value as DateEntry['preset']
              const today = toIsoDate(new Date())
              set(preset === 'custom' ? { preset, from: today, to: today } : { preset })
            }}
          >
            {DATE_PRESETS.map((preset) => (
              <option key={preset} value={preset}>
                {t(`query.date.${preset}`)}
              </option>
            ))}
          </select>
          {date?.preset === 'custom' && (
            <div className="grid grid-cols-2 gap-1.5">
              <input
                type="date"
                aria-label={t('query.date.from')}
                className={CONTROL}
                value={date.from ?? ''}
                onChange={(e) => set({ ...date, from: e.target.value || null })}
              />
              <input
                type="date"
                aria-label={t('query.date.to')}
                className={CONTROL}
                value={date.to ?? ''}
                onChange={(e) => set({ ...date, to: e.target.value || null })}
              />
            </div>
          )}
        </div>
      )
    }
    case 'lookup':
    case 'choice': {
      const options = control.kind === 'lookup' ? lookups[control.lookup] : control.options
      return (
        <AnySelect
          id={id}
          autoFocus
          value={(draft[field] as string | null) ?? ''}
          // A native <option> takes only a string: the server's description is isolated whole.
          options={options.map((o) => [o, fsi(o)] as const)}
          onChange={set}
        />
      )
    }
    case 'yesNo':
      return (
        <AnySelect
          id={id}
          autoFocus
          // Tri-state: Any omits the param entirely (it is not "No").
          value={draft.isExpress === null ? '' : String(draft.isExpress)}
          options={[
            ['true', t('common:yes')],
            ['false', t('common:no')],
          ]}
          onChange={(v) => set(v === '' ? null : v === 'true')}
        />
      )
    case 'limit':
      return (
        <input
          id={id}
          autoFocus
          type="number"
          min={1}
          max={20000}
          className={CONTROL}
          value={draft.limit ?? ''}
          onChange={(e) => set(e.target.value === '' ? null : Number(e.target.value))}
        />
      )
    case 'text':
      return (
        <input
          id={id}
          autoFocus
          type={control.type}
          autoComplete="off"
          className={CONTROL}
          value={(draft[field] as string | null) ?? ''}
          onChange={(e) => set(e.target.value)}
        />
      )
  }
}

/**
 * One token of the query bar (ticket 399, spec 380 L8): `Field: value`. A click opens that
 * field's own control in a popover, where **Enter searches** — prevented, so it is owned here
 * and never reaches the list's Enter-opens (368) — and **Done** closes without searching. ×
 * drops it; the Limit has none. A token edited, added or removed since the last search is
 * dashed amber, and a removed one stays as a struck-through ghost with a restore.
 */
export default function QueryToken({
  field,
  value,
  state,
  open,
  draft,
  lookups,
  align = 'start',
  onToggle,
  onClose,
  onDraft,
  onRemove,
  onRestore,
  onSearch,
}: {
  field: QueryField
  value: QueryCriteria[QueryField]
  state: TokenState
  open: boolean
  draft: QueryCriteria
  lookups: LookupOptions
  /** The Limit sits at the bar's inline end: its popover opens back toward the middle. */
  align?: 'start' | 'end'
  onToggle: () => void
  onClose: () => void
  onDraft: (draft: QueryCriteria) => void
  onRemove: () => void
  onRestore: () => void
  onSearch: () => void
}) {
  const { t } = useTranslation('deliveries')
  const wrapper = useRef<HTMLSpanElement>(null)
  const button = useRef<HTMLButtonElement>(null)
  const controlId = useId()
  const label = t(`query.field.${field}`)
  const ghost = state === 'ghost'

  usePopoverDismiss(open, wrapper, (by) => {
    onClose()
    if (by === 'escape') button.current?.focus()
  })

  /** Enter in the control searches, and the press is the control's (368's Enter finding). */
  function onKeyDown(e: ReactKeyboardEvent) {
    if (e.key !== 'Enter' || e.nativeEvent.isComposing) return
    // Enter on Done is Done.
    if (e.target instanceof HTMLButtonElement) return
    e.preventDefault()
    onClose()
    onSearch()
    button.current?.focus()
  }

  return (
    <span ref={wrapper} className="relative" data-query-token={field} data-token-state={state}>
      <span className={'inline-flex h-6 items-center rounded-md border text-xs ' + STATE_CHIP[state]}>
        <button
          ref={button}
          type="button"
          aria-expanded={open}
          aria-haspopup="dialog"
          onClick={onToggle}
          className={
            'inline-flex h-full items-center gap-1 ps-2 hover:bg-accent ' +
            (field === 'limit' ? 'rounded-md pe-2' : 'rounded-s-md pe-1')
          }
        >
          <span className="text-muted-foreground">{t('query.token', { field: label })}</span>
          <span className={'font-medium ' + (ghost ? 'line-through' : '')} data-token-value="">
            <TokenValue field={field} value={value} />
          </span>
          {ghost && <span className="sr-only">{t('query.removed')}</span>}
        </button>
        {ghost ? (
          <button
            type="button"
            aria-label={t('query.restore', { field: label })}
            title={t('query.restore', { field: label })}
            onClick={onRestore}
            className="inline-flex h-full items-center rounded-e-md px-1 text-muted-foreground hover:bg-accent"
            data-token-restore=""
          >
            <RotateCcw className="size-3" aria-hidden />
          </button>
        ) : (
          field !== 'limit' && (
            <button
              type="button"
              aria-label={t('query.remove', { field: label })}
              title={t('query.remove', { field: label })}
              onClick={onRemove}
              className="inline-flex h-full items-center rounded-e-md px-1 text-muted-foreground hover:bg-accent"
              data-token-remove=""
            >
              <X className="size-3" aria-hidden />
            </button>
          )
        )}
      </span>

      {open && (
        <div
          role="dialog"
          aria-label={label}
          onKeyDown={onKeyDown}
          className={`${POPOVER} absolute top-full z-50 mt-1 w-60 p-2 ${align === 'end' ? 'end-0' : 'start-0'}`}
          data-token-popover={field}
        >
          <label htmlFor={controlId} className="mb-1 block text-[11px] font-medium text-muted-foreground">
            {label}
          </label>
          <FieldEditor id={controlId} field={field} draft={draft} lookups={lookups} onChange={onDraft} />
          {field === 'limit' && (
            <p className="mt-1.5 text-[11px] leading-snug text-muted-foreground">
              <Trans
                t={t}
                i18nKey="query.limitHint"
                values={{ n: String(limitOf(draft)) }}
                components={{ n: <Ltr /> }}
              />
            </p>
          )}
          <div className="mt-2 flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <Trans t={t} i18nKey="query.enterSearches" components={{ keys: <KeyChord keys="Enter" /> }} />
            </span>
            <button
              type="button"
              className="rounded px-1.5 py-0.5 hover:bg-accent"
              onClick={() => {
                onClose()
                button.current?.focus()
              }}
              data-token-done=""
            >
              {t('query.done')}
            </button>
          </div>
        </div>
      )}
    </span>
  )
}

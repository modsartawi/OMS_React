import { useRef, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import { RotateCcw, X } from 'lucide-react'
import KeyChord from '@/core/commands/KeyChord'
import Button from '@/core/ui/Button'
import Field from '@/core/ui/Field'
import Input from '@/core/ui/Input'
import Ltr from '@/core/ui/Ltr'
import Select from '@/core/ui/Select'
import { POPOVER } from '@/core/ui/overlay'
import { usePopoverDismiss } from '@/core/ui/use-popover-dismiss'
import { formatRange, fsi } from '@/core/util/bidi'
import { toIsoDate } from '@/core/util/date-format'
import {
  DATE_PRESETS,
  fieldDef,
  LIMIT_MAX,
  limitIsInvalid,
  limitOf,
  MONEY_SOURCES,
  withField,
  type DateEntry,
  type LookupName,
  type QueryCriteria,
  type QueryField,
  type TokenState,
} from './query-model'

/** The dashed amber of an edit that has not been searched (368 §1; amber is attention). */
const STATE_CHIP: Record<TokenState, string> = {
  applied: 'border-border-strong bg-card-2',
  edited: 'border-dashed border-attention bg-attention-050',
  added: 'border-dashed border-attention bg-attention-050',
  ghost: 'border-dashed border-attention bg-attention-050 text-muted-foreground',
}

/** One coded option: the code the door takes, and its `code · description` label. */
export interface LookupOption {
  code: string
  label: string
}

/** The options each coded dropdown offers, by lookup. */
export type LookupOptions = Record<LookupName, readonly LookupOption[]>

/** A token's value as it reads (`.claude/rules/bidi.md`): IDs mono and LTR, free text in a `<bdi>`. */
function TokenValue({ field, value }: { field: QueryField; value: QueryCriteria[QueryField] }) {
  const { t } = useTranslation('orders')
  if (field === 'limit') return <Ltr>{limitOf({ limit: value as number | null })}</Ltr>
  if (value === null || value === undefined || value === '') return null
  if (field === 'date') {
    const date = value as DateEntry
    if (date.preset !== 'custom') return <>{t(`query.date.${date.preset}`)}</>
    // One range, isolated once: two isolates would read backwards under RTL.
    return date.from && date.to ? <Ltr>{formatRange(date.from, date.to)}</Ltr> : <>{t('query.date.custom')}</>
  }
  if (field === 'hasDelivery') return <>{t(value ? 'common:yes' : 'common:no')}</>
  if (field === 'moneySource') return <>{t(`moneySource.${String(value)}`)}</>
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

/** A select whose blank option means "no filter". Option labels are strings, so they take `fsi`. */
function AnySelect({
  value,
  options,
  onChange,
}: {
  value: string
  options: readonly (readonly [string, string])[]
  onChange: (value: string) => void
}) {
  const { t } = useTranslation('orders')
  return (
    <Select autoFocus className="w-full" value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">{t('query.any')}</option>
      {options.map(([v, label]) => (
        <option key={v} value={v}>
          {label}
        </option>
      ))}
    </Select>
  )
}

/** The field's own control, by kind, on the shared controls. */
function FieldEditor({
  field,
  draft,
  lookups,
  onChange,
}: {
  field: QueryField
  draft: QueryCriteria
  lookups: LookupOptions
  onChange: (draft: QueryCriteria) => void
}) {
  const { t } = useTranslation('orders')
  const control = fieldDef(field).control
  const set = (value: unknown) => onChange(withField(draft, field, value as QueryCriteria[QueryField]))

  switch (control.kind) {
    case 'date': {
      const date = draft.date
      return (
        <div className="flex flex-col gap-1.5">
          <Select
            autoFocus
            className="w-full"
            value={date?.preset ?? 'last3'}
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
          </Select>
          {date?.preset === 'custom' && (
            <div className="grid grid-cols-2 gap-1.5">
              <Field label={t('query.date.from')} invalid={!date.from}>
                <Input
                  type="date"
                  className="w-full"
                  value={date.from ?? ''}
                  onChange={(e) => set({ ...date, from: e.target.value || null })}
                  data-date-end="from"
                />
              </Field>
              <Field label={t('query.date.to')} invalid={!date.to}>
                <Input
                  type="date"
                  className="w-full"
                  value={date.to ?? ''}
                  onChange={(e) => set({ ...date, to: e.target.value || null })}
                  data-date-end="to"
                />
              </Field>
            </div>
          )}
        </div>
      )
    }
    case 'lookup':
      return (
        <AnySelect
          value={(draft[field] as string | null) ?? ''}
          // A native <option> takes only a string: the `code · description` pair is isolated whole.
          options={lookups[control.lookup].map((o) => [o.code, fsi(o.label)] as const)}
          onChange={set}
        />
      )
    case 'moneySource':
      return (
        <AnySelect
          value={draft.moneySource ?? ''}
          options={MONEY_SOURCES.map((source) => [source, t(`moneySource.${source}`)] as const)}
          onChange={(v) => set(v === '' ? null : v)}
        />
      )
    case 'yesNo':
      return (
        <AnySelect
          // Tri-state: Any omits the param entirely (it is not "No").
          value={draft.hasDelivery === null ? '' : String(draft.hasDelivery)}
          options={[
            ['true', t('common:yes')],
            ['false', t('common:no')],
          ]}
          onChange={(v) => set(v === '' ? null : v === 'true')}
        />
      )
    case 'limit':
      return (
        <Input
          autoFocus
          type="number"
          min={1}
          max={LIMIT_MAX}
          className="w-full"
          aria-invalid={limitIsInvalid(draft.limit)}
          value={draft.limit ?? ''}
          onChange={(e) => set(e.target.value === '' ? null : Number(e.target.value))}
        />
      )
    case 'text':
      return (
        <Input
          autoFocus
          type={control.type}
          autoComplete="off"
          className="w-full"
          value={(draft[field] as string | null) ?? ''}
          onChange={(e) => set(e.target.value)}
        />
      )
  }
}

/**
 * One token of the query bar: `Field: value` (the Deliveries list's token, with the order
 * criteria). A click opens that field's control in a popover, where **Enter searches** and
 * **Done** closes without searching. × drops it; the Limit has none. A token edited, added or
 * removed since the last search is dashed amber; a removed one stays as a struck ghost with a
 * restore. The Date reads "ignored" while an identifier is in the search (3391's date rule).
 */
export default function QueryToken({
  field,
  value,
  state,
  open,
  draft,
  lookups,
  ignored = false,
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
  /** The Date while an identifier is in the search: shown, but not sent. */
  ignored?: boolean
  align?: 'start' | 'end'
  onToggle: () => void
  onClose: () => void
  onDraft: (draft: QueryCriteria) => void
  onRemove: () => void
  onRestore: () => void
  onSearch: () => void
}) {
  const { t } = useTranslation('orders')
  const wrapper = useRef<HTMLSpanElement>(null)
  const button = useRef<HTMLButtonElement>(null)
  const label = t(`query.field.${field}`)
  const ghost = state === 'ghost'

  usePopoverDismiss(open, wrapper, (by) => {
    onClose()
    if (by === 'escape') button.current?.focus()
  })

  /** Enter in the control searches, and the press is the control's. */
  function onKeyDown(e: ReactKeyboardEvent) {
    if (e.key !== 'Enter' || e.nativeEvent.isComposing) return
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
          title={ignored ? t('query.dateIgnored') : undefined}
          onClick={onToggle}
          className={
            'inline-flex h-full items-center gap-1 ps-2 hover:bg-accent ' +
            (field === 'limit' ? 'rounded-md pe-2' : 'rounded-s-md pe-1')
          }
        >
          <span className="text-muted-foreground">{t('query.token', { field: label })}</span>
          <span className={'font-medium ' + (ghost || ignored ? 'line-through' : '')} data-token-value="">
            <TokenValue field={field} value={value} />
          </span>
          {ignored && (
            <span className="text-[10.5px] text-muted-foreground" data-token-ignored="">
              {t('query.date.ignored')}
            </span>
          )}
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
          className={`${POPOVER} absolute top-full z-50 mt-1 w-64 p-2 ${align === 'end' ? 'end-0' : 'start-0'}`}
          data-token-popover={field}
        >
          <Field
            label={label}
            hint={
              field === 'limit' ? (
                <Trans t={t} i18nKey="query.limitHint" values={{ n: String(limitOf(draft)) }} components={{ n: <Ltr /> }} />
              ) : fieldDef(field).group === 'find' ? (
                t('query.identifierHint')
              ) : undefined
            }
          >
            <FieldEditor field={field} draft={draft} lookups={lookups} onChange={onDraft} />
          </Field>
          <div className="mt-2 flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <Trans t={t} i18nKey="query.enterSearches" components={{ keys: <KeyChord keys="Enter" /> }} />
            </span>
            <Button
              variant="text"
              onClick={() => {
                onClose()
                button.current?.focus()
              }}
              data-token-done=""
            >
              {t('query.done')}
            </Button>
          </div>
        </div>
      )}
    </span>
  )
}

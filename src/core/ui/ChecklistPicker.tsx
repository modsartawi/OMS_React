import type { ReactNode } from 'react'
import { Loader2, X } from 'lucide-react'
import { fsi } from '@/core/util/bidi'
import Button from './Button'
import { DISABLED } from './control-classes'
import Input from './Input'
import Ltr from './Ltr'
import { canSelectAllShown, clearPicks, selectAllShown, shownOptions, togglePick, type ChecklistOption } from './checklist'

export type { ChecklistOption } from './checklist'

/** The picker's words, translated by the caller (each feature owns its namespace), as `PasteCodesDialog` does. */
export interface ChecklistPickerLabels {
  /** The accessible name of the list. */
  list: string
  /** The search box's placeholder and accessible name. */
  search: string
  selectAllShown: string
  clear: string
  /** "N picked", from the count of picks (shown or not). */
  picked: (count: number) => string
  /** Nothing is left to offer (every option excluded, or none at all). */
  empty: string
  /** The query matches nothing. */
  noMatch: string
  /** Server mode: the search is running. */
  loading?: string
  /** Server mode: the search failed. */
  failed?: string
  /** Server mode: the result hit its row cap — narrow the term. */
  capped?: string
  /** A chip's remove button, from the chip's label (already isolated by the picker). */
  removeChip?: (label: string) => string
}

export interface ChecklistPickerProps {
  /** Local mode: every option. Server mode: the current result set, already narrowed by the caller. */
  options: readonly ChecklistOption[]
  /** The picked values, in pick order. */
  picks: readonly string[]
  onPicksChange: (next: string[]) => void
  query: string
  onQueryChange: (query: string) => void
  labels: ChecklistPickerLabels
  /** `local` (default) narrows by name + description here; `server` draws `options` as given. */
  mode?: 'local' | 'server'
  /** Values never shown (the target already holds them). */
  exclude?: readonly string[]
  /**
   * The picked rows drawn as removable chips above the list (server mode, where a pick can be off
   * the current page). The caller resolves each pick to its option; omitted, no chip strip.
   */
  chips?: readonly ChecklistOption[]
  /** While a batch runs: nothing can be ticked, cleared or searched. */
  disabled?: boolean
  loading?: boolean
  failed?: boolean
  capped?: boolean
  /**
   * Server mode: the (trimmed) term the current `options` were fetched for. While it trails the
   * typed query (the debounce has not caught up) the picker reads as searching, never "no match".
   */
  optionsTerm?: string
  /** Extra content under a row (a refused item's server message), keyed by value. */
  rowNote?: (value: string) => ReactNode
  'data-testid'?: string
}

/**
 * The shared inline checklist picker (spec 805, ticket 806): a search box, a check box per row,
 * Select all shown, Clear, a picked count, optional picked chips, and the empty / no-match / cap
 * states. Inline in a dialog body, not a popover — the footer button that writes the picks is the
 * caller's. Presentational: the caller owns the options, the picks and the query; the list logic
 * is `./checklist`.
 */
export default function ChecklistPicker({
  options,
  picks,
  onPicksChange,
  query,
  onQueryChange,
  labels,
  mode = 'local',
  exclude,
  chips,
  disabled = false,
  loading = false,
  failed = false,
  capped = false,
  optionsTerm,
  rowNote,
  'data-testid': testId,
}: ChecklistPickerProps) {
  const narrow = mode === 'local'
  const shown = shownOptions(options, query, { exclude, narrow })
  const picked = new Set(picks)
  const nothingToOffer = shownOptions(options, '', { exclude }).length === 0
  const searched = query.trim() !== ''
  // The typed term the options do not reflect yet: searching, not a verdict on it.
  const trailing = !narrow && optionsTerm !== undefined && searched && optionsTerm !== query.trim()

  let status: ReactNode = null
  if (loading || trailing)
    status = (
      <span className="inline-flex items-center gap-1.5">
        <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
        {labels.loading}
      </span>
    )
  else if (failed) status = <span className="text-danger-800">{labels.failed}</span>
  else if (shown.length === 0) status = searched && (!narrow || !nothingToOffer) ? labels.noMatch : labels.empty
  else if (capped && searched && labels.capped) status = labels.capped

  return (
    <div className="flex min-h-0 flex-col gap-2" data-testid={testId} data-checklist-picker="">
      {chips && chips.length > 0 && (
        <ul className="flex flex-wrap gap-1" data-checklist-chips="">
          {chips.map((o) => (
            <li
              key={o.value}
              className="inline-flex h-6 items-center gap-1 rounded-full border border-primary bg-primary-050 ps-2 pe-0.5 text-xs text-primary-800"
              data-chip={o.value}
            >
              <RowLabel option={o} />
              <button
                type="button"
                disabled={disabled}
                onClick={() => onPicksChange(picks.filter((v) => v !== o.value))}
                className={`inline-flex size-5 items-center justify-center rounded-full hover:bg-muted ${DISABLED}`}
                aria-label={labels.removeChip?.(fsi(o.label))}
                title={labels.removeChip?.(fsi(o.label))}
                data-chip-remove={o.value}
              >
                <X className="size-3" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
      <Input
        type="search"
        wrapperClassName="w-full"
        value={query}
        disabled={disabled}
        onChange={(e) => onQueryChange(e.target.value)}
        onKeyDown={(e) => {
          // Narrowing a list is never its form's submit.
          if (e.key === 'Enter') e.preventDefault()
        }}
        placeholder={labels.search}
        aria-label={labels.search}
        data-checklist-search=""
      />
      <div className="flex items-center gap-1">
        <Button
          variant="text"
          disabled={disabled || !canSelectAllShown(picks, shown)}
          onClick={() => onPicksChange(selectAllShown(picks, shown))}
          data-checklist-select-all=""
        >
          {labels.selectAllShown}
        </Button>
        <Button
          variant="text"
          disabled={disabled || picks.length === 0}
          onClick={() => onPicksChange(clearPicks())}
          data-checklist-clear=""
        >
          {labels.clear}
        </Button>
        <span className="ms-auto text-xs text-muted-foreground" aria-live="polite" data-checklist-count={picks.length}>
          {labels.picked(picks.length)}
        </span>
      </div>
      {shown.length > 0 && (
        <ul className="flex max-h-[18rem] flex-col gap-1 overflow-y-auto" aria-label={labels.list}>
          {shown.map((o) => {
            const on = picked.has(o.value)
            const note = rowNote?.(o.value)
            return (
              <li key={o.value}>
                <label
                  className={
                    'flex items-start gap-2 rounded-lg border px-3 py-2 ' +
                    (o.disabled ? 'cursor-not-allowed border-border/60 bg-muted/40 text-muted-foreground ' : 'cursor-pointer hover:bg-muted ') +
                    (on ? 'border-primary bg-primary-050' : 'border-border/60')
                  }
                  data-checklist-row={o.value}
                  data-picked={on ? 'true' : 'false'}
                  data-disabled={o.disabled ? 'true' : undefined}
                >
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={on}
                    disabled={disabled || (o.disabled && !on)}
                    onChange={() => onPicksChange(togglePick(picks, o.value, options))}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      <span className="truncate text-sm font-semibold">
                        <RowLabel option={o} />
                      </span>
                      {o.tag && (
                        <span className={'shrink-0 rounded-full px-1.5 text-[10px] font-medium ' + TAG_TONE[o.tagTone ?? 'neutral']} data-tag-tone={o.tagTone ?? 'neutral'}>
                          {o.tag}
                        </span>
                      )}
                      {o.disabled && o.note && <span className="shrink-0 text-[10px] font-medium">{o.note}</span>}
                    </span>
                    {o.description ? (
                      <span className="block truncate text-xs text-muted-foreground">
                        <bdi>{o.description}</bdi>
                      </span>
                    ) : null}
                    {note}
                  </span>
                </label>
              </li>
            )
          })}
        </ul>
      )}
      {status && (
        <p className="rounded-lg border border-border/60 bg-muted/40 p-3 text-sm text-muted-foreground" data-checklist-status="">
          {status}
        </p>
      )}
    </div>
  )
}

const TAG_TONE: Record<NonNullable<ChecklistOption['tagTone']>, string> = {
  neutral: 'bg-muted',
  primary: 'bg-primary/10 text-primary',
  attention: 'bg-attention-050 text-attention-800',
}

function RowLabel({ option }: { option: ChecklistOption }) {
  return option.machine ? <Ltr>{option.label}</Ltr> : <bdi>{option.label}</bdi>
}

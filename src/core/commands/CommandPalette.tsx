/**
 * The app-wide command palette (ticket 392, spec 380 K7–K13), graduated from the call
 * center's (ticket 192). The console keeps its own copy until 395.
 *
 * It is a native `<dialog>` — so the top layer, the focus trap, the inert page behind
 * and `Esc` are the platform's — drawn on the overlay card recipe at 10px (F15) and
 * anchored near the top like the reference design, rather than through `core/ui/Modal`,
 * whose title bar the palette does not have.
 *
 * Carried over from the console unchanged:
 * - **each open starts with an empty box** — a remembered query would open aimed at a
 *   row chosen for a screen that has since moved;
 * - **the chosen act runs after the palette has closed** — a `focus()` fired while the
 *   dialog is still up lands on content the browser has made inert;
 * - **focus goes back where it came from** when nothing was chosen. The element is
 *   unmounted on close, so the browser has no node to restore from (`returnFocus`).
 *
 * Which rows exist, in what order and behind which gate is `palette-model.ts`'s and the
 * caller's (`compose`). This component renders them and turns three keys into calls.
 */
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Command as CommandIcon } from 'lucide-react'
import Kbd from '@/core/ui/Kbd'
import Ltr from '@/core/ui/Ltr'
import { DIALOG } from '@/core/ui/overlay'
import { keyLegend } from './chord'
import { NO_HIGHLIGHT, highlightMoveOf, moveHighlight, type HighlightState } from './highlight'
import {
  PALETTE_GROUP_LABEL,
  paletteAim,
  paletteQuestion,
  paletteRun,
  type PaletteGroup,
  type PaletteRow,
} from './palette-model'

/** The list's id, for `aria-activedescendant`: the aim is announced, and the caret never
 *  leaves the box. */
const LIST_ID = 'core-palette-list'
const optionId = (row: PaletteRow) => `core-palette-option-${row.id.replace(/[^\w-]/g, '-')}`

export default function CommandPalette({
  open,
  onClose,
  compose,
  returnFocus,
}: {
  open: boolean
  onClose: () => void
  /** The groups for a query, in order and already gated. `textOf` is the rendered words. */
  compose: (query: string, textOf: (row: PaletteRow) => string) => PaletteGroup[]
  /** Puts the caret back where it was when the palette opened. */
  returnFocus: () => void
}) {
  const { t } = useTranslation()
  const ref = useRef<HTMLDialogElement>(null)
  const [query, setQuery] = useState('')
  const [highlight, setHighlight] = useState<HighlightState>(NO_HIGHLIGHT)
  /** What the user chose, held until the dialog is actually gone. */
  const chosen = useRef<(() => void) | null>(null)
  const wasOpen = useRef(false)
  const pressedBackdrop = useRef(false)

  useEffect(() => {
    if (open && !wasOpen.current) {
      chosen.current = null
      setQuery('')
      setHighlight(NO_HIGHLIGHT)
    }
    if (!open && wasOpen.current) {
      const act = chosen.current
      chosen.current = null
      if (act) act()
      else returnFocus()
    }
    wasOpen.current = open
  }, [open, returnFocus])

  useEffect(() => {
    const dialog = ref.current
    if (open && dialog && !dialog.open) dialog.showModal()
  }, [open])

  const textOf = (row: PaletteRow) =>
    [t(row.label), row.context ? t(row.context) : '', row.value ?? ''].join(' ')
  const groups = open ? compose(query, textOf) : []
  const rows = groups.flatMap((g) => g.rows)
  // The query AND the rows it produced: a This screen row is rebuilt from page state, so
  // the list can change under an open palette (see `paletteQuestion`).
  const question = paletteQuestion(rows, query)
  const aim = paletteAim(highlight, rows, question)
  const aimId = aim === null ? null : optionId(rows[aim])

  /** The aimed row is kept in view, moving the list only when it has to. */
  useEffect(() => {
    if (!open || aimId === null) return
    document.getElementById(aimId)?.scrollIntoView({ block: 'nearest' })
  }, [open, aimId])

  /** Take a row — held until the dialog is gone, then run (see the effect above). */
  const choose = (row: PaletteRow | null) => {
    // 🚩 A disabled row is `null` here and NOTHING happens: the palette stays open with
    // the reason on screen, because that reason is the answer to the question asked.
    if (!row?.enabled || !row.run) return
    chosen.current = row.run
    onClose()
  }

  const onKey = (event: React.KeyboardEvent<HTMLInputElement>) => {
    const move = highlightMoveOf(event.key)
    if (move) {
      event.preventDefault()
      // The aim the user can SEE is what the next press moves from.
      setHighlight(
        moveHighlight({ index: aim, term: question }, { count: rows.length, term: question, armed: true }, move),
      )
      return
    }
    if (event.key === 'Enter') {
      event.preventDefault()
      choose(paletteRun(rows, aim))
    }
    // `Escape` is the dialog's own (`onCancel`): one close path.
  }

  if (!open) return null

  return (
    <dialog
      ref={ref}
      aria-label={t('palette.title')}
      data-palette
      // `cancel` is Escape: React state stays the single source of truth for `open`.
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
      // The backdrop reports the dialog itself as the target; content never does. The press
      // must START there too: a drag that selects the query and ends past the card's edge
      // also clicks the dialog, and must not throw the query away.
      onMouseDown={(event) => {
        pressedBackdrop.current = event.target === ref.current
      }}
      onClick={(event) => {
        if (pressedBackdrop.current && event.target === ref.current) onClose()
      }}
      className={'mx-auto mt-[70px] w-[92vw] max-w-[620px] overflow-hidden p-0 ' + DIALOG}
    >
      <div className="flex items-center gap-2.5 border-b border-border px-3.5 py-3 text-muted-foreground">
        <CommandIcon className="h-4 w-4 shrink-0" aria-hidden />
        <input
          // The caret goes here on open and stays: rows are aimed at, never focused.
          autoFocus
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={onKey}
          role="combobox"
          aria-expanded
          aria-controls={LIST_ID}
          aria-activedescendant={aimId ?? undefined}
          aria-label={t('palette.title')}
          placeholder={t('palette.placeholder')}
          autoComplete="off"
          spellCheck={false}
          data-palette-input
          className="min-w-0 flex-1 border-0 bg-transparent text-[15px] text-foreground outline-none placeholder:text-ink-3"
        />
        <Kbd>{t('keys.esc')}</Kbd>
      </div>
      <div className="max-h-[380px] overflow-auto p-1.5">
        {/* Outside the listbox: a `role="listbox"` holds options and groups only. */}
        {rows.length === 0 && (
          <p className="px-3 py-4 text-center text-[13px] text-muted-foreground" data-palette-empty>
            {t('palette.empty')}
          </p>
        )}
        <div id={LIST_ID} role="listbox" aria-label={t('palette.title')}>
          {groups.map((group) => (
            <div
              key={group.id}
              role="group"
              aria-labelledby={`core-palette-group-${group.id}`}
              data-palette-group={group.id}
            >
              <div
                id={`core-palette-group-${group.id}`}
                className="px-2 pb-1 pt-2 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted-foreground"
              >
                {t(PALETTE_GROUP_LABEL[group.id])}
              </div>
              {group.rows.map((row) => (
                <Row key={row.id} row={row} aimed={aimId === optionId(row)} onRun={() => choose(row)} />
              ))}
            </div>
          ))}
        </div>
      </div>
      <div
        className="flex flex-wrap gap-x-4 gap-y-1 border-t border-border bg-card-2 px-3.5 py-2 text-[11.5px] text-muted-foreground"
        data-palette-foot
      >
        <span className="flex items-center gap-1.5">
          <Ltr>
            <Kbd>{keyLegend('ArrowUp')}</Kbd> <Kbd>{keyLegend('ArrowDown')}</Kbd>
          </Ltr>
          {t('palette.foot.move')}
        </span>
        <span className="flex items-center gap-1.5">
          <Kbd>{t('keys.enter')}</Kbd>
          {t('palette.foot.run')}
        </span>
        <span className="flex items-center gap-1.5">
          <Kbd>{t('keys.esc')}</Kbd>
          {t('palette.foot.close')}
        </span>
      </div>
    </dialog>
  )
}

/**
 * One row. A refused act is drawn disabled with its reason rather than withheld (K13),
 * stays aimable, and pressing it does nothing. The mouse runs the row it presses — the
 * same act `Enter` reaches, by the same route.
 */
function Row({ row, aimed, onRun }: { row: PaletteRow; aimed: boolean; onRun: () => void }) {
  const { t } = useTranslation()
  const Icon = row.icon
  return (
    <div
      id={optionId(row)}
      role="option"
      aria-selected={aimed}
      aria-disabled={!row.enabled}
      data-palette-row={row.id}
      {...(aimed ? { 'data-palette-aimed': row.id } : {})}
      {...(row.enabled ? {} : { 'data-palette-disabled': row.id })}
      onClick={onRun}
      className={
        'relative flex min-h-8 items-center gap-2.5 rounded-md px-2 py-1 text-[13px] ' +
        (aimed
          ? 'bg-accent before:absolute before:inset-y-1.5 before:start-0 before:w-[3px] before:rounded-sm before:bg-cursor '
          : '') +
        (row.enabled ? 'cursor-pointer text-foreground' : 'cursor-default text-muted-foreground')
      }
    >
      {Icon && <Icon className="h-[15px] w-[15px] shrink-0 text-muted-foreground" aria-hidden />}
      <span className="min-w-0 flex-1">
        <span className="flex min-w-0 items-baseline gap-1.5">
          <span className="truncate">{t(row.label)}</span>
          {row.value !== null && (
            <span className="shrink-0 font-mono font-semibold" data-palette-value>
              <Ltr>{row.value}</Ltr>
            </span>
          )}
        </span>
        {row.reason && (
          <span className="block text-[11.5px] text-muted-foreground" data-palette-reason={row.id}>
            {t(row.reason)}
          </span>
        )}
      </span>
      {row.context && <span className="shrink-0 text-[11.5px] text-muted-foreground">{t(row.context)}</span>}
    </div>
  )
}

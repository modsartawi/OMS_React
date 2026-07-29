/**
 * `Ctrl+K` — one key that reaches everything the order can do (ticket 192).
 *
 * It is the last of the four keys 153 settled, and it is built on `core/ui/Modal`
 * — the native `<dialog>` — so that the top-layer stacking, the focus trap, the
 * inert content behind and `Esc` are the platform's rather than this component's.
 *
 * ⚠ **The one thing `showModal()` does NOT hand over here is the focus restore**,
 * and it is the half this ticket needs most. `Modal` unmounts the element on
 * close, so the browser has no node left to restore from — see the open/close
 * effect below, which remembers where the caret came from and puts it back.
 *
 * 🚩 **The palette is the whole cheat sheet.** There is no `?` (it types a
 * question mark into the box the agent is in) and no `F1`: four keys do not
 * justify a second surface that can drift out of date. The foot carries them,
 * and `Ctrl+K` itself is advertised in the search box's placeholder, where the
 * caret already is on every call.
 *
 * Every rule about WHICH rows exist, what order they come in and what may be
 * aimed at lives in `palette-model.ts` — this component renders them and turns
 * three keys into calls. It decides nothing.
 */
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import Modal from '@/core/ui/Modal'
import { NO_HIGHLIGHT, highlightMoveOf, moveHighlight, type HighlightState } from './highlight'
import {
  filterRows,
  paletteAim,
  paletteQuestion,
  paletteRun,
  type PaletteRow,
} from './palette-model'

/** The list's own id, for `aria-activedescendant` — the highlight is announced
 *  rather than only painted (191's review), and the caret never leaves the box. */
const LIST_ID = 'cc-palette-list'
const optionId = (row: PaletteRow) => `cc-palette-option-${row.id.replace(':', '-')}`

export default function CommandPalette({
  open,
  rows,
  onClose,
  returnFocus,
}: {
  open: boolean
  /** Already ordered and already gated — `paletteRows`' output, unedited. */
  rows: PaletteRow[]
  onClose: () => void
  /**
   * Puts the caret back where it was when `Ctrl+K` was pressed.
   *
   * 🚩 It is the CALLER's because only the caller knows: by the time this
   * component's open effect runs, the dialog's own `autoFocus` has already
   * moved the caret here, so `document.activeElement` reads as the palette's
   * own box. The one moment the answer exists is the key press itself.
   */
  returnFocus?: () => void
}) {
  const { t } = useTranslation('callcenter')
  const [query, setQuery] = useState('')
  const [highlight, setHighlight] = useState<HighlightState>(NO_HIGHLIGHT)
  /** What the agent chose, held until the sheet is actually gone. */
  const chosen = useRef<(() => void) | null>(null)
  const wasOpen = useRef(false)

  /**
   * Opening and closing, and the two things that only work in this order.
   *
   * 🚩 **The act runs AFTER the dialog has gone.** Two of the rows hand focus to
   * a box (*Search items*, *Attach caller*), and a `focus()` fired while the
   * `<dialog>` is still up lands on content the browser has made inert — the
   * caret simply does not move. Holding the chosen act until the close has
   * committed is what makes *the way home* actually work.
   *
   * 🚩 **And the caret goes back where it came from when nothing was chosen.**
   * `showModal()` does restore focus natively, but `core/ui/Modal` unmounts the
   * element on close, so the node is gone before the browser can — the restore
   * is `returnFocus`, remembered by the caller rather than assumed.
   *
   * Every open is also a fresh question: a palette that remembered the last
   * query would open aimed at a row the agent chose for a basket that has since
   * moved, and the aim is what `Enter` runs.
   */
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
      else returnFocus?.()
    }
    wasOpen.current = open
  }, [open, returnFocus])

  /** The rendered words a query is matched against — the labels are keys, so
   *  the resolution has to happen here (see `filterRows`). The server text
   *  rides along, which is what lets the agent find an offer by its own name. */
  const textOf = (row: PaletteRow) => `${t(row.label.key)} ${row.detail ?? ''}`
  const shown = filterRows(rows, query, textOf)
  // 🚩 The query AND the rows it produced. The list is rebuilt from the live
  // `SessionState`, so it can change under an open palette — and an aim carried
  // across that change names a different row (see `paletteQuestion`).
  const question = paletteQuestion(shown, query)
  const aim = paletteAim(highlight, shown, question)
  const aimId = aim === null ? null : optionId(shown[aim])

  /**
   * 🚩 The aimed row is kept in view. The list scrolls at around eight rows and
   * the two acts that end a call are at the bottom of it, so an aim below the
   * fold is an `Enter` on a row the agent cannot read — the one state where the
   * highlight stops being an aim and becomes a guess. `block: 'nearest'` moves
   * the list only when it has to, so the rows do not jump under a walking eye.
   */
  useEffect(() => {
    if (!open || aimId === null) return
    document.getElementById(aimId)?.scrollIntoView({ block: 'nearest' })
  }, [open, aimId])


  /** Take a row — held until the sheet is gone, then run (see the effect). */
  const choose = (row: PaletteRow | null) => {
    // 🚩 A disabled row is `null` here and NOTHING happens — the palette stays
    // open with the reason still on screen, because that reason is the answer to
    // the question the agent asked.
    if (!row?.enabled || !row.run) return
    chosen.current = row.run
    onClose()
  }
  /** What `Enter` runs: the AIMED row, and only if it is one that runs. */
  const run = () => choose(paletteRun(shown, aim))

  const onKey = (event: React.KeyboardEvent<HTMLInputElement>) => {
    const move = highlightMoveOf(event.key)
    if (move) {
      event.preventDefault()
      // The aim the agent can SEE is what the next press moves from — otherwise
      // `↓` off the auto-aimed first row would land on the first row again.
      setHighlight(
        moveHighlight(
          { index: aim, term: question },
          { count: shown.length, term: question, armed: true },
          move,
        ),
      )
      return
    }
    if (event.key === 'Enter') {
      event.preventDefault()
      run()
    }
    // `Escape` is the dialog's own (`onCancel`), so it is not read here: one
    // close path, and the effect above is what lands the caret back home.
  }

  return (
    <Modal open={open} onClose={onClose} title={t('palette.title')} width="34rem">
      <div data-cc-palette>
        <input
          // The caret goes here on open and stays here: the rows are aimed at,
          // never focused, so the agent keeps typing to narrow them.
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
          data-cc-palette-input
          className="w-full rounded-md border border-input bg-card px-3 py-2 text-sm outline-none focus:border-primary"
        />
        <div className="mt-2 max-h-[22rem] overflow-auto rounded-md border border-border">
          {/* The empty answer sits OUTSIDE the listbox: a `role="listbox"` may
              hold options and nothing else, and the search panel's combobox
              keeps the same separation. */}
          {shown.length === 0 && (
            <p className="px-3 py-3 text-xs text-muted-foreground" data-cc-palette-empty>
              {t('palette.empty')}
            </p>
          )}
          <div id={LIST_ID} role="listbox">
            {shown.map((row, index) => (
              <Row key={row.id} row={row} aimed={index === aim} onRun={() => choose(row)} />
            ))}
          </div>
        </div>
        {/* 🚩 The only cheat sheet there is. Four keys, under the rows they act
            on, so it cannot drift out of date with a second surface. */}
        <div
          className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground"
          data-cc-palette-foot
        >
          <span>{t('palette.foot.open')}</span>
          <span>{t('palette.foot.move')}</span>
          <span>{t('palette.foot.run')}</span>
          <span>{t('palette.foot.close')}</span>
        </div>
      </div>
    </Modal>
  )
}

/**
 * One row.
 *
 * 🚩 A refused act is drawn **disabled with its reason** rather than withheld —
 * the console's one deliberate exception to "a control the door would refuse is
 * worse than no control" (153 ruling 4). It stays aimable, and pressing `Enter`
 * on it does nothing at all: skipping it would hide the very sentence the
 * exception exists to deliver.
 */
function Row({ row, aimed, onRun }: { row: PaletteRow; aimed: boolean; onRun: () => void }) {
  const { t } = useTranslation('callcenter')
  return (
    <div
      id={optionId(row)}
      role="option"
      aria-selected={aimed}
      aria-disabled={!row.enabled}
      data-cc-palette-row={row.id}
      data-cc-palette-kind={row.kind}
      {...(aimed ? { 'data-cc-palette-aimed': row.id } : {})}
      {...(row.enabled ? {} : { 'data-cc-palette-disabled': row.id })}
      // The mouse may still press a row — and it runs THAT row, never the aimed
      // one: the caller hands each row its own act, so a click and an `Enter`
      // reach the same place by the same route.
      onClick={onRun}
      className={`border-b border-divider px-3 py-2 last:border-b-0 ${
        aimed ? 'bg-accent' : ''
      } ${row.enabled ? 'cursor-pointer' : 'cursor-default opacity-60'}`}
    >
      <div className="flex items-baseline gap-2">
        {/* The console's word for the row… */}
        <span className={`text-sm ${row.kind === 'offer' ? 'text-muted-foreground text-[11px] uppercase tracking-wide' : 'font-medium'}`}>
          {t(row.label.key)}
        </span>
        {/* …and the server's own text beside it, passed through as data (§7). */}
        {row.detail && <span className="min-w-0 truncate text-sm font-medium">{row.detail}</span>}
      </div>
      {/* Why not — the server's typed reason, worded by the surface that owns
          the refusal, degrading to the general sentence for a code this console
          has never seen (§9). */}
      {row.reason && (
        <p className="mt-0.5 text-[11px] text-muted-foreground" data-cc-palette-reason={row.id}>
          {t(row.reason.key, { defaultValue: row.reason.fallbackKey ? t(row.reason.fallbackKey) : undefined })}
        </p>
      )}
    </div>
  )
}

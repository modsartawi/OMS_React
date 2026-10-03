/**
 * The app-wide palette's rows (ticket 392, spec 380 K1–K2, K7–K13; ruling 364 §1–§4) —
 * what a registered command becomes, the order the groups come in, what a typed number
 * yields, and what the aim and `Enter` reach.
 *
 * It graduates the call center's palette model (ticket 192) to `@/core`, minus the
 * console's own rows: those join as that screen's registered commands with 395.
 *
 * 🚩 **A refused act is a disabled row carrying its reason** (K13, ruling 192 made
 * app-wide). The palette answers a question the user asked, and an absent row teaches
 * nothing. Disabled rows stay aimable; `Enter` on one does nothing at all.
 *
 * 🚩 **Enablement is the handler being present** (K2), never a predicate of this
 * module's own: the row runs the very handler the page's button already calls, so a
 * withdrawn handler withdraws the act from both surfaces by construction.
 *
 * This module knows no route and no grant. The app-wide groups (Go to, Jump to number)
 * are composed in `layout/` — the composition root — and handed in as rows.
 */
import { Keyboard, type LucideIcon } from 'lucide-react'
import { highlightedIndex, type HighlightState } from './highlight'
import { boundKeysOf, SHEET_KEYS, type KeyBindings } from './keys'

/** The groups, in the one order they are listed (K8). Recent (394) joins after `screen`. */
export type PaletteGroupId = 'screen' | 'goto' | 'jump'
export const PALETTE_GROUP_ORDER: readonly PaletteGroupId[] = ['screen', 'goto', 'jump']

/** Each group's heading. */
export const PALETTE_GROUP_LABEL: Readonly<Record<PaletteGroupId, string>> = {
  screen: 'common:palette.group.screen',
  goto: 'common:palette.group.goto',
  jump: 'common:palette.group.jump',
}

/**
 * A command a page registers through `useCommands` while it is mounted (K1–K2) — the
 * whole of the "This screen" group.
 *
 * `terminal` (395) is not here yet.
 */
export interface Command {
  /** Stable across renders and unique on the page. */
  id: string
  /** An i18n key, with its namespace (`deliveries:…`). */
  label: string
  /** The act. Absent or `null` = the page would refuse it right now (K2, K13). */
  run?: (() => void) | null
  /** Why not — an i18n key, the same words as its button's tooltip. Read only when refused. */
  reason?: string | null
  icon?: LucideIcon
  /**
   * The key that runs it while the page is mounted (393, `keys.ts`): `KeyR`, `Slash`,
   * `Escape`, `Ctrl+Enter`. The same one field binds the key, hints it on the row and
   * lists it in the shortcuts sheet. A refused key binds nothing (a dev error).
   */
  keys?: string
  /**
   * Bound and listed in the shortcuts sheet, but never a palette row — J/K's next and
   * previous row (397). A hidden command repeats while its key is held; an act never does.
   */
  hidden?: boolean
}

export interface PaletteRow {
  /** Stable across a re-render: the React key, and the drive's handle. */
  id: string
  group: PaletteGroupId
  /** An i18n key, with its namespace. */
  label: string
  /** An i18n key naming where the row sits (a Go to leaf's menu group), or `null`. */
  context: string | null
  /** A machine value beside the label (a Jump row's number), rendered isolated. */
  value: string | null
  icon: LucideIcon | null
  /** 🚩 `run !== null`. Never a predicate of this module's own. */
  enabled: boolean
  /** Why not (an i18n key), when it is not. `null` on an enabled row. */
  reason: string | null
  run: (() => void) | null
  /** The key that runs it, in `keys.ts`' canonical spelling, drawn as a right-aligned `kbd`. */
  keys?: string | null
}

/**
 * One registered command as a This screen row: enabled exactly when it has a handler.
 * `keys` is the key it is actually BOUND to — a refused key hints nothing.
 */
export function commandRow(command: Command, keys: string | null = null): PaletteRow {
  const run = command.run ?? null
  return {
    id: `screen:${command.id}`,
    group: 'screen',
    label: command.label,
    context: null,
    value: null,
    icon: command.icon ?? null,
    enabled: run !== null,
    reason: run === null ? (command.reason ?? null) : null,
    run,
    keys,
  }
}

/** The This screen rows: every registered command but the hidden ones, hinting its bound key. */
export function screenRows(commands: readonly Command[], bindings: KeyBindings): PaletteRow[] {
  return commands.filter((c) => !c.hidden).map((c) => commandRow(c, boundKeysOf(c, bindings)))
}

/**
 * The row that opens the shortcuts sheet (K16) — on every screen, the console's included,
 * where `?` would type into the box. It sits last in This screen: the sheet lists this
 * screen's keys. It hints `?` only where `?` is live.
 */
export function shortcutsRow(open: () => void, at: { singleKeyScreen: boolean }): PaletteRow {
  return {
    id: 'core:shortcuts',
    group: 'screen',
    label: 'common:shortcuts.open',
    context: null,
    value: null,
    icon: Keyboard,
    enabled: true,
    reason: null,
    run: open,
    keys: at.singleKeyScreen ? SHEET_KEYS : null,
  }
}

export interface PaletteGroup {
  id: PaletteGroupId
  rows: PaletteRow[]
}

/**
 * Rows whose rendered words contain the query. The labels are keys, so the caller
 * resolves them (`textOf`) — this module never translates.
 */
export function filterRows(rows: readonly PaletteRow[], query: string, textOf: (row: PaletteRow) => string) {
  const needle = query.trim().toLowerCase()
  if (needle === '') return [...rows]
  return rows.filter((row) => textOf(row).toLowerCase().includes(needle))
}

/**
 * The groups, in K8's order, with an emptied group dropped. This screen and Go to are
 * narrowed by the typed words; the Jump rows are not — they ARE the typed number, so
 * filtering them by it would be circular.
 *
 * Each group arrives already gated by its composer (K12), so nothing here decides who
 * may see what.
 */
export function composePalette(input: {
  screen: readonly PaletteRow[]
  goto: readonly PaletteRow[]
  jump: readonly PaletteRow[]
  query: string
  textOf: (row: PaletteRow) => string
}): PaletteGroup[] {
  const rows: Record<PaletteGroupId, PaletteRow[]> = {
    screen: filterRows(input.screen, input.query, input.textOf),
    goto: filterRows(input.goto, input.query, input.textOf),
    jump: [...input.jump],
  }
  return PALETTE_GROUP_ORDER.map((id) => ({ id, rows: rows[id] })).filter((g) => g.rows.length > 0)
}

/** Arabic-Indic (U+0660…) and Persian (U+06F0…) digits, folded to ASCII. */
const foldDigits = (s: string) =>
  s.replace(/[٠-٩۰-۹]/g, (d) => String(d.charCodeAt(0) & 0xf))

/**
 * The number a query names, or `null` (K11). Wholly digits once trimmed — an Arabic
 * layout's digits are folded to ASCII, because the route takes ASCII.
 */
export function jumpNumberOf(query: string): string | null {
  const folded = foldDigits(query.trim())
  return /^\d+$/.test(folded) ? folded : null
}

/**
 * **The question an aim answers** — the typed query AND the rows it produced (192's
 * `paletteQuestion`). A This screen row is rebuilt from page state, so the list can
 * change under an open palette without the query changing; folding the row ids into
 * the term makes that a new question, and the aim falls back to the first row rather
 * than sliding onto a different one.
 */
export function paletteQuestion(rows: readonly PaletteRow[], query: string): string {
  return `${query}\n${rows.map((row) => row.id).join(',')}`
}

/**
 * Where the highlight actually is: the arrows' own (`highlight.ts`), over the first row
 * aimed from the start — `Enter` runs a row the user named by typing. A disabled row is
 * aimed like any other: skipping it would hide the reason it exists to carry.
 */
export function paletteAim(state: HighlightState, rows: readonly PaletteRow[], question: string): number | null {
  const carried = highlightedIndex(state, { count: rows.length, term: question, armed: true })
  if (carried !== null) return carried
  return rows.length > 0 ? 0 : null
}

/** What `Enter` runs — the aimed row, and only if it is one that runs. */
export function paletteRun(rows: readonly PaletteRow[], aim: number | null): PaletteRow | null {
  if (aim === null) return null
  const row = rows[aim]
  return row?.enabled && row.run ? row : null
}

/**
 * The flags a route's `handle` may carry for the palette (375 R4).
 *
 * - `print` — a print route: its body IS the document, and it never hosts the palette.
 * - `ownPalette` — the call center, which keeps its own Ctrl+K until 395 moves it onto
 *   this one, so a screen never has two handlers.
 *
 * 🚩 An explicit flag, never `chromeless`: the console is chromeless too, and joins the
 * palette at 395.
 *
 * - `singleKeys` (393) — a screen with single keys (letters, `/`, `?`): the Deliveries
 *   list and Delivery details only (365 §2). Everywhere else has Ctrl+K, Esc and its own
 *   Ctrl+Enter, and a letter there is refused.
 */
export interface PaletteRouteHandle {
  print?: boolean
  ownPalette?: boolean
  singleKeys?: boolean
}

/** True when a matched route is a single-key screen. Reads `handle`s of any shape, defensively. */
export function singleKeyScreenOf(handles: readonly unknown[]): boolean {
  return handles.some(
    (handle) => typeof handle === 'object' && handle !== null && (handle as PaletteRouteHandle).singleKeys === true,
  )
}

/** True when any matched route opts out. Reads `handle`s of any shape, defensively. */
export function paletteOptedOut(handles: readonly unknown[]): boolean {
  return handles.some((handle) => {
    if (typeof handle !== 'object' || handle === null) return false
    const flags = handle as PaletteRouteHandle
    return flags.print === true || flags.ownPalette === true
  })
}

/**
 * When a key fires — three tiers, decided in one pure place (ticket 393, spec 380 K4;
 * ruling 365 §3).
 *
 * | Tier | Fires when |
 * |---|---|
 * | **Chords** (Ctrl+K, a screen's Ctrl+Enter) | From anywhere — a text box, a grid cell. Inert while any dialog is open. |
 * | **Esc** | Only once every layer above the screen has passed on it: an open dialog keeps it, and a popover, menu or box that took it prevented it. A text box's Esc blurs it first, so a second Esc reaches the screen. |
 * | **Single keys** (letters, `/`, `?`) | Focus is not in a text entry or an AG Grid cell editor; no dialog is open; no Ctrl, Alt or Meta (Shift only as part of `?`); the switch is on; and the press is not mid-composition. |
 *
 * 🚩 **A key a control has already handled stays that control's** (368): every tier skips
 * `defaultPrevented`. That is what keeps Enter in a token popover the popover's.
 *
 * Acts never repeat while a key is held; a hidden navigation command (J/K) does.
 */
import { eventKeys, parseKeys, tierOf, type KeyEventFacts } from './keys'

/**
 * Where focus is, as the tiers see it:
 * - `entry` — an input, textarea, select, contenteditable or a `role=textbox/combobox/
 *   searchbox` (which covers AG Grid's floating filters): a letter there is typing;
 * - `cellEditor` — inside an AG Grid cell editor, whose own Esc cancels the edit;
 * - `other` — anything else, a grid cell and a button included.
 */
export type FocusKind = 'entry' | 'cellEditor' | 'other'

/** The slice of an `Element` the focus kind is read from — a real element satisfies it. */
export interface FocusTarget {
  tagName: string
  isContentEditable?: boolean
  getAttribute(name: string): string | null
  closest(selector: string): unknown
}

const ENTRY_TAGS = ['INPUT', 'TEXTAREA', 'SELECT']
const ENTRY_ROLES = ['textbox', 'combobox', 'searchbox']
/** AG Grid's inline and popup editors. */
const CELL_EDITOR = '.ag-cell-inline-editing, .ag-popup-editor'

export function focusKindOf(el: FocusTarget | null | undefined): FocusKind {
  if (!el) return 'other'
  if (el.closest(CELL_EDITOR)) return 'cellEditor'
  if (ENTRY_TAGS.includes(el.tagName.toUpperCase())) return 'entry'
  if (el.isContentEditable) return 'entry'
  const role = el.getAttribute('role')
  return role !== null && ENTRY_ROLES.includes(role) ? 'entry' : 'other'
}

/** The press, as the tiers read it — a real `KeyboardEvent` satisfies it. */
export interface KeyFacts extends KeyEventFacts {
  isComposing: boolean
  defaultPrevented: boolean
  repeat: boolean
}

/**
 * - `fire` — run the bound act (and prevent the default);
 * - `skip` — leave the press alone;
 * - `blur` — Esc in a text box: take focus out of it, and nothing else (365 §6's two-step).
 */
export type FireDecision = 'fire' | 'skip' | 'blur'

export function fireDecision(input: {
  event: KeyFacts
  focus: FocusKind
  /** Any `dialog[open]`, or a hand-drawn `aria-modal` dialog. */
  dialogOpen: boolean
  /** The single-key switch (K6). */
  switchOn: boolean
  /** A hidden navigation command (J/K) repeats while held; an act never does. */
  repeatable?: boolean
}): FireDecision {
  const { event, focus, dialogOpen, switchOn, repeatable = false } = input
  if (event.defaultPrevented || event.isComposing) return 'skip'
  if (event.repeat && !repeatable) return 'skip'
  const keys = eventKeys(event)
  if (keys === null) return 'skip'
  switch (tierOf(keys)) {
    case 'chord':
      return dialogOpen ? 'skip' : 'fire'
    case 'esc':
      if (dialogOpen || focus === 'cellEditor') return 'skip'
      return focus === 'entry' ? 'blur' : 'fire'
    case 'single': {
      if (dialogOpen || focus !== 'other' || !switchOn) return 'skip'
      const p = parseKeys(keys)
      // No Ctrl/Meta (a chord) reaches here; Alt never fires, and Shift only as `?`.
      if (!p || p.alt || (p.shift && p.base !== 'Slash')) return 'skip'
      return 'fire'
    }
  }
}

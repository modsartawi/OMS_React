/**
 * A key is a field on a command (ticket 393, spec 380 K2–K3, K17; ruling 365 §1, §10).
 *
 * A command registered through `useCommands` may carry `keys`. That one field binds the
 * key while the page is mounted, puts its hint on the palette row and lists it in the
 * shortcuts sheet — so **a key can only do what a palette row does**.
 *
 * A key is written as one string, modifiers first: `KeyR`, `Slash`, `Escape`,
 * `Ctrl+Enter`. The base is the physical key's **`event.code`** (`KeyR`, never `r`: on an
 * Arabic layout `event.key` is the Arabic letter on that cap), except `Enter` and `Escape`,
 * which match on `event.key` — the same on every layout, and the numpad's Enter with it.
 * Meta counts as Ctrl, and the hint always says Ctrl (a Windows back office).
 *
 * 🚩 **The registry refuses** (K3), as a dev-time error, and the first binding wins:
 * two mounted commands on one key; any Alt chord; any Ctrl chord but a screen's
 * Ctrl+Enter (Ctrl+K is the core's); and AG Grid's own keys, so arrows, Tab, Space,
 * Enter, PageUp/PageDown, Home/End, Ctrl+A and Ctrl+C stay the grid's and native copy is
 * untouched. And **a `terminal` command carries no key at all** (395, ruling 365 §7): an
 * act that ends something is a palette row reached by a deliberate `↓`, never a chord.
 */
import type { Command } from './palette-model'

/** The palette's chord — the core's own (392). */
export const PALETTE_KEYS = 'Ctrl+KeyK'
/** `?` — the shortcuts sheet, the core's own on a single-key screen. */
export const SHEET_KEYS = 'Shift+Slash'
/** The keys the core layer owns. A screen claiming one is refused. */
const CORE_KEYS: readonly string[] = [PALETTE_KEYS, SHEET_KEYS]

/** A key, read apart. `base` is a code (`KeyR`, `Slash`) or `Enter` / `Escape`. */
export interface ParsedKeys {
  ctrl: boolean
  alt: boolean
  shift: boolean
  base: string
}

const MODIFIERS = ['Ctrl', 'Alt', 'Shift'] as const

/** `Ctrl+Enter` → its parts, or `null` for a malformed string (an unknown or repeated modifier). */
export function parseKeys(keys: string): ParsedKeys | null {
  const parts = keys.split('+')
  const base = parts.pop() ?? ''
  if (base === '' || (MODIFIERS as readonly string[]).includes(base)) return null
  const mods = new Set<string>()
  for (const mod of parts) {
    if (!(MODIFIERS as readonly string[]).includes(mod) || mods.has(mod)) return null
    mods.add(mod)
  }
  return { ctrl: mods.has('Ctrl'), alt: mods.has('Alt'), shift: mods.has('Shift'), base }
}

/** The one spelling of a key: `Ctrl+Alt+Shift+base`, whatever order it was written in. */
export function canonicalKeys(p: ParsedKeys): string {
  return [p.ctrl && 'Ctrl', p.alt && 'Alt', p.shift && 'Shift', p.base].filter(Boolean).join('+')
}

/** The slice of a `KeyboardEvent` a key is read from — a real event satisfies it. */
export interface KeyEventFacts {
  key: string
  code: string
  ctrlKey: boolean
  metaKey: boolean
  altKey: boolean
  shiftKey: boolean
}

/**
 * The key a press names, in the canonical spelling — `null` when there is no code.
 * Letters and symbols by `code`, Enter and Escape by `key`, Meta as Ctrl.
 */
export function eventKeys(e: KeyEventFacts): string | null {
  const base = e.key === 'Enter' || e.key === 'Escape' ? e.key : e.code
  if (!base) return null
  return canonicalKeys({ ctrl: e.ctrlKey || e.metaKey, alt: e.altKey, shift: e.shiftKey, base })
}

/** The tier a key fires in (K4): chords from anywhere, Esc by layer, single keys guarded. */
export type KeyTier = 'chord' | 'esc' | 'single'

export function tierOf(keys: string): KeyTier {
  const p = parseKeys(keys)
  if (p?.ctrl) return 'chord'
  if (p?.base === 'Escape') return 'esc'
  return 'single'
}

/** Letters, `/` and `?` — what the single-key switch turns off (K6). */
export function isSingleKey(keys: string): boolean {
  return tierOf(keys) === 'single'
}

/** AG Grid's own keys on a focused cell (365): never a command's. */
const GRID_KEYS: readonly string[] = [
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'Tab',
  'Space',
  'Enter',
  'PageUp',
  'PageDown',
  'Home',
  'End',
  'Ctrl+KeyA',
  'Ctrl+KeyC',
]

/**
 * Why the registry refuses a key, as a short code for the dev error:
 * - `malformed` — not a key string;
 * - `alt` — any Alt chord;
 * - `grid` — one of AG Grid's own keys;
 * - `core` — Ctrl+K or `?`, which the core layer owns;
 * - `ctrl` — a Ctrl chord other than Ctrl+Enter;
 * - `unsupported` — anything else that is not a letter, `/`, Esc or Ctrl+Enter;
 * - `single-key-screen` — a letter or `/` on a screen that has no single keys (365 §2:
 *   the Deliveries list and Delivery details only);
 * - `terminal` — the command is a terminal act, which never carries a key (395);
 * - `collision` — another mounted command claimed it first.
 */
export type KeyRefusal =
  | 'malformed'
  | 'alt'
  | 'grid'
  | 'core'
  | 'ctrl'
  | 'unsupported'
  | 'single-key-screen'
  | 'terminal'
  | 'collision'

/** Why this key may not be a screen command's, or `null` when it may (the collision aside). */
export function keyRefusal(keys: string, at: { singleKeyScreen: boolean }): KeyRefusal | null {
  const p = parseKeys(keys)
  if (!p) return 'malformed'
  const canonical = canonicalKeys(p)
  if (p.alt) return 'alt'
  if (GRID_KEYS.includes(canonical)) return 'grid'
  if (CORE_KEYS.includes(canonical)) return 'core'
  if (p.ctrl) return canonical === 'Ctrl+Enter' ? null : 'ctrl'
  if (canonical === 'Escape') return null
  if (p.shift || !(/^Key[A-Z]$/.test(p.base) || p.base === 'Slash')) return 'unsupported'
  return at.singleKeyScreen ? null : 'single-key-screen'
}

export interface RefusedKey {
  command: Command
  keys: string
  refusal: KeyRefusal
}

export interface KeyBindings {
  /** Canonical key → the one command it fires. */
  bound: ReadonlyMap<string, Command>
  refused: RefusedKey[]
}

/**
 * The mounted commands' keys, bound — in registration order, so the first claim wins
 * and every later one is refused as a collision.
 */
export function bindKeys(commands: readonly Command[], at: { singleKeyScreen: boolean }): KeyBindings {
  const bound = new Map<string, Command>()
  const refused: RefusedKey[] = []
  for (const command of commands) {
    if (!command.keys) continue
    const refusal = command.terminal ? 'terminal' : keyRefusal(command.keys, at)
    const p = parseKeys(command.keys)
    const canonical = p ? canonicalKeys(p) : command.keys
    if (refusal) refused.push({ command, keys: command.keys, refusal })
    else if (bound.has(canonical)) refused.push({ command, keys: command.keys, refusal: 'collision' })
    else bound.set(canonical, command)
  }
  return { bound, refused }
}

/** The key a command is actually bound to — `null` when it has none or it was refused. */
export function boundKeysOf(command: Command, bindings: KeyBindings): string | null {
  if (!command.keys) return null
  const p = parseKeys(command.keys)
  if (!p) return null
  const canonical = canonicalKeys(p)
  return bindings.bound.get(canonical) === command ? canonical : null
}

/** The named keys, whose legend is a word and so goes through `t()` (K17). */
export type NamedKey = 'ctrl' | 'shift' | 'enter' | 'esc'

/** One cap of a key's legend: Latin data, or a named key's i18n key. */
export type LegendPart = { cap: string } | { named: `common:keys.${NamedKey}` }


/**
 * The caps a key's hint shows (K17). Letters and symbols carry their **Latin legend,
 * derived from the code** (`KeyR` → `R`) — data, printed on either layout, never
 * translated. Named keys are words, and go through `common:keys.*`. Shift+`Slash` is the
 * one cap `?`, as it is printed on the key.
 */
export function legendOf(keys: string): LegendPart[] {
  const p = parseKeys(keys)
  if (!p) return [{ cap: keys }]
  // Only what the registry binds is drawn: Ctrl, Shift, a letter, `/`, Enter and Esc.
  const parts: LegendPart[] = []
  if (p.ctrl) parts.push({ named: 'common:keys.ctrl' })
  if (p.shift && p.base === 'Slash') return [...parts, { cap: '?' }]
  if (p.shift) parts.push({ named: 'common:keys.shift' })
  if (p.base === 'Enter') parts.push({ named: 'common:keys.enter' })
  else if (p.base === 'Escape') parts.push({ named: 'common:keys.esc' })
  else if (p.base.startsWith('Key')) parts.push({ cap: p.base.slice(3) })
  else parts.push({ cap: p.base === 'Slash' ? '/' : p.base })
  return parts
}

/**
 * A key's hint as one string, for a string-only sink (a button's tooltip). `+` is the
 * chord's notation between key names, like `aria-keyshortcuts`' — not copy. The caller
 * isolates the WHOLE string (`fsi`), never its caps.
 */
export function legendText(keys: string, t: (key: string) => string): string {
  return legendOf(keys)
    .map((part) => ('cap' in part ? part.cap : t(part.named)))
    .join('+')
}

/** The `aria-keyshortcuts` value (WAI-ARIA: `Control+Enter`, `R`, `/`, `Shift+?`). */
export function ariaKeyShortcuts(keys: string): string {
  const p = parseKeys(keys)
  if (!p) return keys
  const base =
    p.base === 'Enter' || p.base === 'Escape' ? p.base
    : p.base.startsWith('Key') ? p.base.slice(3)
    : p.base === 'Slash' ? (p.shift ? '?' : '/')
    : p.base
  return [p.ctrl && 'Control', p.alt && 'Alt', p.shift && 'Shift', base].filter(Boolean).join('+')
}

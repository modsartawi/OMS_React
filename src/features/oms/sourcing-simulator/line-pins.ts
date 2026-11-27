/**
 * The pins as the page holds them (ticket 963; review 4354 #1). Pure.
 *
 * A line pin (`LINE_STORE`, `LINE_MODE`) is set from a plan on screen, which names its line by the number the run sent.
 * The request numbers a built cart's filled rows by position (`adviseRequest`), so a number goes stale the moment a row
 * is emptied, removed or added. A held line pin therefore stands by what the number named in that run: the editor row
 * (its `key`), or — for a replay — the replayed order's own line. Each request maps it back to a line number:
 *
 * - a row's pin is sent under the row's place among the filled rows now, and goes when its row is removed or emptied;
 * - a replayed order's pin is sent only with a replay of that same order;
 * - so a cart's line pins never ride with a replay, nor a replay's with a cart or another order.
 *
 * Pins on no line (never this store, never this mode, one shipment) go with every run.
 */
import type { AdvisePin } from '@/core/models/sourcing-run'
import type { CartForm } from './cart'
import { pinKey } from './pins-model'
import type { ReplayForm, StartKind } from './replay'

/** What the line numbers of a run name: a built cart's filled rows in order (line n is `keys[n - 1]`), or an order's lines. */
export type RunLines = { keys: number[] } | { orderNumber: string }

/** What a line pin stands by: an editor row, or one line of a replayed order. */
export type PinRow = { key: number } | { orderNumber: string; lineNo: number }

export interface HeldPin {
  pin: AdvisePin
  /** Null for a pin on no line. */
  row: PinRow | null
}

/** What the page is set to run now. */
export interface PinScope {
  start: StartKind
  form: CartForm
  replay: ReplayForm
}

type LinePin = Extract<AdvisePin, { lineNo: number }>
const isLinePin = (p: AdvisePin): p is LinePin => p.kind === 'LINE_STORE' || p.kind === 'LINE_MODE'

const filledKeys = (form: CartForm) => form.lines.filter((l) => l.item.trim() !== '').map((l) => l.key)

/** What the line numbers of a run started from `scope` name. Read when the run is sent, kept with it. */
export const runLines = (scope: PinScope): RunLines =>
  scope.start === 'build' ? { keys: filledKeys(scope.form) } : { orderNumber: scope.replay.orderNumber.trim() }

/** A pin set from the plans of a run whose lines are `lines`; null for a line the run never sent. */
export function holdPin(pin: AdvisePin, lines: RunLines): HeldPin | null {
  if (!isLinePin(pin)) return { pin, row: null }
  if ('orderNumber' in lines) return { pin, row: { orderNumber: lines.orderNumber, lineNo: pin.lineNo } }
  const key = lines.keys[pin.lineNo - 1]
  return key === undefined ? null : { pin, row: { key } }
}

/** The pin as the request for `scope` sends it, or null when it does not go with that run. */
function sent(h: HeldPin, scope: PinScope): AdvisePin | null {
  if (!h.row || !isLinePin(h.pin)) return h.pin
  if ('key' in h.row) {
    if (scope.start !== 'build') return null
    const at = filledKeys(scope.form).indexOf(h.row.key)
    return at < 0 ? null : { ...h.pin, lineNo: at + 1 }
  }
  return scope.start === 'replay' && scope.replay.orderNumber.trim() === h.row.orderNumber ? h.pin : null
}

/** The pins the request for `scope` sends, in the order they were set. */
export const pinsNow = (held: readonly HeldPin[], scope: PinScope): AdvisePin[] =>
  held.flatMap((h) => {
    const p = sent(h, scope)
    return p ? [p] : []
  })

/** The held pins that still go with `scope`: a changed cart or a switch of start drops the line pins it orphans. */
export const keepHeld = (held: readonly HeldPin[], scope: PinScope): HeldPin[] => held.filter((h) => sent(h, scope) !== null)

const rowKey = (row: PinRow) => ('key' in row ? `row:${row.key}` : `order:${row.orderNumber}:${row.lineNo}`)

/** One key per held pin: a line pin by its row, so the same pin from another line number is still the same pin. */
const heldKey = (h: HeldPin): string => {
  if (!h.row || !isLinePin(h.pin)) return pinKey(h.pin)
  return `${h.pin.kind}:${rowKey(h.row)}:${h.pin.kind === 'LINE_STORE' ? h.pin.store : h.pin.mode}`
}

export const isHeld = (held: readonly HeldPin[], h: HeldPin) => held.some((x) => heldKey(x) === heldKey(h))

/** A row has at most one store pin and one mode pin: a second takes the first one's place. */
const displaces = (old: HeldPin, h: HeldPin) => !!old.row && !!h.row && old.pin.kind === h.pin.kind && rowKey(old.row) === rowKey(h.row)

export function addHeld(held: readonly HeldPin[], h: HeldPin): HeldPin[] {
  if (isHeld(held, h)) return [...held]
  const at = held.findIndex((old) => displaces(old, h))
  return at < 0 ? [...held, h] : held.map((old, i) => (i === at ? h : old))
}

export const dropHeld = (held: readonly HeldPin[], h: HeldPin): HeldPin[] => held.filter((x) => heldKey(x) !== heldKey(h))

/** A plan's pin button: pressed sets the pin (in place of another on its row), pressed again takes it off. */
export const toggleHeld = (held: readonly HeldPin[], h: HeldPin): HeldPin[] => (isHeld(held, h) ? dropHeld(held, h) : addHeld(held, h))

/** Removes the held pin that the request for `scope` sends as `pin` (a chip's remove). */
export const dropSent = (held: readonly HeldPin[], pin: AdvisePin, scope: PinScope): HeldPin[] =>
  held.filter((h) => {
    const p = sent(h, scope)
    return !p || pinKey(p) !== pinKey(pin)
  })

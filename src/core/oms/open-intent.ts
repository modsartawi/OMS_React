/**
 * The one-shot `open` intent (ticket 401, spec 380 L14, D9; rulings 367 §3, 371).
 *
 * The Deliveries list posts nothing. Its R / C / N keys and the inspector's act rows navigate
 * to Delivery details with this as **router state**, and Details opens that command's dialog
 * through **its own command gate**, once, after the header loads. So every act keeps one
 * implementation, with 083's evidence-only gates.
 *
 * It lives in `@/core` because two features share it, the list (the sender) and the
 * `document` feature (the consumer), and neither may import the other. They share only the
 * route and this shape.
 *
 * 🚩 **Router state, never a URL param**, and Details replaces it away as soon as it reads it:
 * a reload, a Back or a pasted link never pops a write dialog.
 */

/** The three acts the list offers, named as Delivery details' commands are. */
export const OPEN_INTENTS = ['reschedule', 'request-close', 'add-note'] as const
export type OpenIntent = (typeof OPEN_INTENTS)[number]

/**
 * The mark every one of the list's ways into Details leaves on the history entry (ticket 405,
 * D10): Enter, a double-click, Open full record and the acts. Details' Esc reads it to go back
 * with **history-back**, which lands on the list's own entry, its query and current row intact.
 * Without it (a pasted link, a palette jump) Esc goes to the list route instead, as the header's
 * chevron does. It is kept when the intent is replaced away.
 */
export interface FromListState {
  from: 'list'
}

export function fromListState(): FromListState {
  return { from: 'list' }
}

/** Whether this history entry was opened from the list. */
export function cameFromList(state: unknown): boolean {
  return isRecord(state) && state.from === 'list'
}

/** The router state the list navigates with when it asks for an act. */
export interface OpenIntentState extends FromListState {
  open: OpenIntent
}

export function openIntentState(intent: OpenIntent): OpenIntentState {
  return { ...fromListState(), open: intent }
}

function isOpenIntent(value: unknown): value is OpenIntent {
  return typeof value === 'string' && (OPEN_INTENTS as readonly string[]).includes(value)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** The intent a history entry carries, read defensively: anything else is none. */
export function openIntentOf(state: unknown): OpenIntent | null {
  return isRecord(state) && isOpenIntent(state.open) ? state.open : null
}

/**
 * The router state with the intent taken out and the rest kept — what Details replaces the
 * entry with. `null` when nothing else was there; the same value when there was no intent.
 */
export function withoutOpenIntent(state: unknown): unknown {
  if (!isRecord(state) || !('open' in state)) return state
  const { open: _open, ...rest } = state
  return Object.keys(rest).length > 0 ? rest : null
}

/** What the page's command gate says about one command: the bar's own state for it. */
export interface IntentGateAnswer {
  disabled: boolean
  /** Why it is refused — the words of its button's tooltip. `null` when busy or takeable. */
  reason: string | null
}

/** The page's gate, asked about one command. `null` when the page has no such command. */
export type IntentGate = (intent: OpenIntent) => IntentGateAnswer | null | undefined

/**
 * - `open` — the command is takeable: open its dialog.
 * - `refuse` — the gate refuses it: open nothing, and say why (the ring, the tooltip and a
 *   warn toast carrying `reason`).
 */
export type IntentResolution =
  | { outcome: 'open'; intent: OpenIntent }
  | { outcome: 'refuse'; intent: OpenIntent; reason: string }

/**
 * An intent through the page's own gate. `null` — nothing to do — for anything that is not
 * one of the three intents, a command the page does not have, or one disabled with no reason
 * (the page is busy: there is nothing to explain, and nothing may open).
 */
export function resolveOpenIntent(intent: unknown, gate: IntentGate): IntentResolution | null {
  if (!isOpenIntent(intent)) return null
  const answer = gate(intent)
  if (!answer) return null
  if (!answer.disabled) return { outcome: 'open', intent }
  return answer.reason ? { outcome: 'refuse', intent, reason: answer.reason } : null
}

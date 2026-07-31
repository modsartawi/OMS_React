/**
 * The command palette's rows (ticket 192) — a `SessionState` in, the acts the
 * order can do out.
 *
 * It is a module rather than component state for the reason [153](.issues/153-console-keyboard-grammar.md)
 * gave the whole keyboard grammar: every rule here is about a key that can reach
 * a **terminal act**, and a rule living inside a `useState` reducer is a rule no
 * test can reach. Three of them in particular:
 *
 * 🚩 **The two terminal acts sort last and are never the auto-highlighted row.**
 * *Place order* and *Abandon call* are palette rows and nothing else — that is
 * the whole of the keyboard's access to them — so a mistyped `Enter` must not be
 * able to land on one. When a query matches *only* a terminal, `autoHighlight`
 * is `null` and the agent has to press `↓`. That is one deliberate key between
 * the keyboard and the end of a call.
 *
 * 🚩 **A refused verb is a disabled row carrying its reason** — the console's one
 * deliberate exception to the standing law that a control the door would refuse
 * is worse than no control (165/167/175). The law is about a control the agent's
 * hand *lands on*; the palette is a question the agent **asked**, and an empty
 * answer to a deliberate question teaches nothing. Disabled rows stay
 * highlightable and running one does nothing, because skipping them would hide
 * the very reason the exception exists.
 *
 * 🚩 **Enablement is never a predicate of this module's own.** A row is enabled
 * exactly when the caller handed it a `run` — which is the same handler the chip,
 * the button or the rail already reads, derived once by the page off
 * `capabilities`. `highlight.ts` calls this *one gate, never a second predicate*;
 * here it is what stops the palette offering an act the chip row has withdrawn.
 * The **reason** is a separate `capabilityReasons` lookup (plus the one
 * precondition the contract states outright — see `NEEDS_CALLER`), so the
 * failure mode of a reason this console has no words for is a vague sentence and
 * never a wrong refusal.
 *
 * Like `guidance-view` and `discount-definition`, nothing user-visible is
 * authored here: every phrase is a **key**, resolved by the render tier with
 * `t()`.
 */
import type { SessionCapabilities } from '@/core/models/callcenter'
import type { GuidanceView } from './guidance-view'
import { highlightedIndex, type HighlightState } from './highlight'
import { submitBlockers } from './submit-blockers'

/**
 * An i18n key and, where the key is one the server named, **the key to fall back
 * to when this console has no words for it**.
 *
 * 🚩 The fallback rides WITH the phrase rather than being decided at the call
 * site, which is the shape `fulfilment.locked.*` already degrades through in the
 * chip row: a `capabilityReasons` code minted by a later server (§9 — additive
 * changes ship server-first) must reach the agent as the general sentence, never
 * as a raw key on screen.
 */
export interface PalettePhrase {
  key: string
  fallbackKey?: string
}

/**
 * The order-level acts, in the order they are listed. **Line verbs are
 * deliberately absent**: `changeQty`, `changeUom` and `voidLine` take a *line*,
 * and a row for them needs a second step. The palette is one level deep and its
 * object is the order — which also keeps the highest-risk of the three, *void*,
 * aimed at a line the agent is looking at.
 */
export type PaletteVerb =
  /** 🚩 Also the way home for an agent whose focus is stranded on a chip. */
  | 'searchItems'
  | 'addressBook'
  | 'changeStore'
  | 'slot'
  | 'source'
  | 'note'
  | 'fulfilment'
  | 'payment'
  | 'coupon'
  | 'attachCaller'
  | 'removeCaller'
  | 'refresh'

/** The two acts that end a call. Sorted last, always, and never auto-aimed. */
export type PaletteTerminal = 'place' | 'abandon'

export type PaletteRowKind = 'offer' | 'verb' | 'terminal'

export interface PaletteRow {
  /** Stable across a re-render: the React key, and the drive's handle. */
  id: string
  kind: PaletteRowKind
  /** The console's own word for the row. */
  label: PalettePhrase
  /**
   * Server-supplied text beside the label — an offer's description, passed
   * through as data (§7). `null` on every row the console words itself.
   */
  detail: string | null
  /** 🚩 `run !== null`. Never a predicate of this module's own. */
  enabled: boolean
  /** Why not, when it is not. `null` on an enabled row. */
  reason: PalettePhrase | null
  /** The act itself — the very handler the row's other surface already calls. */
  run: (() => void) | null
}

/**
 * Everything the palette can run, exactly as the page already derived it for the
 * chip row, the rail and the receipt.
 *
 * 🚩 Handlers rather than booleans on purpose. A palette that took
 * `capabilities` and re-decided which verbs are live would be a second reading
 * of the same rule, and the one that went stale would be the one the keyboard
 * reaches. Here a withdrawn handler withdraws the act from **both** surfaces by
 * construction.
 */
export interface PaletteActions {
  verbs: Partial<Record<PaletteVerb, (() => void) | null | undefined>>
  place?: (() => void) | null
  abandon?: (() => void) | null
  /**
   * What an offer row does: **narrow the item search to that offer and land the
   * caret in the box** — 172's own hand-off, the console's single route from an
   * offer to an add.
   *
   * 🚩 It is not a one-click add, and that is a ruling rather than a shortfall.
   * A near-miss names no item to add (`NearMiss` carries a prerequisite, not a
   * material the agent can put on the order — `prereq.materialNumber` is absent
   * on every grouping), so an add row would need `ResolvePrereq` run for every
   * actionable offer at the instant the palette opens. The strip resolves one
   * card, on demand, when it is expanded. The palette instead gives the offer
   * strip the keyboard path US91 asks for, and the add stays where it is aimed.
   */
  onOffer?: ((offerId: string, description: string) => void) | null
}

/**
 * Which capability shuts each verb, and the key family whose words explain it.
 *
 * 🚩 The families are the EXISTING ones. A palette with reason wording of its
 * own would be a second sentence for the same refusal, and the day the chip
 * row's is corrected is the day the two disagree — about a rule the agent reads
 * out to a caller. `palette.reason.*` covers only the capabilities no other
 * surface words.
 */
const REASON_FAMILY: Partial<Record<PaletteVerb, { capability: string; family: string }>> = {
  addressBook: { capability: 'canOpenAddressBook', family: 'palette.reason' },
  changeStore: { capability: 'canChangeStore', family: 'palette.reason' },
  fulfilment: { capability: 'canChangeFulfilment', family: 'fulfilment.locked' },
  payment: { capability: 'canChangePaymentType', family: 'payment.locked' },
  // 🚩 `coupon` is deliberately absent. A shut apply-gate is not a shut row
  // (189): the modal opens on the OPEN rule alone, because the order may hold a
  // coupon the agent has to read out, and the modal is where the shut gate is
  // stated. A reason here would name a refusal the row does not carry.
}

/** The store chip's own sentence, borrowed for the palette's row (see below). */
export const STORE_FOLLOWS_ADDRESS = 'store.followsAddress'

/** The phrase any refusal this console has no words for falls back to. */
export const VAGUE_REASON = 'palette.reason.unknown'

/**
 * The one refusal the CONTRACT itself states, quoted rather than guessed.
 *
 * §6.3's attach-before-address ordering is the contract's own sentence — the
 * address book is the customer's, so without a customer there is no book — and
 * `NO_CUSTOMER_ATTACHED` is the code its own verb refuses with. 153 asked for
 * exactly this: where the contract names the precondition, say it.
 *
 * 🚩 It is guarded on a FACT the projection carries (`hasCaller`), never on a
 * guess about why a capability is false. That is what keeps 192's rule intact —
 * *a missing reason is a vague sentence and never a wrong refusal* — because
 * with no caller on the order this sentence is true whatever else is also true.
 * No other verb gets one: `capabilityReasons` is where the rest belong.
 */
const NEEDS_CALLER = 'palette.reason.NO_CUSTOMER_ATTACHED'

/** The order the verbs are listed in. `attachCaller`/`removeCaller` is one slot
 *  holding whichever of the two the order's state makes true. */
const VERB_ORDER: PaletteVerb[] = [
  'searchItems',
  'addressBook',
  'changeStore',
  'slot',
  'source',
  'note',
  'fulfilment',
  'payment',
  'coupon',
  'attachCaller',
  'removeCaller',
  'refresh',
]

export interface PaletteInput {
  /**
   * 🚩 The strip's own view model, **passed in rather than re-derived**. It is
   * read once in `ConsoleShell` — where the top-bar count is also read from it —
   * so the palette, the strip and the count cannot disagree about what is
   * actionable. A `paletteRows` that took `nearMisses` and called `guidanceView`
   * itself would be the second read this shape exists to prevent.
   */
  guidance: GuidanceView
  /** Read ONLY for `capabilityReasons`. Never for enablement — see `PaletteActions`. */
  capabilities: SessionCapabilities
  /** Whether a caller is on the order: which of the two caller rows exists. */
  hasCaller: boolean
  /**
   * Whether the order is COLLECTED. Read for one sentence only: a delivery
   * order's store is derived from the caller's address, so *Change store* is
   * refused there for a reason no capability carries — and a row that fell
   * through to the vague phrase would tell the agent nothing at the moment they
   * are looking for the picker.
   */
  pickup: boolean
  actions: PaletteActions
}

/**
 * Every row, in the one order the palette ever shows them: **actionable offers,
 * then the order verbs, then the two terminal acts**.
 *
 * The order is load-bearing rather than cosmetic. Offers lead because they are
 * the live, perishable half of the screen and the strip had no keyboard path at
 * all (153's headline finding). The terminals trail because sorting them last is
 * half of what stops a mistyped `Enter` reaching them — `autoHighlight` is the
 * other half.
 */
export function paletteRows({
  guidance,
  capabilities,
  hasCaller,
  pickup,
  actions,
}: PaletteInput): PaletteRow[] {
  const rows: PaletteRow[] = []

  // 1. The offers within reach — the same cards the strip draws and the same
  //    count the top bar mirrors.
  for (const card of guidance.actionable) {
    const run = actions.onOffer ? () => actions.onOffer?.(card.offerId, card.description) : null
    rows.push({
      id: `offer:${card.cardId}`,
      kind: 'offer',
      label: { key: 'palette.offer' },
      // Server text, passed through as data — never re-worded (§7).
      detail: card.description,
      enabled: run !== null,
      reason: run !== null ? null : { key: VAGUE_REASON },
      run,
    })
  }

  // 2. The order verbs, one row each.
  for (const verb of VERB_ORDER) {
    // The caller slot holds exactly one row: *Attach* while the order has no
    // caller, *Remove* once it has one — the same two states the rail draws.
    if (verb === 'attachCaller' && hasCaller) continue
    if (verb === 'removeCaller' && !hasCaller) continue
    const run = actions.verbs[verb] ?? null
    rows.push({
      id: `verb:${verb}`,
      kind: 'verb',
      label: { key: `palette.verb.${verb}` },
      detail: null,
      enabled: run !== null,
      reason: run !== null ? null : refusalOf(verb, capabilities, hasCaller, pickup),
      run,
    })
  }

  // 3. The two terminal acts, last. 🚩 *Place order* borrows the receipt's own
  //    reason: `submitBlockers` is the server's list, already worded, and a
  //    palette that said something else about a dead submit would be a second
  //    answer to US54's question.
  rows.push(
    terminal('place', actions.place ?? null, firstBlocker(capabilities)),
    terminal('abandon', actions.abandon ?? null, null),
  )
  return rows
}

function terminal(
  name: PaletteTerminal,
  run: (() => void) | null,
  reason: PalettePhrase | null,
): PaletteRow {
  return {
    id: `terminal:${name}`,
    kind: 'terminal',
    label: { key: `palette.terminal.${name}` },
    detail: null,
    enabled: run !== null,
    reason: run !== null ? null : (reason ?? { key: VAGUE_REASON }),
    run,
  }
}

/**
 * Why a verb is refused, in the agent's words.
 *
 * 🚩 The code is the SERVER's (`capabilityReasons`, keyed by the capability that
 * is false) and is never interpolated into the sentence — a wire code on screen
 * is a sentence the agent cannot say to a caller. A verb with no capability of
 * its own (the slot, the source, the note: §2 lists none, and the page shuts
 * them with the order) and a capability the server gave no reason for both land
 * on the same vague phrase, which is the honest thing this module can say.
 */
function refusalOf(
  verb: PaletteVerb,
  capabilities: SessionCapabilities,
  hasCaller: boolean,
  pickup: boolean,
): PalettePhrase {
  const gate = REASON_FAMILY[verb]
  const code = gate ? capabilities.capabilityReasons?.[gate.capability] : undefined
  if (gate && code) return { key: `${gate.family}.${code}`, fallbackKey: `${gate.family}.unknown` }
  // The server said nothing. One precondition the contract states outright, and
  // otherwise the honest vague sentence.
  if (verb === 'addressBook' && !hasCaller) return { key: NEEDS_CALLER }
  // 🚩 The store on a delivery order is not refused by a capability — it is not
  // a choice at all (the district rule derives it at `setAddress`, 166). Worded
  // with the SAME sentence the chip row uses, per the families rule above: two
  // surfaces, one refusal, no way for them to drift apart.
  if (verb === 'changeStore' && !pickup) return { key: STORE_FOLLOWS_ADDRESS }
  return { key: VAGUE_REASON }
}

/**
 * The first thing the server says this order is waiting for.
 *
 * First rather than all of them: a palette row is one line, and the list is in
 * the server's own order of priority (`submit-blockers.ts` keeps that order
 * deliberately). The receipt still names every one of them — this is a pointer
 * at the same list, not a replacement for it.
 */
function firstBlocker(capabilities: SessionCapabilities): PalettePhrase | null {
  const blocker = submitBlockers(capabilities.submitBlockers)[0]
  return blocker ? { key: blocker.key } : null
}

/**
 * The rows a typed query leaves, in the same order.
 *
 * 🚩 The matching is done over the **rendered** text, which is why the caller
 * hands in a `textOf`: the labels here are i18n keys (zero-literal), and a
 * module that matched against `palette.verb.changeStore` would have the agent
 * typing key names. Order is never touched — a filter that re-ranked by score
 * could float a terminal act above a verb, which is exactly what sorting them
 * last exists to prevent.
 */
export function filterRows(
  rows: PaletteRow[],
  query: string,
  textOf: (row: PaletteRow) => string,
): PaletteRow[] {
  const needle = query.trim().toLowerCase()
  if (needle === '') return rows
  return rows.filter((row) => textOf(row).toLowerCase().includes(needle))
}

/**
 * The row the palette aims at **before the agent has pressed anything**.
 *
 * 🚩 The first row that is not a terminal act, or `null` when there is none.
 * That single rule is the whole of ruling 3's second guard: a query matching only
 * *Abandon call* aims at nothing, `Enter` does nothing, and reaching it costs a
 * deliberate `↓`.
 *
 * A **disabled** row is aimed at like any other — it is the answer to a question
 * the agent asked, and skipping it would hide the reason the disabled row exists
 * to carry.
 */
export function autoHighlight(rows: PaletteRow[]): number | null {
  const index = rows.findIndex((row) => row.kind !== 'terminal')
  return index === -1 ? null : index
}

/**
 * **The question an aim answers** — the typed query AND the rows it produced.
 *
 * 🚩 191's rule is that a highlight belongs to a *term*, not to a list, so a new
 * question drops it by construction. On the palette the list can change without
 * the query changing at all: the rows are rebuilt from `SessionState`, so an add
 * landing, a capability flipping or an offer arriving mid-call reshuffles them
 * under an open palette. An index carried across that names a **different row**,
 * and the row it slides onto is drawn from a list whose last two entries end the
 * call. Folding the row ids into the term makes any such change a new question,
 * which falls the aim back to `autoHighlight` — and `autoHighlight` never aims
 * at a terminal act.
 */
export function paletteQuestion(rows: PaletteRow[], query: string): string {
  return `${query}
${rows.map((row) => row.id).join(',')}`
}

/**
 * Where the highlight actually is — 191's `highlight.ts` for the arrows, with
 * the palette's auto-aim underneath it.
 *
 * The two lists differ in exactly one way and it is deliberate. Over search
 * results **nothing** is highlighted until `↓`, because the top row is a
 * relevance guess and `Enter` there puts a line on a live order. In the palette
 * `Enter` runs a row the agent has NAMED by typing, so the top match is aimed
 * from the start — and the acts where that would be dangerous are the two that
 * `autoHighlight` refuses to aim at.
 *
 * `armed` is always true here: unlike the search list there is no door to be
 * shut, because a disabled row is drawn rather than withheld and running one
 * does nothing.
 *
 * 🚩 `question` is `paletteQuestion`'s, never the bare query — see there for the
 * failure that distinction closes.
 */
export function paletteAim(state: HighlightState, rows: PaletteRow[], question: string): number | null {
  const carried = highlightedIndex(state, { count: rows.length, term: question, armed: true })
  return carried ?? autoHighlight(rows)
}

/**
 * What `Enter` runs — and the one place that answers *nothing*.
 *
 * A disabled row returns `null` rather than being skipped over: the agent asked,
 * the answer is the reason on the row, and the key does nothing at all.
 */
export function paletteRun(rows: PaletteRow[], aim: number | null): PaletteRow | null {
  if (aim === null) return null
  const row = rows[aim]
  return row?.enabled && row.run ? row : null
}

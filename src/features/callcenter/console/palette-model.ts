/**
 * The console's commands — a `SessionState` in, the acts the order can do out, as
 * the "This screen" rows of the app-wide palette (ticket 192, moved onto the core
 * palette by 395; spec 380 K19, ruling 364 §5).
 *
 * The console no longer runs a palette of its own. `ConsoleShell` hands this
 * module's output to `useCommands`, and `@/core/commands` lists, filters, aims and
 * runs it — with Go to, Jump to number and Recent under it. What stays here is
 * what only the console knows: which acts exist, in what order, and in whose words
 * a refused one is explained. It is a module rather than component state for the
 * reason [153](.issues/153-console-keyboard-grammar.md) gave the whole keyboard
 * grammar: every rule here is about a key that can reach a **terminal act**, and a
 * rule living inside a component is a rule no test can reach.
 *
 * 🚩 **The two terminal acts are `terminal` commands.** *Place order* and *Abandon
 * call* are palette rows and nothing else — that is the whole of the keyboard's
 * access to them. The core sorts a terminal row last and never auto-aims at it, so
 * a query matching only *Abandon call* aims at nothing and reaching it costs a
 * deliberate `↓` (192's ruling 3, now a property any screen can use). The core's
 * registry also refuses `keys` on a terminal command: 153 stands whole, and there
 * is no place-order chord (365 §7). Nothing here carries `keys` at all.
 *
 * 🚩 **A refused verb is a disabled row carrying its reason** — the console's one
 * deliberate exception to the standing law that a control the door would refuse
 * is worse than no control (165/167/175). The law is about a control the agent's
 * hand *lands on*; the palette is a question the agent **asked**, and an empty
 * answer to a deliberate question teaches nothing.
 *
 * 🚩 **Enablement is never a predicate of this module's own.** A command is
 * enabled exactly when the caller handed it a `run` — the same handler the word,
 * the button or the caller bar already reads, derived once by the page off
 * `capabilities`. The **reason** is a separate `capabilityReasons` lookup (plus
 * the one precondition the contract states outright — see `NEEDS_CALLER`), so the
 * failure mode of a reason this console has no words for is a vague sentence and
 * never a wrong refusal.
 *
 * Nothing user-visible is authored here: every phrase is a `callcenter:` **key**,
 * resolved by the palette with `t()`.
 */
import type { SessionCapabilities } from '@/core/models/callcenter'
import type { Command } from '@/core/commands/palette-model'
import type { GuidanceView } from './guidance-view'
import { submitBlockers } from './submit-blockers'

/** The console's namespace: the core palette resolves a key with its namespace. */
const NS = 'callcenter:'

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
interface PalettePhrase {
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

/** The two acts that end a call: `terminal` commands, so sorted last and never auto-aimed. */
export type PaletteTerminal = 'place' | 'abandon'

/**
 * Everything the palette can run, exactly as the page already derived it for the
 * sentence, the caller bar and the receipt.
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

/** The delivery store readout's own sentence (its title, 408), borrowed for the
 *  palette's row (see below) — one sentence for one fact in both places. */
export const STORE_FOLLOWS_ADDRESS = `${NS}sentence.storeFollows`

/** The phrase any refusal this console has no words for falls back to. */
export const VAGUE_REASON = `${NS}palette.reason.unknown`

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
const NEEDS_CALLER = `${NS}palette.reason.NO_CUSTOMER_ATTACHED`

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
   * actionable.
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
  /**
   * Whether a (namespaced) key has words in the bundle — `i18n.exists`. Read only
   * to fall a server-named reason back to its family's general sentence.
   */
  known: (key: string) => boolean
}

/**
 * Every command, in the one order the console lists them: **actionable offers,
 * then the order verbs, then the two terminal acts**.
 *
 * The order is load-bearing rather than cosmetic. Offers lead because they are
 * the live, perishable half of the screen and the strip had no keyboard path at
 * all (153's headline finding). The terminals trail — and the core lists every
 * terminal row last anyway, after Go to and Jump.
 */
export function paletteCommands({
  guidance,
  capabilities,
  hasCaller,
  pickup,
  actions,
  known,
}: PaletteInput): Command[] {
  const said = (phrase: PalettePhrase) => wordedKey(phrase, known)
  const commands: Command[] = []

  // 1. The actionable offers — the same cards the strip draws. 🚩 A get-side
  //    shortfall (spec 412) is counted in the top bar but gets no row here: this
  //    row narrows the search to the offer's PREREQUISITE, which a shortfall has
  //    already met (for a coupon-gated one, the campaign voucher). It waits for a
  //    reward product, and that route is `ResolveReward` (415), not this search.
  for (const card of guidance.actionable) {
    const run = actions.onOffer ? () => actions.onOffer?.(card.offerId, card.description) : null
    commands.push({
      id: `offer:${card.cardId}`,
      label: `${NS}palette.offer`,
      // Server text, passed through as data — never re-worded (§7).
      detail: card.description,
      run,
      reason: VAGUE_REASON,
    })
  }

  // 2. The order verbs, one command each.
  for (const verb of VERB_ORDER) {
    // The caller slot holds exactly one row: *Attach* while the order has no
    // caller, *Remove* once it has one — the same two states the caller bar draws.
    if (verb === 'attachCaller' && hasCaller) continue
    if (verb === 'removeCaller' && !hasCaller) continue
    commands.push({
      id: `verb:${verb}`,
      label: `${NS}palette.verb.${verb}`,
      run: actions.verbs[verb] ?? null,
      reason: said(refusalOf(verb, capabilities, hasCaller, pickup)),
    })
  }

  // 3. The two terminal acts, last. 🚩 *Place order* borrows the receipt's own
  //    reason: `submitBlockers` is the server's list, already worded, and a
  //    palette that said something else about a dead submit would be a second
  //    answer to US54's question.
  commands.push(
    terminal('place', actions.place ?? null, firstBlocker(capabilities)),
    terminal('abandon', actions.abandon ?? null, null),
  )
  return commands
}

/** A terminal act: `terminal`, and never `keys` (the core registry would refuse them). */
function terminal(name: PaletteTerminal, run: (() => void) | null, reason: string | null): Command {
  return {
    id: `terminal:${name}`,
    label: `${NS}palette.terminal.${name}`,
    run,
    reason: reason ?? VAGUE_REASON,
    terminal: true,
  }
}

/** The key whose words are said: the server-named one, or its family's general sentence. */
function wordedKey({ key, fallbackKey }: PalettePhrase, known: (key: string) => boolean): string {
  return fallbackKey && !known(key) ? fallbackKey : key
}

/**
 * Why a verb is refused, in the agent's words. Computed for every verb; the core
 * reads it only when the row is refused (no handler).
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
  if (gate && code) return { key: `${NS}${gate.family}.${code}`, fallbackKey: `${NS}${gate.family}.unknown` }
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
function firstBlocker(capabilities: SessionCapabilities): string | null {
  const blocker = submitBlockers(capabilities.submitBlockers)[0]
  return blocker ? `${NS}${blocker.key}` : null
}

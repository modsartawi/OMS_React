/**
 * The order header as a sentence the agent can say, over a ledger of bookkeeping
 * (spec 380 C3–C6, ticket 408; decided in 373, variant D).
 *
 * `header-chips.ts` stays **the one pure model of slot state** — settled, or needing
 * attention off the server's `submitBlockers`, plus the derived and lapsed flags — and this
 * module only re-reads it as words. It adds the three facts no chip carried: the **mode
 * word**, the **address** and the **caller's name**. The attention rule stays
 * `submitBlockers`, and only that: nothing here decides an order needs something.
 *
 * - **Line 1, the sentence, one shape per mode:**
 *   `‹Deliver› to ‹address› for ‹caller› from ‹store› at ‹window›, ‹payment›.` or
 *   `‹Collect› from ‹store› for ‹caller›, ‹payment›.` A mode flip rewrites it: the address
 *   and the window leave, and the store becomes a control (176's "absent, not disabled").
 * - **Line 2, the ledger:** Source · Ref · Coupon · Note as labelled fields — what the agent
 *   logs, not what they say to the caller.
 *
 * The words' ORDER on screen is the translation's, not this module's: each shape is one
 * `callcenter` key with named self-closing slot tags (`SENTENCE_KEY`, `wordTag`), rendered
 * by `<Trans components>`. The lists below are in the English order only for reading.
 */
import type { SessionState, SessionAddress } from '@/core/models/callcenter'
import { formatPair } from '@/core/util/bidi'
import { capabilityGate, isPickup } from './fulfilment-view'
import { headerChips, type ChipState, type HeaderChip, type HeaderSlotId } from './header-chips'
import { blockedChips } from './submit-blockers'

export type SentenceShape = 'delivery' | 'collection'

/**
 * A slot's look (C4):
 * - **settled** — a bordered word;
 * - **blocked** — the server lists it in `submitBlockers`: a dashed attention fill;
 * - **ghost** — empty, and nothing is waiting on it, so it is optional: a ghost word;
 * - **readout** — a plain word, not a control.
 */
export type WordLook = 'settled' | 'blocked' | 'ghost' | 'readout'

export interface HeaderWord {
  /** Stable id — the chip id it re-reads (the drives' `data-cc-chip` handle), or one of
   *  the sentence's own two facts, `address` and `caller`. */
  id: HeaderSlotId
  look: WordLook
  /** header-chips' state, carried through for the drives (`data-cc-chip-state`). */
  state: ChipState
  /** Server-supplied text, one whole value. Null renders `emptyKey`. */
  value: string | null
  /** The full i18n key for the two words the console words itself (the mode and the
   *  payment) — set instead of `value`. */
  valueKey?: string
  /** The full i18n key the word reads while it holds nothing. */
  emptyKey: string
  /**
   * How the value is isolated (spec 380 F24): `ltr` for a machine value — a code, the
   * reference, coupons, a `code · name` pair and every window — and `auto` (`<bdi>`) for
   * free text: the caller's name, the address, the note.
   */
  isolate: 'ltr' | 'auto'
  /**
   * Whether this word can open anything at all. Readouts never can; the page still
   * decides per order (it passes a handler only while the door will accept the change),
   * and a word is a button only when both say so.
   */
  control: boolean
  /** The delivery store: it follows the address, and says so in its title (the line
   *  the chip row drew under itself, retired). Only while the order is open. */
  follows?: boolean
  /** The window the order holds has lapsed — a warning beside a settled word, never an
   *  attention state (§7's soft gate). */
  lapsed?: boolean
}

export interface HeaderSentence {
  shape: SentenceShape
  /** Line 1, in the English reading order. */
  words: HeaderWord[]
  /** Line 2: Source · Ref · Coupon · Note. */
  ledger: HeaderWord[]
}

/** The one key per sentence shape (C6). */
export const SENTENCE_KEY: Record<SentenceShape, string> = {
  delivery: 'sentence.delivery',
  collection: 'sentence.collection',
}

/**
 * The slot tag a word fills in its sentence key. The tag is the translator's word for the
 * slot, so two of them read as what they are rather than as the chip id: the fulfilment
 * word is the `<mode/>` and the slot is the `<window/>`.
 */
export function wordTag(id: HeaderSlotId): string {
  return id === 'fulfilment' ? 'mode' : id === 'slot' ? 'window' : id
}

/**
 * The address as the agent reads it back: the caller's label, then where it is —
 * `Home · Al Malqa · Riyadh`. One string of free text, isolated once. The district and the
 * city are the two fields the projection sends for exactly this (`rail-view`'s
 * `addressPlace`); the street line is not read out.
 */
function addressWord(address: SessionAddress | null): string | null {
  if (!address) return null
  const said = formatPair(address.label?.trim(), formatPair(address.districtName?.trim(), address.cityName?.trim()))
  return said === '' ? null : said
}

export function headerSentence(state: SessionState): HeaderSentence {
  const { header, capabilities } = state
  const chips = Object.fromEntries(headerChips(header, capabilities).map((chip) => [chip.id, chip])) as Partial<
    Record<HeaderChip['id'], HeaderChip>
  >
  // The SAME table the chips and the receipt read (`submit-blockers.ts`) — so the caller
  // and the address words are marked by the list that names them, never by a guess.
  const blocked = blockedChips(capabilities.submitBlockers)
  const pickup = isPickup(header)

  const lookOf = (state: ChipState, readout = false): WordLook =>
    state === 'needsAttention' ? 'blocked' : readout ? 'readout' : state === 'settled' ? 'settled' : 'ghost'

  const fromChip = (
    chip: HeaderChip,
    emptyKey: string,
    { readout = false, valueKeyFamily }: { readout?: boolean; valueKeyFamily?: string } = {},
  ): HeaderWord => ({
    id: chip.id,
    look: lookOf(chip.state, readout),
    state: chip.state,
    value: chip.value,
    ...(chip.valueKey && valueKeyFamily ? { valueKey: `${valueKeyFamily}.${chip.valueKey}` } : {}),
    emptyKey,
    isolate: chip.ltr ? 'ltr' : 'auto',
    control: !readout,
    ...(chip.lapsed ? { lapsed: true } : {}),
  })

  // Facts the chips never carried: their state is read the chips' way — attention from
  // the server's list, settled when there is a value.
  const ownWord = (id: 'caller' | 'address', value: string | null, control: boolean): HeaderWord => {
    const state: ChipState = blocked.has(id) ? 'needsAttention' : value ? 'settled' : 'unset'
    return {
      id,
      // The caller's name is a readout (the rail owns attach and remove), but a blocked
      // caller still LOOKS blocked: the attention rule is the server's list.
      look: lookOf(state, id === 'caller'),
      state,
      value,
      emptyKey: `sentence.empty.${id}`,
      isolate: 'auto',
      control,
    }
  }

  // 🚩 A shut gate turns the word into a readout (C4), and its reason is said once,
  // under the sentence. The mode chip is always settled, so this is its only other look.
  const modeGate = capabilityGate(capabilities, 'canChangeFulfilment')
  const payGate = capabilityGate(capabilities, 'canChangePaymentType')

  const mode = fromChip(chips.fulfilment!, 'sentence.unworded', {
    readout: !modeGate.open,
    valueKeyFamily: 'sentence.mode',
  })
  // 🚩 An attached caller is never "no caller yet": a blank name reads by the mobile,
  // the rail's own fallback (`railFields`) — a machine value, so isolated left-to-right.
  const callerName = header.customer?.name?.trim() || null
  const callerMobile = callerName ? null : header.customer?.mobile?.trim() || null
  const caller: HeaderWord = {
    ...ownWord('caller', callerName ?? callerMobile, false),
    ...(callerMobile ? { isolate: 'ltr' } : {}),
  }
  // 166: the address book is the caller's, so the address word is its door only once
  // a caller is attached.
  const address = ownWord('address', addressWord(header.address), header.customer != null)
  // 🚩 On a delivery order the store is DERIVED from the address server-side, so it is a
  // readout — a picker beside it would be a second opinion on the district rule. Under
  // collection it is the agent's choice, and a control. STORE_NOT_CHOSEN still marks it.
  const store: HeaderWord = {
    ...fromChip(chips.store!, 'sentence.empty.store', { readout: !pickup }),
    ...(!pickup && state.status === 'open' ? { follows: true } : {}),
  }
  // A payment the client cannot word (a future `Receivable`) has no chip: the word stays,
  // because the sentence needs it, as a readout that says nothing — never a guess.
  const payment: HeaderWord = chips.payment
    ? fromChip(chips.payment, 'sentence.unworded', { readout: !payGate.open, valueKeyFamily: 'sentence.payment' })
    : { id: 'payment', look: 'readout', state: 'unset', value: null, emptyKey: 'sentence.unworded', isolate: 'auto', control: false }

  const words = pickup
    ? [mode, store, caller, payment]
    : [mode, address, caller, store, fromChip(chips.slot!, 'sentence.empty.slot'), payment]

  return {
    shape: pickup ? 'collection' : 'delivery',
    words,
    ledger: [
      fromChip(chips.source!, 'ledger.chooseSource'),
      fromChip(chips.reference!, 'ledger.addReference'),
      fromChip(chips.coupon!, 'ledger.addCoupon'),
      fromChip(chips.note!, 'ledger.addNote'),
    ],
  }
}

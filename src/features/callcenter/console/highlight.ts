/**
 * The keyboard highlight over a list the agent is typing above (ticket 191) —
 * the search results today, the palette's rows next ([192](.issues/192-ctrl-k-reaches-every-order-act.md)).
 *
 * It is a **module rather than component state** for two reasons, and both are
 * about the same defect. First, 192 reuses this grammar verbatim over a
 * different list, and a second copy of "↓ from nothing is the first row" is a
 * second chance to get the arming press wrong. Second — the one that matters —
 * every rule here exists to stop a key putting a line on a **live order**, and a
 * rule that lives in a `useState` reducer is a rule no test can reach.
 *
 * 🚩 **Nothing is highlighted until the first press.** [153](.issues/153-console-keyboard-grammar.md)'s
 * ruling 2: the match clause behind the rows is a non-sargable `LIKE '%…%'` over
 * two description columns, so the top row is a relevance **guess**. `↓` then
 * `Enter` is two keys, and the second key is the price of every add being aimed.
 *
 * 🚩 **The highlight belongs to a term, not to a list.** It is carried WITH the
 * term it was set against, so a new question drops it by construction rather
 * than by somebody remembering to reset it — the stale-highlight add is the one
 * failure here that is silent and lands on the caller's basket.
 *
 * 🚩 **One gate, never a second predicate.** `armed` is what the row's own
 * button already reads (`add.onAdd !== null` and no add in flight). While it is
 * false nothing is highlighted at all, so `Enter` reaches no row without this
 * module ever knowing what `canAddItem` means.
 *
 * Nothing here holds a row, an item number or a verb: the caller indexes its own
 * list. That is what lets the palette reuse it unchanged.
 */

/** Where the highlight is, and **which question it answers**. Held together
 *  because apart they are two facts that can disagree. */
export interface HighlightState {
  /** Index into the list as it stood when the key was pressed. `null` is
   *  *nobody has pressed anything yet* — never *row zero*. */
  index: number | null
  /** The term the index was set against. A different one makes it stale. */
  term: string
}

/** The resting state, and what every new question falls back to. */
export const NO_HIGHLIGHT: HighlightState = { index: null, term: '' }

/** The list a press is measured against — a count, the question it answers, and
 *  the one gate. Never the rows themselves: the caller owns those. */
export interface HighlightList {
  count: number
  term: string
  /** 🚩 The SAME condition the row's *Add* is drawn on. False = the door is shut
   *  (no `onAdd`) or an add is already in flight. */
  armed: boolean
}

export type HighlightMove = 'down' | 'up'

/** The two keys, and nothing else. A single letter is dead on this console
 *  (153): the resting focus is a text box twice over. */
export function highlightMoveOf(key: string): HighlightMove | null {
  if (key === 'ArrowDown') return 'down'
  if (key === 'ArrowUp') return 'up'
  return null
}

/**
 * Which row is highlighted **right now** — the only reading anything renders or
 * acts on.
 *
 * Every way the highlight can go wrong is answered here rather than by the
 * caller: a shut door, a stale term, an emptied list, and an index pointing past
 * the end of a list that came back shorter. The clamp is deliberate — a shorter
 * answer to the same question moves the highlight to the last row rather than
 * dropping it, so the agent's aim survives the catalogue moving under a long
 * call.
 */
export function highlightedIndex(state: HighlightState, list: HighlightList): number | null {
  if (!list.armed) return null
  if (state.index === null) return null
  if (state.term !== list.term) return null
  if (list.count <= 0) return null
  return Math.min(state.index, list.count - 1)
}

/**
 * One arrow press.
 *
 * `↓` from nothing is the first row; `↑` from nothing is **still nothing** —
 * wrapping to the last row would arm `Enter` on the least relevant guess in the
 * list. `↓` at the end stays, and `↑` off the first row hands the highlight back
 * to nothing: the way out is the key that came in.
 */
export function moveHighlight(state: HighlightState, list: HighlightList, move: HighlightMove): HighlightState {
  // Inert, whole: a press against a shut door leaves no highlight lying in wait
  // for the moment the door opens.
  if (!list.armed) return state
  if (list.count <= 0) return { index: null, term: list.term }

  const current = highlightedIndex(state, list)
  if (move === 'down') {
    const next = current === null ? 0 : Math.min(current + 1, list.count - 1)
    return { index: next, term: list.term }
  }
  const next = current === null || current === 0 ? null : current - 1
  return { index: next, term: list.term }
}

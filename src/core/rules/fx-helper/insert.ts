// The guided ƒx helper's insertion (ticket 507; moved to core by oms 657, so the promotion rule's
// formula box and the insurance guard's share it). A field, a function, a recipe or an operator
// goes in where the cursor was. An insert only looks at the characters either side of the cursor,
// so two names never run together and an operator is not given a second space.

/** Where the cursor is in the formula box: a caret (`start === end`) or a selection. */
export interface Selection {
  start: number
  end: number
}

/**
 * What one click puts in, and where the cursor goes inside it (absent = after it). With `select`,
 * that many characters from the caret are selected, so typing replaces them: a placeholder such as
 * `<code>` in `eligibility.benefit[<code>].copayPct`.
 */
export interface Chip {
  text: string
  caret?: number
  select?: number
}

/** Where an insert leaves the formula: its text and the caret, or a selection when the chip selects a placeholder. */
export interface Inserted {
  formula: string
  caret: number
  /** The end of the selection from `caret`, for a chip with `select`. */
  end?: number
}

const WORD_END = /[A-Za-z0-9_)'\]]$/
const WORD_START = /^[A-Za-z0-9_('"]/
const NAME_END = /[A-Za-z0-9_)\]]$/
const NAME_START = /^[A-Za-z0-9_(]/

/**
 * Puts `chip` at the cursor — over a selection, in place of it; with no cursor yet, at the end —
 * and answers the new formula and where the caret goes. A space goes between the chip and a name
 * either side of it; an operator's own spaces are dropped where a space is already there.
 */
export function insertAtCursor(formula: string, at: Selection | null, chip: Chip): Inserted {
  const len = formula.length
  const start = Math.min(Math.max(at?.start ?? len, 0), len)
  const end = Math.min(Math.max(at?.end ?? start, start), len)
  const before = formula.slice(0, start)
  const after = formula.slice(end)
  let text = chip.text
  let caret = chip.caret ?? text.length
  let pastSpace = 0

  if (text.startsWith(' ') && (before === '' || /\s$/.test(before))) {
    text = text.slice(1)
    caret = Math.max(caret - 1, 0)
  }
  if (text.endsWith(' ') && /^\s/.test(after)) {
    const atEnd = caret === text.length
    text = text.slice(0, -1)
    caret = Math.min(caret, text.length)
    // The caret goes past the space that was already there, where the chip's own would have put it.
    if (atEnd) pastSpace = 1
  }
  const padBefore = WORD_END.test(before) && WORD_START.test(text) ? ' ' : ''
  const padAfter = NAME_END.test(text) && NAME_START.test(after) ? ' ' : ''
  const at0 = start + padBefore.length + caret + pastSpace
  const out: Inserted = { formula: before + padBefore + text + padAfter + after, caret: at0 }
  if (chip.select) out.end = Math.min(at0 + chip.select, start + padBefore.length + text.length)
  return out
}

/** An operator chip: a bracket pair with the caret inside, a closing bracket as it is, else the operator between spaces. */
export function operatorChip(op: string): Chip {
  if (op === '(') return { text: '()', caret: 1 }
  if (op === ')') return { text: ')' }
  return { text: ` ${op} ` }
}

/** The text chip: a pair of single quotes with the caret between them. */
export const TEXT_CHIP: Chip = { text: "''", caret: 1 }

import { useEffect, useRef, type ChangeEvent } from 'react'
import { insertAtCursor, type Chip, type Selection } from './insert'

/**
 * A formula input's cursor, kept while the ƒx helper takes the focus (ticket 507; core since oms 657).
 * `remember` goes on the input's select / keyup / click / blur and on the ƒx button's mousedown;
 * `track` on its change. `insert` puts a chip where the cursor was (or over the whole text, for a
 * recipe) through `write`, then puts the caret — or the chip's placeholder selection — back.
 */
export function useCaretInsert(text: string, write: (next: string) => void) {
  const input = useRef<HTMLInputElement>(null)
  const selection = useRef<Selection | null>(null)
  const caretAfter = useRef<Selection | null>(null)

  useEffect(() => {
    const el = input.current
    const at = caretAfter.current
    if (!el || at === null) return
    caretAfter.current = null
    el.focus()
    el.setSelectionRange(at.start, at.end)
    selection.current = at
  }, [text])

  const remember = () => {
    const el = input.current
    if (el && el.selectionStart !== null && el.selectionEnd !== null) selection.current = { start: el.selectionStart, end: el.selectionEnd }
  }

  const track = (e: ChangeEvent<HTMLInputElement>) => {
    selection.current = { start: e.target.selectionStart ?? e.target.value.length, end: e.target.selectionEnd ?? e.target.value.length }
  }

  const insert = (chip: Chip, replaceAll = false) => {
    const at = replaceAll ? { start: 0, end: text.length } : selection.current
    const next = insertAtCursor(text, at, chip)
    const to = { start: next.caret, end: next.end ?? next.caret }
    if (next.formula === text) {
      input.current?.focus()
      input.current?.setSelectionRange(to.start, to.end)
      return
    }
    caretAfter.current = to
    write(next.formula)
  }

  return { input, remember, track, insert }
}

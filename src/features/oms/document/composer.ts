/**
 * The note composer at the spine's Now line (spec 380 D8, D10; ticket 405; ruling 371 "Notes").
 *
 * Add note posts from here, which amends 083 D-11 **for Add note only**: Cancel order, Force
 * cancel and Request cancellation still take their notes inside their own dialogs, so the
 * composer's text is only ever the note Add note posts.
 *
 * Pure, so the two rules that hang off what the box holds are plain data:
 *
 * - **An empty composer cannot post** (D-11's rule, kept). Whitespace is not a note: the body
 *   is trimmed (`buildUpdateHeader`), and an empty line in an append-only log is meaningless.
 * - **Esc back to the list is refused while the composer holds unsent text** (D10), with a
 *   toast. A note that is still posting is not sent until the server says so.
 */

/** What the composer holds: nothing, a note not yet sent, or a note on its way. */
export type ComposerState = 'empty' | 'unsent' | 'posting'

export function composerState(text: string, posting: boolean): ComposerState {
  if (posting) return 'posting'
  return text.trim().length > 0 ? 'unsent' : 'empty'
}

export function canPost(state: ComposerState): boolean {
  return state === 'unsent'
}

/** Why Esc may not leave the page (an i18n key, toasted by the key layer), or `null` when it may. */
export function backRefusal(state: ComposerState): string | null {
  return state === 'empty' ? null : 'document:composer.unsentRefusal'
}

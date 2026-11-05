// How a screen sits in the shell's content area (spec 380 C1, ticket 407). Every screen
// scrolls with the page under the padded content area, except one that lays itself out to
// the content height with its own scrolling columns: the call center console. It says so
// through an explicit route flag, beside the palette's (`PaletteRouteHandle`).

export interface ShellRouteHandle {
  /**
   * The screen fills the content area below the top bar: no padding, no page scroll, and
   * the screen's own columns scroll inside it.
   */
  fill?: boolean
  /**
   * The query param that, set to `1`, hides the shell on this route: no rail, no top bar, the screen
   * alone (a board's TV mode, `?tv=1`, ticket 780). The screen keeps its own way out (Esc).
   */
  chromeless?: string
}

/** True when any matched route fills the content area. Reads `handle`s of any shape, defensively. */
export function fillsContent(handles: readonly unknown[]): boolean {
  return handles.some(
    (handle) => typeof handle === 'object' && handle !== null && (handle as ShellRouteHandle).fill === true,
  )
}

/** True when a matched route names a `chromeless` param and the URL's `search` sets it to `1`. */
export function hidesShell(handles: readonly unknown[], search: string): boolean {
  const params = new URLSearchParams(search)
  return handles.some((handle) => {
    const param = typeof handle === 'object' && handle !== null ? (handle as ShellRouteHandle).chromeless : undefined
    return typeof param === 'string' && param !== '' && params.get(param) === '1'
  })
}

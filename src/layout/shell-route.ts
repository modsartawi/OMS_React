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
}

/** True when any matched route fills the content area. Reads `handle`s of any shape, defensively. */
export function fillsContent(handles: readonly unknown[]): boolean {
  return handles.some(
    (handle) => typeof handle === 'object' && handle !== null && (handle as ShellRouteHandle).fill === true,
  )
}

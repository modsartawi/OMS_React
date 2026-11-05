// The views rail's shared row recipe: born in the Deliveries rail (ticket 400) and graduated here
// with the saved views' rail section (spec 3389 code review), so both lists' rails and `MyViews`
// draw one recipe.

/** The rail's section heading: small caps in secondary ink (Lenses, My views). */
export const RAIL_HEADING =
  'px-2 pb-1.5 pt-1 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted-foreground'

/** A rail row's focus ring, drawn inside the row so the rail's edge never clips it. */
export const RAIL_FOCUS = 'focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring'

/** A rail row's tone: the active row takes the grid's selected-row ground, the rest go quiet. */
export const railRowTone = (active: boolean) =>
  active ? 'bg-primary-050 font-semibold text-foreground' : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'

/**
 * The active row's 3px `--cursor` bar on its inline-start edge — the pair `railRowTone` grounds.
 * `edge` places it: `start-0` in a borderless row, `-start-px` in a bordered one (a lens Chip),
 * so the bar sits on the row's outer edge either way.
 */
export function CursorBar({ edge = 'start-0' }: { edge?: 'start-0' | '-start-px' }) {
  return <span className={'absolute inset-y-1 w-[3px] rounded-full bg-cursor ' + edge} aria-hidden />
}

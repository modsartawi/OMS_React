/**
 * The two button shapes the Profile tab's commands wear.
 *
 * They live in their own module rather than in `ProfileTab` because the Status
 * **member command** moved out into `StatusCommand` (ticket 303) and the two
 * files draw buttons that sit inches apart: one copy of the class string in each
 * would look identical today and drift the first time the pill style changes.
 *
 * They are deliberately not `core/ui/Button`'s variants — that component is the
 * `h-7`/`text-xs` command tier the grids and dialog footers use, and this tab's
 * controls are the taller form the field list is laid out against.
 */
export const PRIMARY_BUTTON =
  'inline-flex h-8 items-center rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50'

export const QUIET_BUTTON =
  'inline-flex h-8 items-center rounded-full border border-border/60 bg-background px-3 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50'

/**
 * A dialog text input, and the ONE place that says what an invalid one looks
 * like.
 *
 * 🚩 The invalid border **replaces** the ordinary one rather than joining it. Two
 * `border-*` classes on one element do not stack — which of them wins is a
 * question about the order the rules landed in the stylesheet, not about the
 * order they are written here — so appending the danger colour is how a field
 * that is meant to be red renders grey. That is not a style nit on a removal
 * confirmation: the red border is the tell that the analyst has typed something
 * the command will not accept.
 */
export const removalFieldClass = (invalid: boolean): string =>
  'h-8 w-full rounded-md border bg-background px-2 text-sm text-foreground focus:outline-none disabled:opacity-50 ' +
  (invalid
    ? 'border-danger-border focus:border-danger-border'
    : 'border-border/60 focus:border-primary/50')

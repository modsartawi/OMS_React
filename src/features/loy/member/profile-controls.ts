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

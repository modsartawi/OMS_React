/** A pill switch's button classes, shared by the period tabs (484) and the table's track switch (491). */
export const PILL = 'h-7 rounded-full px-3 text-sm font-medium transition-colors'
export const PILL_ON = 'bg-primary text-primary-foreground'
export const PILL_OFF = 'text-muted-foreground hover:bg-muted hover:text-foreground'
/** The rounded track a pill switch's buttons sit in. */
export const PILL_GROUP = 'inline-flex h-9 items-center gap-1 rounded-full border border-border/60 bg-background p-1'

/** The control bar's field and input classes, shared by the period bar and the scope (484, 485). */
export const FIELD = 'flex flex-col gap-1 text-xs font-medium text-muted-foreground'
export const INPUT =
  'h-9 rounded-md border border-border/60 bg-background px-2.5 text-sm text-foreground focus:border-primary/50 focus:outline-none'

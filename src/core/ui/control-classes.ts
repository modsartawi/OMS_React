/**
 * The shared controls' class composition (ticket 594, spec 590 §Shared controls):
 * `Button`, `IconButton` and `Chip` are each styled once, here, from tokens.
 *
 * Kept pure (no React) so the composition is unit-tested; the components in this
 * folder only spread it onto a `<button>`.
 *
 * Shape: every one-line control — these three and the fields of `./field-control` —
 * is a full pill at h-7 (28px, spec 590 "sizes stay compact"). `rounded-full` is
 * spelt out rather than read from `--radius`, so a later radius change cannot
 * un-pill a control; `--radius` shapes cards and panels, not controls.
 *
 * Disabled: `aria-disabled` is styled alongside `disabled` because a command that is
 * disabled *with a reason* must stay focusable to be able to state it — a real
 * `disabled` attribute takes the button out of the tab order, which is exactly how
 * an operator fails to discover why a command is unavailable. The caller still
 * guards its own `onClick` when it uses `aria-disabled`.
 */

/** The one disabled look, shared with the fields (`./field-control`). */
export const DISABLED =
  'disabled:cursor-not-allowed disabled:opacity-50 aria-disabled:cursor-not-allowed aria-disabled:opacity-50'

const PILL = 'h-7 rounded-full px-3'

// ---------------------------------------------------------------------------
// Button
// ---------------------------------------------------------------------------

/**
 * The action-button variants the app needs.
 *
 * The first five map from the Angular prototype's PrimeNG severities: primary
 * (the default action), secondary (the ordinary actions), danger (the terminal
 * cancel), outlined (Refresh) and text (Cancel in the dialog footers).
 *
 * The next four are ticket 072's command-family taxonomy, which colours a
 * command button by the FUNCTION it performs rather than by its stakes:
 * `fulfilment` and `cancel-request` are the two families, and `ghost` is the
 * quiet tier that carries no family colour at all. `danger-outlined` is the
 * terminal tier's override — red, but separated from the sanctioned cancel by
 * WEIGHT rather than by a second, louder red.
 *
 * `link` (594) is the look of a text-style action that NAVIGATES: underlined, in
 * primary ink, like every other link since 585. A text-style action that does not
 * navigate (Cancel, Clear, Show all) stays `text` or is restyled in place.
 */
export const BUTTON_VARIANTS = [
  'primary',
  'secondary',
  'danger',
  'danger-outlined',
  'outlined',
  'text',
  'fulfilment',
  'cancel-request',
  'ghost',
  'link',
] as const

export type ButtonVariant = (typeof BUTTON_VARIANTS)[number]

const BUTTON_BASE = 'inline-flex items-center gap-1.5 text-xs font-medium transition-colors ' + DISABLED

/**
 * Every filled chromatic ground carries `--primary-foreground`, never white:
 * under 082's R2 each dark chromatic fill is a LIGHT tonal fill, and
 * `--primary-foreground` is the token that flips with it. Ground and ink are a
 * pair and must move together.
 */
const BUTTON_VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary:
    'bg-primary text-primary-foreground hover:bg-primary/85 ' +
    'disabled:hover:bg-primary aria-disabled:hover:bg-primary',
  secondary:
    'border border-border bg-card hover:bg-accent ' +
    'disabled:hover:bg-card aria-disabled:hover:bg-card',
  danger:
    'bg-danger text-primary-foreground hover:bg-danger-800 ' +
    'disabled:hover:bg-danger aria-disabled:hover:bg-danger',
  'danger-outlined':
    'border border-danger-border bg-transparent text-danger-800 hover:bg-danger-050 ' +
    'disabled:hover:bg-transparent aria-disabled:hover:bg-transparent',
  outlined:
    'border border-border bg-transparent hover:bg-accent ' +
    'disabled:hover:bg-transparent aria-disabled:hover:bg-transparent',
  text:
    'bg-transparent text-muted-foreground hover:bg-accent ' +
    'disabled:hover:bg-transparent aria-disabled:hover:bg-transparent',
  fulfilment:
    'bg-fam-fulfilment text-primary-foreground hover:bg-fam-fulfilment/85 ' +
    'disabled:hover:bg-fam-fulfilment aria-disabled:hover:bg-fam-fulfilment',
  'cancel-request':
    'bg-fam-cancel-request text-primary-foreground hover:bg-fam-cancel-request/85 ' +
    'disabled:hover:bg-fam-cancel-request aria-disabled:hover:bg-fam-cancel-request',
  ghost:
    'border border-border-strong bg-transparent text-muted-foreground hover:bg-accent ' +
    'disabled:hover:bg-transparent aria-disabled:hover:bg-transparent',
  // Same h-7 as its neighbours so a toolbar's baseline holds; a hairline of inline
  // padding keeps the focus ring off the glyphs. Hover thickens the underline
  // rather than adding a ground, which would read as a button.
  link:
    'h-7 rounded-sm px-0.5 bg-transparent text-primary underline underline-offset-2 hover:decoration-2 ' +
    'disabled:hover:decoration-1 aria-disabled:hover:decoration-1',
}

/** The full class string of a `Button` of `variant`, the caller's `className` last. */
export function buttonClass(variant: ButtonVariant, className = ''): string {
  const shape = variant === 'link' ? '' : PILL + ' '
  return `${BUTTON_BASE} ${shape}${BUTTON_VARIANT_CLASS[variant]}${className ? ' ' + className : ''}`
}

// ---------------------------------------------------------------------------
// IconButton
// ---------------------------------------------------------------------------

/**
 * `ghost` — the ordinary icon action (close, more, pin): muted ink, accent on hover.
 * `outlined` — an icon action that sits in a row of outlined Buttons.
 * `danger` — remove / delete: danger ink and ground on hover only.
 */
export type IconButtonVariant = 'ghost' | 'outlined' | 'danger'

/** `default` is h-7 like every control; `compact` (h-5) sits inside a chip or field. */
export type IconButtonSize = 'default' | 'compact'

const ICON_BUTTON_BASE =
  'inline-grid shrink-0 place-items-center rounded-full transition-colors ' +
  // A pressed icon toggle (pin) lights its glyph in primary ink.
  'aria-pressed:text-primary ' +
  DISABLED

const ICON_BUTTON_SIZE: Record<IconButtonSize, string> = {
  default: 'h-7 w-7',
  compact: 'h-5 w-5',
}

const ICON_BUTTON_VARIANT_CLASS: Record<IconButtonVariant, string> = {
  ghost:
    'text-muted-foreground hover:bg-accent hover:text-foreground ' +
    'disabled:hover:bg-transparent aria-disabled:hover:bg-transparent',
  outlined:
    'border border-border text-foreground hover:bg-accent ' +
    'disabled:hover:bg-transparent aria-disabled:hover:bg-transparent',
  danger:
    'text-muted-foreground hover:bg-danger-050 hover:text-danger-800 ' +
    'disabled:hover:bg-transparent aria-disabled:hover:bg-transparent',
}

export function iconButtonClass(
  variant: IconButtonVariant = 'ghost',
  size: IconButtonSize = 'default',
  className = '',
): string {
  return `${ICON_BUTTON_BASE} ${ICON_BUTTON_SIZE[size]} ${ICON_BUTTON_VARIANT_CLASS[variant]}${className ? ' ' + className : ''}`
}

// ---------------------------------------------------------------------------
// Chip
// ---------------------------------------------------------------------------

/** `toggle` — an on/off filter or switch (`aria-pressed`); `tab` — one tab of a tab bar (`role="tab"`). */
export type ChipVariant = 'toggle' | 'tab'

/** The state attributes a chip exposes — its look is keyed off these, so the two cannot disagree. */
export function chipState(
  variant: ChipVariant,
  on: boolean,
): { 'aria-pressed': boolean } | { role: 'tab'; 'aria-selected': boolean } {
  return variant === 'tab' ? { role: 'tab', 'aria-selected': on } : { 'aria-pressed': on }
}

const CHIP_BASE =
  'inline-flex h-7 items-center gap-1.5 rounded-full border border-border bg-card px-2.5 ' +
  'text-xs font-medium text-foreground transition-colors hover:bg-accent ' +
  DISABLED +
  ' disabled:hover:bg-card aria-disabled:hover:bg-card'

// "On": the primary-050 ground, primary-800 ink and the primary border. The
// `:hover` twin keeps the ground when the pointer still rests on the chip just clicked.
const CHIP_ON: Record<ChipVariant, string> = {
  toggle:
    'aria-pressed:border-primary aria-pressed:bg-primary-050 aria-pressed:text-primary-800 ' +
    'aria-pressed:hover:bg-primary-050',
  tab:
    'aria-selected:border-primary aria-selected:bg-primary-050 aria-selected:text-primary-800 ' +
    'aria-selected:hover:bg-primary-050',
}

export function chipClass(variant: ChipVariant = 'toggle', className = ''): string {
  return `${CHIP_BASE} ${CHIP_ON[variant]}${className ? ' ' + className : ''}`
}

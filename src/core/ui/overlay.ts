/**
 * The overlay recipe (spec 380 F15, ticket 388; 377 §1): every overlay is styled by
 * where it OPENS FROM.
 *
 * - **From the rail → navy** ({@link RAIL_POPOVER}): the group flyout, the user menu at
 *   the rail foot, and the narrow rail's overlaid tree and drawer. It continues the rail:
 *   `--rail` ground and ink, `--rail-muted` secondary text, `--rail-accent` hover with
 *   white ink, a white 12% edge and dividers ({@link RAIL_EDGE}), and a GOLD focus
 *   ring — the navy ring would vanish on navy.
 * - **Everything else → the card recipe**: the store chip's panel, the bell panel, the
 *   column chooser, the saved-view menus, a command's reason tooltip, every dialog and
 *   the palette. `--card` ground, `--border-strong` edge, `--foreground` ink, 8px for
 *   popovers and menus ({@link POPOVER}), 10px for dialogs ({@link DIALOG}), and square
 *   for a side sheet ({@link SHEET}).
 *
 * Every overlay casts the one `--shadow-pop`, and anything holding the page sits over the
 * one `--backdrop` scrim — `::backdrop` on a native dialog, `bg-backdrop` on a hand-drawn
 * scrim ({@link SCRIM}). Both tokens live in `global.css`. Toasts take the same recipe
 * there, on sonner's own elements.
 *
 * These are class strings, not components: each overlay keeps its own placement, width
 * and behaviour, and composes its surface from here.
 */

/** The one overlay shadow, for a surface that draws its own ground and edge. */
export const OVERLAY_SHADOW = 'shadow-(--shadow-pop)'

/** A popover or menu off the rail: card ground, strong edge, 8px. */
export const POPOVER = `rounded-lg border border-border-strong bg-card text-foreground ${OVERLAY_SHADOW}`

/**
 * A dialog: the card recipe at 10px (the 8px `--radius` + 2), over the `--backdrop` scrim
 * when it is a native `<dialog>`. A hand-drawn dialog sits over a {@link SCRIM} instead.
 */
export const DIALOG = `rounded-[calc(var(--radius)+2px)] border border-border-strong bg-card text-foreground ${OVERLAY_SHADOW} backdrop:bg-backdrop`

/** A side sheet (a native `<dialog>` docked to an edge): the dialog recipe, square. */
export const SHEET = `border-border-strong bg-card text-foreground ${OVERLAY_SHADOW} backdrop:bg-backdrop`

/** A dialog's title: 13px semibold. */
export const DIALOG_TITLE = 'text-[13px] font-semibold tracking-tight'

/** A hand-drawn scrim, for an overlay that is not a native `<dialog>`. */
export const SCRIM = 'bg-backdrop'

/** A menu item's geometry: 28px, 12.5px, a 6px control. Its colours are the menu's. */
const MENU_ITEM = 'flex h-7 w-full items-center gap-2 rounded-md px-2 text-start text-[12.5px]'

/** The rail's white 12% edge and dividers — `--rail-accent-foreground` is white in both themes. */
export const RAIL_EDGE = 'border-rail-accent-foreground/12'

/**
 * A panel that opens from the rail: navy, a white 12% edge, and a gold focus ring. The
 * caller draws the edges it has: `border` floating, `border-e` flush against the rail.
 */
export const RAIL_POPOVER = `${RAIL_EDGE} bg-rail text-rail-foreground ${OVERLAY_SHADOW} [--ring:var(--gold)]`

/** A menu item on a rail panel: `--rail-accent` hover and focus, with white ink. */
export const RAIL_MENU_ITEM = `${MENU_ITEM} hover:bg-rail-accent hover:text-rail-accent-foreground focus:bg-rail-accent focus:text-rail-accent-foreground`

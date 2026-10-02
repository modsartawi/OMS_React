import { useSyncExternalStore } from 'react'

// The rail's three width bands (spec 380 F13, ticket 387; 363 §"Narrow widths").
// Today's 992px breakpoint is gone: these two widths are the only ones the shell reads.

/**
 * - `pinned` (≥1280px): the rail as built in 385 — its toggle is the stored preference,
 *   and the expanded tree takes its own 240px column.
 * - `overlay` (640–1279px): always collapsed. The toggle lays the tree OVER the page
 *   behind a scrim, so the page never reflows, and it closes again on navigation.
 * - `drawer` (<640px): no rail. A hamburger in the top bar opens the tree in a drawer.
 */
export type RailMode = 'pinned' | 'overlay' | 'drawer'

const PINNED_MIN = 1280
const OVERLAY_MIN = 640

/** The band a viewport width falls in — the CSS width a media query reads. */
export function railMode(width: number): RailMode {
  if (width >= PINNED_MIN) return 'pinned'
  if (width >= OVERLAY_MIN) return 'overlay'
  return 'drawer'
}

/**
 * Whether the rail draws its labelled tree.
 *
 * 🚩 Only `pinned` reads the stored preference. A narrow window forces the rail
 * collapsed WITHOUT writing that down, so a user who pinned the tree open on a wide
 * screen still finds it open there; the overlay is a transient of its own.
 */
export function railExpanded(mode: RailMode, preference: boolean, overlayOpen: boolean): boolean {
  if (mode === 'pinned') return preference
  if (mode === 'overlay') return overlayOpen
  return false
}

function subscribe(onChange: () => void) {
  window.addEventListener('resize', onChange)
  return () => window.removeEventListener('resize', onChange)
}

/** The current band, re-read as the window resizes (a re-render only when it changes). */
export function useRailMode(): RailMode {
  return useSyncExternalStore(subscribe, () => railMode(window.innerWidth))
}

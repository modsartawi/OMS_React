import { scrollParentOf } from '@/core/ui/auto-scroll'

/**
 * Focus `el` and bring it into its own column — never the console frame (983 review).
 *
 * 🚩 `el.focus()` and `scrollIntoView` both scroll EVERY scrolling ancestor, including the
 * console's `overflow-hidden` frame, which then sits shifted with the header off-screen and no
 * scrollbar to bring it back (the failure ItemSearchPanel documents). So focus without scrolling,
 * and scroll only the nearest column that genuinely scrolls, by hand.
 */
export function revealAndFocus(el: HTMLElement) {
  el.focus({ preventScroll: true })
  const column = scrollParentOf(el)
  if (column === document.scrollingElement || column === document.documentElement) return
  const box = el.getBoundingClientRect()
  const area = column.getBoundingClientRect()
  if (box.top < area.top) column.scrollTop -= area.top - box.top
  else if (box.bottom > area.bottom) column.scrollTop += Math.min(box.bottom - area.bottom, box.top - area.top)
}

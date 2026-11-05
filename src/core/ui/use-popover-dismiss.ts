import { useEffect, useRef, type RefObject } from 'react'
import { takesEscape } from '@/core/commands/key-layer'

/**
 * Closes a popover on a press outside it, and on an Esc that is its to take — the layers above
 * it (a dialog) keep theirs, and the screen's own Esc never sees one it took.
 *
 * Born in the Deliveries query bar (ticket 399) and graduated here at ticket 786, when the
 * Order / ERX list's query bar became its second reader.
 */
export function usePopoverDismiss(
  open: boolean,
  ref: RefObject<HTMLElement | null>,
  onClose: (by: 'escape' | 'outside') => void,
) {
  const close = useRef(onClose)
  useEffect(() => {
    close.current = onClose
  })
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) close.current('outside')
    }
    const onKey = (e: KeyboardEvent) => {
      if (!takesEscape(e, ref.current)) return
      e.preventDefault()
      close.current('escape')
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, ref])
}

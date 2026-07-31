/**
 * What a chip opens INTO — 175's variant-4 arrangement, second half.
 *
 * Ruling §9 on [175] was *"v3's chip bar at rest, v2's full section when one
 * opens, one command line reaching both"*. The chip bar shipped; the section did
 * not — every chip opened a `<dialog>` instead, and `FulfilmentPicker` recorded
 * that as settled-by-the-build. This component is the ruling's other half,
 * landed: the chip row stays where it is and the section it collapsed **opens
 * underneath it, in the flow**, full width of the centre column.
 *
 * 🚩 **Why it is not a modal.** A modal is the right idiom for an act that must
 * be finished before anything else is true — the store-move preview, the
 * below-availability acceptance, abandoning the order. Those stay dialogs. A
 * header field is the opposite: the agent is reading it out to a caller who is
 * still talking, with the basket and the receipt as the context that makes the
 * answer mean something. A dialog with a backdrop takes exactly that away, and
 * takes it away at the moment the caller is most likely to change their mind.
 *
 * What a `<dialog>` gave for free and this has to do by hand:
 *
 * 1. **Escape closes it.** Handled on the container, so it fires from inside the
 *    text box the agent is typing in.
 * 2. 🚩 **Focus goes in, and comes back out to where it came from.** The chip
 *    that opened the section is the thing the agent's eye is on; focus stranded
 *    at the top of the document after a close is the accessibility failure the
 *    native element existed to prevent. Captured from `document.activeElement`
 *    rather than passed as a prop, so the `/` command palette — which opens
 *    every one of these sections without touching a chip — restores correctly too.
 *
 * What it deliberately does NOT do is trap focus or make the rest inert. The
 * basket behind it is not "behind" it; it is the same screen, and reaching it
 * mid-section is a thing an agent may legitimately want.
 */
import { useEffect, useId, useRef, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { X } from 'lucide-react'

export interface ChipSectionProps {
  open: boolean
  /** Called for every dismissal path: Cancel, Escape, the close control. */
  onClose: () => void
  title: string
  /** The chip this section belongs to — a drive's handle on *which* one is
   *  open, which the title (a sentence, and localised) cannot be. */
  name: string
  /** Body width cap, e.g. `32rem`. The section spans the column; its CONTENT
   *  does not, because a 900px-wide radio list is unreadable (v2's `max-w-3xl`
   *  with a per-surface figure instead of one global one). */
  width?: string
  children: ReactNode
  footer?: ReactNode
}

export default function ChipSection({
  open,
  onClose,
  title,
  name,
  width = '32rem',
  children,
  footer,
}: ChipSectionProps) {
  const { t } = useTranslation('callcenter')
  const headingId = useId()
  const region = useRef<HTMLElement>(null)
  // Where focus was when this opened — the chip, or nothing at all when the
  // palette opened it from a box that has since gone. Restored on close.
  const cameFrom = useRef<HTMLElement | null>(null)
  /**
   * 🚩 The agent took focus somewhere else while this was open — the search box,
   * another chip — so the close must NOT drag them back. Tracked as it happens
   * rather than read at close time: by then this section has already left the
   * DOM and `document.activeElement` is the body, which is indistinguishable
   * from *focus was inside and is now nowhere*, and a console that guessed
   * wrong either strands focus at the top of the document or steals it from the
   * box the agent is typing into.
   */
  const movedAway = useRef(false)

  useEffect(() => {
    if (!open) return
    movedAway.current = false
    cameFrom.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    // The region itself, not its first control: the section's own name is what
    // a screen reader should read out before the field, and a caret dropped
    // into a text box the agent did not ask for steals the keys they are still
    // typing the caller's words with.
    region.current?.focus()
    return () => {
      if (!movedAway.current) cameFrom.current?.focus()
    }
  }, [open])

  if (!open) return null

  return (
    <section
      ref={region}
      tabIndex={-1}
      aria-labelledby={headingId}
      data-cc-section={name}
      // Focus LEFT this section for something else on the screen (`relatedTarget`
      // names it). A section that simply closed under the caret reports none,
      // which is the case the close is allowed to answer.
      onBlur={(event) => {
        const to = event.relatedTarget
        if (to instanceof HTMLElement && !event.currentTarget.contains(to)) movedAway.current = true
      }}
      onFocus={() => {
        movedAway.current = false
      }}
      onKeyDown={(event) => {
        if (event.key !== 'Escape') return
        // Never past the section: Escape inside an open section is about the
        // section, and the palette's own Escape must not fire behind it.
        event.stopPropagation()
        onClose()
      }}
      className="shrink-0 border-b border-divider bg-card px-4 py-3 outline-none"
    >
      <div className="mb-2.5 flex items-baseline justify-between gap-3">
        <h2 id={headingId} className="text-sm font-semibold tracking-tight">
          {title}
        </h2>
        <button
          type="button"
          onClick={onClose}
          data-cc-section-close
          aria-label={t('section.close')}
          title={t('section.close')}
          className="flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" aria-hidden />
          {t('section.closeHint')}
        </button>
      </div>
      {/* Capped so the basket underneath never leaves the screen — the whole
          reason this is a section and not a dialog. */}
      <div className="max-h-[52vh] overflow-y-auto" style={{ maxWidth: width }}>
        {children}
      </div>
      {footer && (
        <div className="mt-3 flex flex-wrap justify-end gap-2" style={{ maxWidth: width }}>
          {footer}
        </div>
      )}
    </section>
  )
}

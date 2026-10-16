import type { ReactNode, Ref } from 'react'
import { HEADING } from './facts-heading'

/**
 * A folded section of the column: a native `<details>`, whose marker points to the
 * inline end and mirrors under RTL on its own. `open` is passed only when the page
 * must open it (Attachments' Show); otherwise the browser holds it.
 */
export default function Disclosure({
  id,
  summary,
  summaryRef,
  open,
  onToggle,
  children,
}: {
  id: string
  summary: ReactNode
  summaryRef?: Ref<HTMLElement>
  open?: boolean
  onToggle: (open: boolean) => void
  children: ReactNode
}) {
  return (
    <details
      id={id}
      open={open}
      onToggle={(event) => onToggle(event.currentTarget.open)}
      className="min-w-0 rounded-lg border border-border bg-card p-3"
    >
      <summary ref={summaryRef} className={`cursor-pointer select-none ${HEADING} text-muted-foreground`}>
        {summary}
      </summary>
      <div data-disclosure-body="" className="mt-2">
        {children}
      </div>
    </details>
  )
}

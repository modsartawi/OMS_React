import type { ReactNode } from 'react'
import './print-sheet.css'

/**
 * One printed A4 side with a document centred on it — the geometry both
 * collection documents land on, and neither one's design.
 *
 * Extracted at ticket 252, which was told to reuse 251's sheet primitives rather
 * than invent a second answer for the same sheet. `docClassName` is where a
 * document adds what genuinely differs from the other: its type size and its
 * inner padding. Everything the two share — 210×297mm, the 780px document at the
 * WPF's 0.956 shrink-to-fit, Tahoma, RTL, and the page break that goes BEFORE
 * each later sheet — lives in `print-sheet.css`.
 */
export default function PrintSheet({
  docClassName,
  children,
}: {
  docClassName: string
  children: ReactNode
}) {
  return (
    <div className="print-sheet">
      <div className={`print-doc ${docClassName}`}>{children}</div>
    </div>
  )
}

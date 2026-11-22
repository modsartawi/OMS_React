import type { ReactNode } from 'react'
import type { CcLine, CcTarget } from '@/core/models/command-center'
import Ltr from '@/core/ui/Ltr'
import { TONE_DOT } from './finding-card'
import Sentence from './Sentence'

/**
 * One stored finding, drawn the same way wherever it shows (oms 946, BackOffice spec 4165 "The brief and the copilot's
 * opening screen show the same stored finding through one shared card"): its colour as a dot, its fixed sentence and its
 * SAR figure, each as the server sent them.
 *
 * In `@/core/` because two features draw it — the command center's brief (946) and the copilot panel (950) — and a
 * feature may not import another. The card owns no words: the sentence and the figure are data, and an action (950's
 * "Ask") is handed in by the caller with its own label.
 */
export default function FindingCard({
  line,
  hrefOf,
  action,
}: {
  line: CcLine
  /** Where a pharmacy code or a category name in the sentence goes (`targetHref` in `@/core/command-center-routes`). */
  hrefOf: (target: CcTarget) => string
  /** The caller's action beside the figure (950: "Ask"). */
  action?: ReactNode
}) {
  return (
    <article className="flex items-start gap-2 text-sm" data-finding={line.findingId}>
      {line.tone && <span aria-hidden className={`mt-1.5 size-2 shrink-0 rounded-full ${TONE_DOT[line.tone]}`} data-tone={line.tone} />}
      <p className="min-w-0 flex-1 leading-snug">
        <Sentence parts={line.parts} hrefOf={hrefOf} />
      </p>
      <span className="shrink-0 font-semibold tabular-nums" data-finding-money>
        <Ltr>{line.money}</Ltr>
      </span>
      {action}
    </article>
  )
}

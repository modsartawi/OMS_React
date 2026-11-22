import { Sparkles } from 'lucide-react'
import { useCopilotPanel, type CopilotFinding } from '@/core/copilot-panel'
import type { CcAsk, CcLang, CcLine } from '@/core/models/command-center'
import Button from '@/core/ui/Button'

/**
 * What a tap on "Ask" hands the copilot, or null when there is no button (oms 950, BackOffice spec 4165): the server sends
 * `ask` only while `Copilot:Findings` is on (decisions §4), and the reader must hold the copilot (`available`, published by
 * the shell from `Copilot:01`). A brief line also hands over itself and its language, so the copilot draws the same card.
 */
export function askOffer(ask: CcAsk | undefined, available: boolean, card: { line?: CcLine; lang?: CcLang } = {}): CopilotFinding | null {
  if (!ask || !available) return null
  return {
    question: ask.question,
    findingId: ask.findingId,
    ...(card.line ? { line: card.line } : {}),
    ...(card.lang ? { lang: card.lang } : {}),
  }
}

/** The button itself, given what it hands over; nothing when there is nothing to ask. */
export function AskButtonView({
  finding,
  label,
  hint,
  onAsk,
}: {
  finding: CopilotFinding | null
  label: string
  hint?: string
  onAsk: (finding: CopilotFinding) => void
}) {
  if (finding === null) return null
  return (
    <Button variant="ghost" className="shrink-0" title={hint} onClick={() => onAsk(finding)} data-copilot-ask={finding.findingId}>
      <Sparkles className="h-3.5 w-3.5" aria-hidden />
      {label}
    </Button>
  )
}

/**
 * "Ask" (oms 950, BackOffice spec 4165): opens the copilot in the side panel with the question the server wrote and the
 * finding's id as context (`@/core/copilot-panel` `askAbout`); the reader can type a further question there. One button
 * for every caller — a brief line (with its `line`, drawn again at the top of the copilot) and a pharmacy's scorecard
 * panel (its `ask`, no line). Absent when the server did not offer the findings tool.
 *
 * In core because the command center's brief and its scorecard panel both carry it and the copilot is another feature.
 * It owns no words: the caller passes its label (and hint) in the page's language.
 */
export default function AskButton({
  ask,
  line,
  lang,
  label,
  hint,
}: {
  ask: CcAsk | undefined
  line?: CcLine
  lang?: CcLang
  label: string
  hint?: string
}) {
  const available = useCopilotPanel((s) => s.available)
  return <AskButtonView finding={askOffer(ask, available, { line, lang })} label={label} hint={hint} onAsk={(f) => useCopilotPanel.getState().askAbout(f)} />
}

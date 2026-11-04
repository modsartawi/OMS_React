import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Sparkles } from 'lucide-react'
import Button from '@/core/ui/Button'
import Input from '@/core/ui/Input'
import { useCopilotPanel } from '@/core/copilot-panel'

/**
 * The ask box on `/analytics` (ticket 782, spec 766 §F) — hands the question to the app shell's ONE
 * copilot panel through `@/core/copilot-panel`, which opens the panel and lets it send the question
 * through its own conversation. There is never a second Ask client, and this feature never imports
 * the copilot feature.
 *
 * Gated by the copilot probe: the shell's button publishes `canAsk` as `available`, and without it
 * (denied, absent, still asking) the box draws nothing.
 *
 * Self-contained so the board page (ticket 771) mounts it as it is.
 */
export default function AskBox() {
  const { t } = useTranslation('boards')
  const available = useCopilotPanel((s) => s.available)
  const openPanel = useCopilotPanel((s) => s.openPanel)
  const [question, setQuestion] = useState('')
  if (!available) return null

  const send = (e: FormEvent) => {
    e.preventDefault()
    if (question.trim() === '') return
    openPanel(question)
    setQuestion('')
  }

  return (
    <form onSubmit={send} className="flex items-center gap-2" role="search" aria-label={t('ask.label')} data-analytics-ask>
      <Input
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        placeholder={t('ask.placeholder')}
        aria-label={t('ask.label')}
        wrapperClassName="flex-1"
        className="flex-1"
        data-analytics-ask-question
      />
      <Button type="submit" disabled={question.trim() === ''} data-analytics-ask-send>
        <Sparkles className="h-3.5 w-3.5 shrink-0" aria-hidden />
        {t('ask.send')}
      </Button>
    </form>
  )
}

import { useNavigate } from 'react-router'
import { FlaskConical } from 'lucide-react'

import Button from '@/core/ui/Button'
import { experimentFromRule, type RuleSource } from './experiment'
import { localAsOf } from './playground'
import { handoffState, PLAYGROUND_COPY_PATH, stashHandoff, type PlaygroundHandoff } from './playground-handoff'

/**
 * "Open in playground" (oms 688) on the guard rule page and the Categories / Coverage rule editor: copies the rule,
 * the lists it names and the fields it reads into a NEW experiment of its kind (example data, "as of" now) and opens
 * the playground on it. A copy: the playground never writes back. The words are the screen's own (its namespace).
 * `source` null = nothing to copy yet (the button is off and `title` says why).
 */
export default function OpenInPlayground({ source, label, title }: { source: RuleSource | null; label: string; title: string }) {
  const navigate = useNavigate()
  const open = () => {
    if (!source) return
    const experiment = experimentFromRule(source, localAsOf(new Date()))
    const rule = source.rule as { id?: unknown } | null
    const h: PlaygroundHandoff = { experiment, from: { kind: source.kind, ruleId: typeof rule?.id === 'string' ? rule.id : '' } }
    stashHandoff(h, Date.now())
    void navigate(PLAYGROUND_COPY_PATH, { state: handoffState(h) })
  }
  return (
    <Button variant="secondary" onClick={open} disabled={!source} title={title} data-open-playground={source ? source.kind : 'off'}>
      <FlaskConical className="h-3.5 w-3.5" aria-hidden />
      {label}
    </Button>
  )
}

import { Trans, useTranslation } from 'react-i18next'
import { CircleX, TriangleAlert, type LucideIcon } from 'lucide-react'
import type { RuleIssue } from '@/core/models/rule-campaign'
import type { CheckSeverity } from './checks'
import { severityOf } from './checks'

/** How a severity looks wherever a check shows: its icon, ink and border. */
export const SEVERITY_LOOK: Record<CheckSeverity, { Icon: LucideIcon; ink: string; border: string }> = {
  error: { Icon: CircleX, ink: 'text-danger-800', border: 'border-danger-border' },
  warning: { Icon: TriangleAlert, ink: 'text-attention-800', border: 'border-attention-border' },
}

/**
 * HQ's messages where they point (ticket 508) — at a field of a block's panel, under a block, a
 * filter, a value or a rule — in the order given (`./checks` puts errors first). HQ's text is data,
 * isolated as free text in the sentence's slot; the words around it are ours.
 */
export default function CheckNotes({ messages, data }: { messages: RuleIssue[]; data: string }) {
  const { t } = useTranslation('campaign-workspace')
  if (!messages.length) return null
  return (
    <ul className="flex basis-full flex-col gap-0.5" data-check-notes={data}>
      {messages.map((m, i) => {
        const severity = severityOf(m)
        const { Icon, ink } = SEVERITY_LOOK[severity]
        return (
          <li key={i} className={`flex items-start gap-1.5 text-xs ${ink}`} data-check-note={severity} data-check-path={m.path}>
            <Icon className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden />
            <span>
              <Trans
                t={t}
                i18nKey={`checks.note.${severity}`}
                values={{ message: m.message }}
                components={{ b: <span className="font-semibold" />, msg: <bdi data-check-message="" /> }}
              />
            </span>
          </li>
        )
      })}
    </ul>
  )
}

/** The tone a block or row takes from its messages: an error outranks a warning. */
export function checkTone(messages: RuleIssue[]): CheckSeverity | null {
  if (messages.some((m) => severityOf(m) === 'error')) return 'error'
  return messages.length ? 'warning' : null
}

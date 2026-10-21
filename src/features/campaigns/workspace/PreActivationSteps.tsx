import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { CheckCircle2, Circle } from 'lucide-react'
import type { PreActivationStep } from './approval'
import { pageLanded } from './menu'
import { useWorkspace } from './context'

/**
 * The dashboard's "Consider these steps before activating" (ticket 511, the prototype's step grid):
 * each step ticks when the draft has it, or links to the page that fixes it — once that page has
 * landed (Settings arrives with 509; until then its steps say what to do, unlinked). Only the rules
 * step blocks approval, through HQ's checks; the others are advice.
 */
export default function PreActivationSteps({ steps, base }: { steps: PreActivationStep[]; base: string }) {
  const { t } = useTranslation('campaign-workspace')
  const { link } = useWorkspace()
  return (
    <section className="flex flex-col gap-2 rounded-lg border border-border/60 bg-card p-4" data-steps="">
      <h2 className="text-sm font-semibold">{t('approval.steps.title')}</h2>
      <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {steps.map((step) => {
          const body = (
            <>
              <b className="text-sm font-medium">{t(`approval.steps.${step.key}.title`)}</b>
              <span className="text-xs text-muted-foreground">{t(`approval.steps.${step.key}.${step.done ? 'done' : 'todo'}`)}</span>
            </>
          )
          return (
            <li key={step.key} className="flex items-start gap-2 rounded-md border border-border/60 p-2.5" data-step={step.key} data-step-done={step.done ? '' : undefined}>
              {step.done ? (
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success-800" aria-label={t('approval.steps.doneLabel')} />
              ) : (
                <Circle className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-label={t('approval.steps.todoLabel')} />
              )}
              {!step.done && pageLanded(step.page) ? (
                <Link to={link(`${base}/${step.page}`)} className="flex min-w-0 flex-col gap-0.5 hover:underline" data-step-link="">
                  {body}
                </Link>
              ) : (
                <span className="flex min-w-0 flex-col gap-0.5">{body}</span>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
